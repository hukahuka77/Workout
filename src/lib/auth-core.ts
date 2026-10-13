import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { uid } from "./db";

const SESSION_DAYS = 60;
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function createUser(db: Database.Database, email: string, password: string, displayName: string, timezone = "America/New_York") {
  const id = uid();
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(() => {
    const first = (db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c === 0;
    db.prepare("INSERT INTO users (id,email,password_hash) VALUES (?,?,?)").run(id, email.trim().toLowerCase(), hash);
    db.prepare("INSERT INTO profiles (id,display_name,timezone) VALUES (?,?,?)").run(id, displayName.trim(), timezone);
    // The first account on a self-hosted install becomes the admin.
    if (first) db.prepare("INSERT INTO admin_users (user_id) VALUES (?)").run(id);
  })();
  return id;
}

export function verifyLogin(db: Database.Database, email: string, password: string): string | null {
  const row = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase()) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row) {
    bcrypt.compareSync(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
    return null;
  }
  return bcrypt.compareSync(password, row.password_hash) ? row.id : null;
}

export function createAuthSession(db: Database.Database, userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare("INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(hashToken(token), userId, expires.toISOString());
  return { token, expires };
}

export function userForToken(db: Database.Database, token: string | undefined) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, p.display_name AS displayName, p.preferred_unit AS unit, p.timezone,
              EXISTS(SELECT 1 FROM admin_users a WHERE a.user_id = u.id) AS isAdmin
       FROM auth_sessions s JOIN users u ON u.id = s.user_id JOIN profiles p ON p.id = u.id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), new Date().toISOString()) as any;
  if (!row) return null;
  return { ...row, isAdmin: !!row.isAdmin } as CurrentUser;
}

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  unit: "lb" | "kg";
  timezone: string;
  isAdmin: boolean;
};

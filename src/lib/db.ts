import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedExercises, linkSeedMuscles } from "./seed-data";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

function open(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Database.Database) {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)");
  const done = new Set(db.prepare("SELECT name FROM _migrations").all().map((r: any) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(f);
    })();
  }
}

export function openMemoryDb() {
  return open(":memory:");
}

const g = globalThis as unknown as { __db?: Database.Database };

export function getDb(): Database.Database {
  if (!g.__db) {
    g.__db = open(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "workout.db"));
    seedExercises(g.__db);
    linkSeedMuscles(g.__db);
  }
  return g.__db;
}

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

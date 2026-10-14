import type Database from "better-sqlite3";
import { uid } from "./db";
import { AppError } from "./service";

type DB = Database.Database;
export type EntityType = "exercise" | "workout" | "program";
export type Tag = { id: string; name: string };

const MAX_PER_ENTITY = 20;
export const cleanTag = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 30);

export function listTags(db: DB, userId: string) {
  return db
    .prepare(
      `SELECT t.id, t.name, COUNT(g.entity_id) AS uses FROM tags t
       LEFT JOIN taggings g ON g.tag_id = t.id WHERE t.user_id = ? GROUP BY t.id ORDER BY t.name COLLATE NOCASE`,
    )
    .all(userId) as (Tag & { uses: number })[];
}

export function tagsByEntity(db: DB, userId: string, type: EntityType): Record<string, Tag[]> {
  const rows = db
    .prepare(`SELECT g.entity_id AS eid, t.id, t.name FROM taggings g JOIN tags t ON t.id = g.tag_id WHERE g.user_id = ? AND g.entity_type = ? ORDER BY t.name COLLATE NOCASE`)
    .all(userId, type) as (Tag & { eid: string })[];
  const out: Record<string, Tag[]> = {};
  for (const r of rows) (out[r.eid] ??= []).push({ id: r.id, name: r.name });
  return out;
}

function entityExists(db: DB, userId: string, type: EntityType, id: string) {
  const sql =
    type === "exercise" ? "SELECT 1 FROM exercises WHERE id = ?" :
    type === "workout" ? "SELECT 1 FROM workouts WHERE id = ? AND user_id = ?" :
    "SELECT 1 FROM programs WHERE id = ? AND user_id = ?";
  return !!(type === "exercise" ? db.prepare(sql).get(id) : db.prepare(sql).get(id, userId));
}

/** Replace the set of tags on one entity. Tags are created on the fly and are private to the user. */
export function setTags(db: DB, userId: string, type: EntityType, entityId: string, names: string[]): Tag[] {
  const seen = new Set<string>();
  const clean = names.map(cleanTag).filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
  if (clean.length > MAX_PER_ENTITY) throw new AppError(`Max ${MAX_PER_ENTITY} tags`);
  return db.transaction(() => {
    if (!entityExists(db, userId, type, entityId)) throw new AppError("Not found");
    const ids: Tag[] = clean.map((name) => {
      const row = db.prepare("SELECT id, name FROM tags WHERE user_id = ? AND name = ?").get(userId, name) as Tag | undefined;
      if (row) return row;
      const id = uid();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?,?,?)").run(id, userId, name);
      return { id, name };
    });
    db.prepare("DELETE FROM taggings WHERE user_id = ? AND entity_type = ? AND entity_id = ?").run(userId, type, entityId);
    const ins = db.prepare("INSERT INTO taggings (user_id, tag_id, entity_type, entity_id) VALUES (?,?,?,?)");
    for (const t of ids) ins.run(userId, t.id, type, entityId);
    return ids;
  })();
}

export function renameTag(db: DB, userId: string, tagId: string, name: string) {
  const n = cleanTag(name);
  if (!n) throw new AppError("Name required");
  try {
    const r = db.prepare("UPDATE tags SET name = ? WHERE id = ? AND user_id = ?").run(n, tagId, userId);
    if (!r.changes) throw new AppError("Not found");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("You already have a tag with that name");
  }
}

export function deleteTag(db: DB, userId: string, tagId: string) {
  const r = db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(tagId, userId);
  if (!r.changes) throw new AppError("Not found");
}

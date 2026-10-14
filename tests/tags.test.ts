import { describe, it, expect, beforeEach } from "vitest";
import { openMemoryDb } from "@/lib/db";
import { createUser } from "@/lib/auth-core";
import * as svc from "@/lib/service";
import * as tags from "@/lib/tags";

let db: ReturnType<typeof openMemoryDb>, a: string, b: string, ex: string;
beforeEach(() => {
  db = openMemoryDb();
  a = createUser(db, "a@x.com", "pw12345678", "A");
  b = createUser(db, "b@x.com", "pw12345678", "B");
  ex = "ex1";
  db.prepare("INSERT INTO exercises (id,name,category) VALUES (?,?, 'Strength')").run(ex, "Bench");
});
const wk = (u: string, t?: string[]) => svc.saveWorkout(db, u, { name: "W", tags: t, exercises: [{ exerciseId: ex, sets: [{ reps: 5, weightKg: null, durationSec: null, restSec: null }] }] });

describe("tags", () => {
  it("creates, dedupes case-insensitively, replaces", () => {
    const w = wk(a, ["Push", "push", " Heavy  day "]);
    expect(tags.tagsByEntity(db, a, "workout")[w].map((t) => t.name).sort()).toEqual(["Heavy day", "Push"]);
    tags.setTags(db, a, "workout", w, ["push"]);
    expect(tags.tagsByEntity(db, a, "workout")[w].map((t) => t.name)).toEqual(["Push"]);
    expect(tags.listTags(db, a).map((t) => [t.name, t.uses])).toEqual([["Heavy day", 0], ["Push", 1]]);
  });
  it("tags apply to exercises, programs and are private per user", () => {
    const w = wk(a);
    const p = svc.saveProgram(db, a, { name: "P", weeks: 2, tags: ["Cut"], slots: [{ workoutId: w, isoWeekday: 1 }] });
    tags.setTags(db, a, "exercise", ex, ["Favorite"]);
    expect(tags.tagsByEntity(db, a, "program")[p][0].name).toBe("Cut");
    expect(tags.tagsByEntity(db, b, "exercise")[ex]).toBeUndefined();
    expect(tags.listTags(db, b)).toEqual([]);
    // b cannot tag a's workout
    expect(() => tags.setTags(db, b, "workout", w, ["x"])).toThrow();
    // b's tag with same name is distinct
    tags.setTags(db, b, "exercise", ex, ["Favorite"]);
    expect(tags.listTags(db, a)[0].id).not.toBe(tags.listTags(db, b)[0].id);
  });
  it("rename collisions rejected, delete cascades, other users' tags untouchable", () => {
    const w = wk(a, ["One", "Two"]);
    const [one, two] = tags.listTags(db, a);
    expect(() => tags.renameTag(db, a, one.id, "two")).toThrow();
    tags.renameTag(db, a, one.id, "Uno");
    expect(() => tags.renameTag(db, b, one.id, "Hax")).toThrow();
    expect(() => tags.deleteTag(db, b, one.id)).toThrow();
    tags.deleteTag(db, a, two.id);
    expect(tags.tagsByEntity(db, a, "workout")[w].map((t) => t.name)).toEqual(["Uno"]);
  });
});

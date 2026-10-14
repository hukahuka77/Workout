import { describe, it, expect } from "vitest";
import { openMemoryDb } from "@/lib/db";
import { seedExercises, linkSeedMuscles, SEED_EXERCISES, SEED_MUSCLES } from "@/lib/seed-data";

describe("muscle tagging", () => {
  it("every seeded exercise gets at least one valid muscle; multi-muscle exercises keep all of them", () => {
    const db = openMemoryDb();
    seedExercises(db);
    linkSeedMuscles(db);
    linkSeedMuscles(db); // idempotent
    const orphans = db.prepare("SELECT name FROM exercises e WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles m WHERE m.exercise_id=e.id)").all();
    expect(orphans).toEqual([]);
    expect(Object.keys(SEED_MUSCLES).every((n) => SEED_EXERCISES.some((e) => e[0] === n))).toBe(true);
    const names = (ex: string) => (db.prepare("SELECT m.id FROM exercise_muscles em JOIN muscles m ON m.id=em.muscle_id JOIN exercises e ON e.id=em.exercise_id WHERE e.name=? ORDER BY m.id").all(ex) as any[]).map((r) => r.id);
    expect(names("Push-up")).toEqual(["front_delt", "triceps", "upper_chest"]);
    expect(names("Barbell Curl")).toEqual(["biceps"]);
  });
  it("regions available: upper, lower, core", () => {
    const db = openMemoryDb();
    expect((db.prepare("SELECT DISTINCT region FROM muscles ORDER BY region").all() as any[]).map((r) => r.region)).toEqual(["core", "lower", "upper"]);
  });
});

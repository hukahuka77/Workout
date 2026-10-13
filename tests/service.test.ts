import { describe, it, expect, beforeEach } from "vitest";
import { openMemoryDb } from "@/lib/db";
import { createUser, verifyLogin, createAuthSession, userForToken } from "@/lib/auth-core";
import * as svc from "@/lib/service";
import { lbToKg, fromKg, toKg } from "@/lib/units";
import { e1rm } from "@/lib/pr";
import { expandProgram, isoWeekday, mondayOf, addDays } from "@/lib/dates";

let db: ReturnType<typeof openMemoryDb>;
let a: string, b: string, bench: string, row: string;

beforeEach(() => {
  db = openMemoryDb();
  a = createUser(db, "a@x.com", "pw12345678", "A");
  b = createUser(db, "b@x.com", "pw12345678", "B");
  bench = "ex-bench"; row = "ex-row";
  for (const [id, n] of [[bench, "Bench"], [row, "Row"]]) db.prepare("INSERT INTO exercises (id,name,category) VALUES (?,?,'Strength')").run(id, n);
});

const mk = (user: string, kg = lbToKg(135)) =>
  svc.saveWorkout(db, user, { name: "Upper", exercises: [{ exerciseId: bench, sets: [{ reps: 8, weightKg: kg, durationSec: null, restSec: 90 }, { reps: 8, weightKg: kg, durationSec: null, restSec: 90 }] }, { exerciseId: row, sets: [{ reps: 10, weightKg: 40, durationSec: null, restSec: null }] }] });

describe("units", () => {
  it("round-trips 135 lb", () => { expect(fromKg(toKg(135, "lb"), "lb")).toBe(135); });
  it("e1rm", () => { expect(e1rm(100, 1)).toBe(100); expect(e1rm(100, 3)).toBeCloseTo(110); expect(e1rm(0, 5)).toBeNull(); expect(e1rm(100, 12)).toBeNull(); });
});

describe("auth + isolation", () => {
  it("first user is admin, login works", () => {
    expect(db.prepare("SELECT COUNT(*) c FROM admin_users WHERE user_id=?").get(a)).toEqual({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) c FROM admin_users WHERE user_id=?").get(b)).toEqual({ c: 0 });
    expect(verifyLogin(db, "A@x.com", "pw12345678")).toBe(a);
    expect(verifyLogin(db, "a@x.com", "bad")).toBeNull();
    const { token } = createAuthSession(db, b);
    expect(userForToken(db, token)?.id).toBe(b);
  });
  it("other user cannot read or modify by guessed id", () => {
    const w = mk(a);
    expect(svc.loadWorkout(db, b, w)).toBeNull();
    expect(() => svc.saveWorkout(db, b, { id: w, name: "x", exercises: [] })).toThrow();
    expect(() => svc.addScheduled(db, b, w, "2026-10-14")).toThrow();
    expect(() => svc.startSession(db, b, { workoutId: w })).toThrow();
    expect(() => svc.saveProgram(db, b, { name: "p", weeks: 2, slots: [{ workoutId: w, isoWeekday: 1 }] })).toThrow();
  });
});

describe("programs & calendar", () => {
  it("expands weeks, idempotent, move affects one event", () => {
    const w = mk(a);
    const p = svc.saveProgram(db, a, { name: "P", weeks: 8, slots: [1, 2, 4, 5].map((d) => ({ workoutId: w, isoWeekday: d })) });
    const r1 = svc.startProgram(db, a, p, "2026-10-12", 8, "k1");
    const r2 = svc.startProgram(db, a, p, "2026-10-12", 8, "k1");
    expect(r1).toBe(r2);
    const rows = db.prepare("SELECT * FROM scheduled_workouts WHERE user_id=? ORDER BY scheduled_date").all(a) as any[];
    expect(rows).toHaveLength(32);
    const thu = rows.find((r) => r.scheduled_date === "2026-10-22");
    svc.moveScheduled(db, a, thu.id, "2026-10-23");
    const after = db.prepare("SELECT COUNT(*) c FROM scheduled_workouts WHERE scheduled_date='2026-10-15' AND user_id=?").get(a) as any;
    expect(after.c).toBe(1);
    expect(db.prepare("SELECT scheduled_date d FROM scheduled_workouts WHERE id=?").get(thu.id)).toEqual({ d: "2026-10-23" });
  });
  it("date helpers", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(expandProgram([{ id: "s", workoutId: "w", isoWeekday: 7 }], "2026-10-12", 2).map((o) => o.date)).toEqual(["2026-10-18", "2026-10-25"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("sessions", () => {
  it("snapshots, autosaves, prefills from last performance, never mutates template, PRs", () => {
    const w = mk(a);
    const s1 = svc.startSession(db, a, { workoutId: w });
    expect(s1.resumed).toBe(false);
    expect(svc.startSession(db, a, { workoutId: w })).toEqual({ id: s1.id, resumed: true });
    let s = svc.loadSession(db, a, s1.id)!;
    expect(s.exercises.map((e) => e.name)).toEqual(["Bench", "Row"]);
    // edit 135 -> 145 and complete first set
    s.exercises[0].sets[0].weightKg = lbToKg(145); s.exercises[0].sets[0].done = true;
    const r = svc.saveSession(db, a, { id: s.id, revision: s.revision, exercises: s.exercises });
    expect(r.ok).toBe(true);
    // stale write is rejected
    expect(svc.saveSession(db, a, { id: s.id, revision: s.revision, exercises: s.exercises })).toEqual({ ok: false, conflict: true });
    const sum = svc.finishSession(db, a, s1.id);
    expect(sum.setsDone).toBe(1);
    expect(sum.prs).toHaveLength(0); // nothing earlier to beat
    expect(svc.finishSession(db, a, s1.id).setsDone).toBe(1); // idempotent
    // template untouched
    expect(svc.loadWorkout(db, a, w)!.exercises[0].sets[0].weightKg).toBeCloseTo(lbToKg(135));
    // next session prefills actual 145 for set 0, template target stays 135
    const s2 = svc.startSession(db, a, { workoutId: w });
    const t = svc.loadSession(db, a, s2.id)!;
    expect(fromKg(t.exercises[0].sets[0].weightKg!, "lb")).toBe(145);
    expect(fromKg(t.exercises[0].sets[0].targetWeightKg!, "lb")).toBe(135);
    // heavier set -> PR; incomplete sets excluded
    t.exercises[0].sets[0].weightKg = lbToKg(155); t.exercises[0].sets[0].done = true;
    t.exercises[0].sets[1].weightKg = lbToKg(500);
    svc.saveSession(db, a, { id: t.id, revision: t.revision, exercises: t.exercises });
    const sum2 = svc.finishSession(db, a, s2.id);
    expect(sum2.prs.some((p) => p.kind === "heaviest" && Math.abs(p.valueKg - lbToKg(155)) < 1e-6)).toBe(true);
    expect(sum2.prs.every((p) => p.valueKg < lbToKg(200))).toBe(true);
  });
  it("cannot complete a set without reps/duration", () => {
    const s = svc.startSession(db, a, {});
    const dto = svc.loadSession(db, a, s.id)!;
    const ex = { id: "tmp1", exerciseId: bench, name: "Bench", notes: null, sets: [{ id: "tmp2", targetReps: null, targetWeightKg: null, targetDurationSec: null, reps: null, weightKg: 10, durationSec: null, restSec: null, done: true, completedAt: null }] };
    const r = svc.saveSession(db, a, { id: dto.id, revision: dto.revision, exercises: [ex] }) as any;
    expect(r.ok).toBe(true);
    expect(svc.loadSession(db, a, s.id)!.exercises[0].sets[0].done).toBe(false);
  });
  it("scheduled item links one session", () => {
    const w = mk(a);
    const sc = svc.addScheduled(db, a, w, "2026-10-13");
    const s = svc.startSession(db, a, { scheduledId: sc });
    svc.finishSession(db, a, s.id);
    expect(svc.startSession(db, a, { scheduledId: sc })).toEqual({ id: s.id, resumed: true });
    expect(() => svc.removeScheduled(db, a, sc)).toThrow();
  });
});

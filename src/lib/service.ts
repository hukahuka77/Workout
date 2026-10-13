import type Database from "better-sqlite3";
import { uid, nowIso } from "./db";
import { expandProgram } from "./dates";
import { newPRs, volumeKg, type SetResult } from "./pr";

type DB = Database.Database;
export class AppError extends Error {}
const must = <T>(v: T | undefined | null, msg = "Not found"): T => {
  if (v == null) throw new AppError(msg);
  return v;
};

/* ---------------- Workouts ---------------- */
export type WorkoutInput = {
  id?: string;
  name: string;
  description?: string | null;
  exercises: {
    exerciseId: string;
    notes?: string | null;
    sets: { reps: number | null; weightKg: number | null; durationSec: number | null; restSec: number | null }[];
  }[];
};

export function saveWorkout(db: DB, userId: string, input: WorkoutInput): string {
  if (!input.name.trim()) throw new AppError("Name required");
  return db.transaction(() => {
    let id = input.id;
    if (id) {
      must(db.prepare("SELECT 1 FROM workouts WHERE id=? AND user_id=?").get(id, userId));
      db.prepare("UPDATE workouts SET name=?, description=?, updated_at=? WHERE id=? AND user_id=?").run(input.name.trim(), input.description ?? null, nowIso(), id, userId);
      db.prepare("DELETE FROM workout_exercises WHERE workout_id=? AND user_id=?").run(id, userId);
    } else {
      id = uid();
      db.prepare("INSERT INTO workouts (id,user_id,name,description) VALUES (?,?,?,?)").run(id, userId, input.name.trim(), input.description ?? null);
    }
    input.exercises.forEach((ex, i) => {
      must(db.prepare("SELECT 1 FROM exercises WHERE id=? AND active=1").get(ex.exerciseId), "Invalid exercise");
      const weId = uid();
      db.prepare("INSERT INTO workout_exercises (id,user_id,workout_id,exercise_id,sort_order,notes) VALUES (?,?,?,?,?,?)").run(weId, userId, id, ex.exerciseId, i, ex.notes ?? null);
      ex.sets.forEach((s, j) => {
        if (s.reps == null && s.weightKg == null && s.durationSec == null) throw new AppError("Each set needs reps, weight or duration");
        db.prepare("INSERT INTO workout_sets (id,user_id,workout_exercise_id,sort_order,target_reps,target_weight_kg,target_duration_sec,target_rest_sec) VALUES (?,?,?,?,?,?,?,?)").run(uid(), userId, weId, j, s.reps, s.weightKg, s.durationSec, s.restSec);
      });
    });
    return id!;
  })();
}

export function loadWorkout(db: DB, userId: string, id: string) {
  const w = db.prepare("SELECT * FROM workouts WHERE id=? AND user_id=?").get(id, userId) as any;
  if (!w) return null;
  const exs = db
    .prepare(`SELECT we.id, we.exercise_id AS exerciseId, we.notes, e.name, e.category, e.image_path AS imagePath
              FROM workout_exercises we JOIN exercises e ON e.id=we.exercise_id
              WHERE we.workout_id=? AND we.user_id=? ORDER BY we.sort_order`)
    .all(id, userId) as any[];
  const setStmt = db.prepare(
    "SELECT id, target_reps AS reps, target_weight_kg AS weightKg, target_duration_sec AS durationSec, target_rest_sec AS restSec FROM workout_sets WHERE workout_exercise_id=? AND user_id=? ORDER BY sort_order",
  );
  return { id: w.id as string, name: w.name as string, description: w.description as string | null, archivedAt: w.archived_at as string | null, exercises: exs.map((e) => ({ ...e, sets: setStmt.all(e.id, userId) as any[] })) };
}

export function cloneWorkout(db: DB, userId: string, id: string) {
  const w = must(loadWorkout(db, userId, id));
  return saveWorkout(db, userId, {
    name: `${w.name} copy`,
    description: w.description,
    exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, notes: e.notes, sets: e.sets.map((s: any) => ({ reps: s.reps, weightKg: s.weightKg, durationSec: s.durationSec, restSec: s.restSec })) })),
  });
}

export function setWorkoutArchived(db: DB, userId: string, id: string, archived: boolean) {
  const r = db.prepare("UPDATE workouts SET archived_at=? WHERE id=? AND user_id=?").run(archived ? nowIso() : null, id, userId);
  if (!r.changes) throw new AppError("Not found");
}

/* ---------------- Programs ---------------- */
export type ProgramInput = {
  id?: string;
  name: string;
  description?: string | null;
  weeks: number;
  slots: { workoutId: string; isoWeekday: number }[];
};

export function saveProgram(db: DB, userId: string, input: ProgramInput): string {
  if (!input.name.trim()) throw new AppError("Name required");
  if (!(input.weeks >= 1 && input.weeks <= 52)) throw new AppError("Weeks must be 1-52");
  return db.transaction(() => {
    let id = input.id;
    if (id) {
      must(db.prepare("SELECT 1 FROM programs WHERE id=? AND user_id=?").get(id, userId));
      db.prepare("UPDATE programs SET name=?, description=?, default_weeks=?, updated_at=? WHERE id=? AND user_id=?").run(input.name.trim(), input.description ?? null, input.weeks, nowIso(), id, userId);
      // Slots referenced by existing runs are intentionally kept as plain ids on events; definitions are replaced.
      db.prepare("DELETE FROM program_workouts WHERE program_id=? AND user_id=?").run(id, userId);
    } else {
      id = uid();
      db.prepare("INSERT INTO programs (id,user_id,name,description,default_weeks) VALUES (?,?,?,?,?)").run(id, userId, input.name.trim(), input.description ?? null, input.weeks);
    }
    input.slots.forEach((s, i) => {
      must(db.prepare("SELECT 1 FROM workouts WHERE id=? AND user_id=?").get(s.workoutId, userId), "Invalid workout");
      if (s.isoWeekday < 1 || s.isoWeekday > 7) throw new AppError("Invalid weekday");
      db.prepare("INSERT INTO program_workouts (id,user_id,program_id,workout_id,iso_weekday,sort_order) VALUES (?,?,?,?,?,?)").run(uid(), userId, id, s.workoutId, s.isoWeekday, i);
    });
    return id!;
  })();
}

export function startProgram(db: DB, userId: string, programId: string, startMonday: string, weeks: number, idempotencyKey: string) {
  return db.transaction(() => {
    const prog = must(db.prepare("SELECT id FROM programs WHERE id=? AND user_id=?").get(programId, userId));
    const existing = db.prepare("SELECT id FROM program_runs WHERE user_id=? AND idempotency_key=?").get(userId, idempotencyKey) as { id: string } | undefined;
    if (existing) return existing.id;
    const slots = db.prepare("SELECT id, workout_id AS workoutId, iso_weekday AS isoWeekday FROM program_workouts WHERE program_id=? AND user_id=? ORDER BY sort_order").all((prog as any).id, userId) as any[];
    if (!slots.length) throw new AppError("Add at least one workout first");
    const runId = uid();
    db.prepare("INSERT INTO program_runs (id,user_id,program_id,start_monday,weeks,idempotency_key) VALUES (?,?,?,?,?,?)").run(runId, userId, programId, startMonday, weeks, idempotencyKey);
    const ins = db.prepare("INSERT OR IGNORE INTO scheduled_workouts (id,user_id,workout_id,program_run_id,program_slot_id,scheduled_date) VALUES (?,?,?,?,?,?)");
    for (const o of expandProgram(slots, startMonday, weeks)) ins.run(uid(), userId, o.workoutId, runId, o.slotId, o.date);
    return runId;
  })();
}

/* ---------------- Calendar ---------------- */
export function addScheduled(db: DB, userId: string, workoutId: string, date: string) {
  must(db.prepare("SELECT 1 FROM workouts WHERE id=? AND user_id=?").get(workoutId, userId), "Invalid workout");
  const id = uid();
  db.prepare("INSERT INTO scheduled_workouts (id,user_id,workout_id,scheduled_date) VALUES (?,?,?,?)").run(id, userId, workoutId, date);
  return id;
}

export function moveScheduled(db: DB, userId: string, id: string, date: string) {
  const r = db.prepare("UPDATE scheduled_workouts SET scheduled_date=? WHERE id=? AND user_id=? AND cancelled_at IS NULL").run(date, id, userId);
  if (!r.changes) throw new AppError("Not found");
}

export function removeScheduled(db: DB, userId: string, id: string) {
  const started = db.prepare("SELECT 1 FROM sessions WHERE scheduled_workout_id=? AND user_id=? AND status<>'discarded'").get(id, userId);
  if (started) throw new AppError("Already started - can't remove");
  const r = db.prepare("UPDATE scheduled_workouts SET cancelled_at=? WHERE id=? AND user_id=?").run(nowIso(), id, userId);
  if (!r.changes) throw new AppError("Not found");
}

/* ---------------- Sessions ---------------- */
export function getActiveSessionId(db: DB, userId: string): string | null {
  const r = db.prepare("SELECT id FROM sessions WHERE user_id=? AND status='active'").get(userId) as { id: string } | undefined;
  return r?.id ?? null;
}

type PrevSet = { reps: number | null; weightKg: number | null; durationSec: number | null };

function lastPerformed(db: DB, userId: string, exerciseId: string): PrevSet[] {
  return db
    .prepare(
      `SELECT ss.actual_reps AS reps, ss.actual_weight_kg AS weightKg, ss.actual_duration_sec AS durationSec
       FROM session_sets ss JOIN session_exercises se ON se.id=ss.session_exercise_id
       WHERE se.id = (SELECT se2.id FROM session_exercises se2 JOIN sessions s ON s.id=se2.session_id
                      WHERE se2.exercise_id=? AND s.user_id=? AND s.status='completed'
                        AND EXISTS (SELECT 1 FROM session_sets x WHERE x.session_exercise_id=se2.id AND x.is_completed=1)
                      ORDER BY s.ended_at DESC LIMIT 1)
         AND ss.is_completed=1
       ORDER BY ss.sort_order`,
    )
    .all(exerciseId, userId) as PrevSet[];
}

/** Resume the active session, or snapshot a template/schedule/blank into a new one atomically. */
export function startSession(db: DB, userId: string, opts: { workoutId?: string; scheduledId?: string }): { id: string; resumed: boolean } {
  return db.transaction(() => {
    const active = getActiveSessionId(db, userId);
    if (active) return { id: active, resumed: true };

    let workoutId = opts.workoutId;
    if (opts.scheduledId) {
      const sch = must(db.prepare("SELECT workout_id FROM scheduled_workouts WHERE id=? AND user_id=? AND cancelled_at IS NULL").get(opts.scheduledId, userId) as any);
      const linked = db.prepare("SELECT id, status FROM sessions WHERE scheduled_workout_id=? AND user_id=? AND status<>'discarded'").get(opts.scheduledId, userId) as any;
      if (linked) return { id: linked.id as string, resumed: true };
      workoutId = sch.workout_id;
    }
    const w = workoutId ? must(loadWorkout(db, userId, workoutId)) : null;
    const sid = uid();
    db.prepare("INSERT INTO sessions (id,user_id,source_workout_id,scheduled_workout_id,name_snapshot,status,started_at) VALUES (?,?,?,?,?,'active',?)").run(sid, userId, w?.id ?? null, opts.scheduledId ?? null, w?.name ?? "Quick workout", nowIso());
    w?.exercises.forEach((ex, i) => {
      const seId = uid();
      db.prepare("INSERT INTO session_exercises (id,user_id,session_id,exercise_id,name_snapshot,sort_order,notes) VALUES (?,?,?,?,?,?,?)").run(seId, userId, sid, ex.exerciseId, ex.name, i, ex.notes);
      const prev = lastPerformed(db, userId, ex.exerciseId);
      ex.sets.forEach((s: any, j: number) => {
        const p = prev[j];
        db.prepare(
          `INSERT INTO session_sets (id,user_id,session_exercise_id,sort_order,target_reps,target_weight_kg,target_duration_sec,actual_reps,actual_weight_kg,actual_duration_sec,rest_sec)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(uid(), userId, seId, j, s.reps, s.weightKg, s.durationSec, p ? p.reps : s.reps, p ? p.weightKg : s.weightKg, p ? p.durationSec : s.durationSec, s.restSec);
      });
    });
    return { id: sid, resumed: false };
  })();
}

export type SessionSetDTO = {
  id: string; targetReps: number | null; targetWeightKg: number | null; targetDurationSec: number | null;
  reps: number | null; weightKg: number | null; durationSec: number | null; restSec: number | null;
  done: boolean; completedAt: string | null;
};
export type SessionExerciseDTO = { id: string; exerciseId: string; name: string; imagePath: string | null; notes: string | null; sets: SessionSetDTO[] };
export type SessionDTO = {
  id: string; name: string; status: "active" | "completed" | "discarded"; startedAt: string; endedAt: string | null;
  revision: number; notes: string | null; exercises: SessionExerciseDTO[];
};

export function loadSession(db: DB, userId: string, id: string): SessionDTO | null {
  const s = db.prepare("SELECT * FROM sessions WHERE id=? AND user_id=?").get(id, userId) as any;
  if (!s) return null;
  const exs = db.prepare("SELECT se.id, se.exercise_id AS exerciseId, se.name_snapshot AS name, se.notes, e.image_path AS imagePath FROM session_exercises se JOIN exercises e ON e.id=se.exercise_id WHERE se.session_id=? AND se.user_id=? ORDER BY se.sort_order").all(id, userId) as any[];
  const setStmt = db.prepare(
    `SELECT id, target_reps AS targetReps, target_weight_kg AS targetWeightKg, target_duration_sec AS targetDurationSec,
            actual_reps AS reps, actual_weight_kg AS weightKg, actual_duration_sec AS durationSec, rest_sec AS restSec,
            is_completed AS done, completed_at AS completedAt
     FROM session_sets WHERE session_exercise_id=? AND user_id=? ORDER BY sort_order`,
  );
  return {
    id: s.id, name: s.name_snapshot, status: s.status, startedAt: s.started_at, endedAt: s.ended_at, revision: s.revision, notes: s.notes,
    exercises: exs.map((e) => ({ ...e, sets: (setStmt.all(e.id, userId) as any[]).map((x) => ({ ...x, done: !!x.done })) })),
  };
}

export type SaveSessionInput = { id: string; revision: number; notes?: string | null; exercises: { id: string; exerciseId: string; name: string; notes?: string | null; sets: SessionSetDTO[] }[] };
export type SaveResult = { ok: true; revision: number; ids: Record<string, string> } | { ok: false; conflict: true };

/** Replace the whole editable state of an active session, guarded by a revision. */
export function saveSession(db: DB, userId: string, input: SaveSessionInput): SaveResult {
  return db.transaction((): SaveResult => {
    const s = must(db.prepare("SELECT status, revision FROM sessions WHERE id=? AND user_id=?").get(input.id, userId) as any);
    if (s.status !== "active") throw new AppError("Session is not active");
    if (s.revision !== input.revision) return { ok: false, conflict: true };

    const keepEx = new Set<string>();
    const existingEx = new Set((db.prepare("SELECT id FROM session_exercises WHERE session_id=? AND user_id=?").all(input.id, userId) as any[]).map((r) => r.id));
    const ids: Record<string, string> = {};
    input.exercises.forEach((ex, i) => {
      let exId = ex.id;
      if (existingEx.has(exId)) {
        db.prepare("UPDATE session_exercises SET sort_order=?, notes=? WHERE id=? AND user_id=?").run(i + 1000, ex.notes ?? null, exId, userId);
      } else {
        must(db.prepare("SELECT 1 FROM exercises WHERE id=? AND active=1").get(ex.exerciseId), "Invalid exercise");
        const nm = (db.prepare("SELECT name FROM exercises WHERE id=?").get(ex.exerciseId) as any).name;
        exId = uid();
        ids[ex.id] = exId;
        db.prepare("INSERT INTO session_exercises (id,user_id,session_id,exercise_id,name_snapshot,sort_order,notes) VALUES (?,?,?,?,?,?,?)").run(exId, userId, input.id, ex.exerciseId, nm, i + 1000, ex.notes ?? null);
      }
      keepEx.add(exId);
      const existingSets = new Set((db.prepare("SELECT id FROM session_sets WHERE session_exercise_id=? AND user_id=?").all(exId, userId) as any[]).map((r) => r.id));
      const keepSets = new Set<string>();
      ex.sets.forEach((st, j) => {
        const done = st.done && ((st.reps ?? 0) > 0 || (st.durationSec ?? 0) > 0);
        const completedAt = done ? st.completedAt ?? nowIso() : null;
        if (existingSets.has(st.id)) {
          db.prepare(
            `UPDATE session_sets SET sort_order=?, actual_reps=?, actual_weight_kg=?, actual_duration_sec=?, rest_sec=?, is_completed=?, completed_at=?, updated_at=? WHERE id=? AND user_id=?`,
          ).run(j + 1000, st.reps, st.weightKg, st.durationSec, st.restSec, done ? 1 : 0, completedAt, nowIso(), st.id, userId);
          keepSets.add(st.id);
        } else {
          const nid = uid();
          ids[st.id] = nid;
          db.prepare(
            `INSERT INTO session_sets (id,user_id,session_exercise_id,sort_order,target_reps,target_weight_kg,target_duration_sec,actual_reps,actual_weight_kg,actual_duration_sec,rest_sec,is_completed,completed_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          ).run(nid, userId, exId, j + 1000, st.targetReps, st.targetWeightKg, st.targetDurationSec, st.reps, st.weightKg, st.durationSec, st.restSec, done ? 1 : 0, completedAt);
          keepSets.add(nid);
        }
      });
      for (const sid of existingSets) if (!keepSets.has(sid)) db.prepare("DELETE FROM session_sets WHERE id=? AND user_id=?").run(sid, userId);
    });
    for (const eid of existingEx) if (!keepEx.has(eid)) db.prepare("DELETE FROM session_exercises WHERE id=? AND user_id=?").run(eid, userId);
    // Normalise ordering back to 0..n (two-phase avoids transient collisions; no unique constraint on order anyway).
    db.prepare("UPDATE session_exercises SET sort_order = sort_order - 1000 WHERE session_id=? AND user_id=?").run(input.id, userId);
    db.prepare("UPDATE session_sets SET sort_order = sort_order - 1000 WHERE user_id=? AND session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id=?)").run(userId, input.id);
    const rev = s.revision + 1;
    db.prepare("UPDATE sessions SET revision=?, notes=?, updated_at=? WHERE id=? AND user_id=?").run(rev, input.notes ?? null, nowIso(), input.id, userId);
    return { ok: true, revision: rev, ids };
  })();
}

export type FinishSummary = {
  sessionId: string; name: string; durationSec: number; exercises: number; setsDone: number; setsTotal: number; volumeKg: number;
  prs: { exerciseName: string; kind: "heaviest" | "e1rm"; valueKg: number }[];
};

export function summarizeSession(db: DB, userId: string, id: string): FinishSummary {
  const s = must(db.prepare("SELECT * FROM sessions WHERE id=? AND user_id=?").get(id, userId) as any);
  const exs = db.prepare("SELECT id, exercise_id AS exerciseId, name_snapshot AS name FROM session_exercises WHERE session_id=? AND user_id=? ORDER BY sort_order").all(id, userId) as any[];
  const sets = (exId: string, completedOnly: boolean) =>
    db.prepare(`SELECT actual_reps AS reps, actual_weight_kg AS weightKg FROM session_sets WHERE session_exercise_id=? AND user_id=? ${completedOnly ? "AND is_completed=1" : ""}`).all(exId, userId) as SetResult[];
  let setsDone = 0, setsTotal = 0, vol = 0;
  const prs: FinishSummary["prs"] = [];
  for (const ex of exs) {
    const all = sets(ex.id, false);
    const done = sets(ex.id, true);
    setsTotal += all.length; setsDone += done.length; vol += volumeKg(done);
    const earlier = db
      .prepare(
        `SELECT ss.actual_reps AS reps, ss.actual_weight_kg AS weightKg FROM session_sets ss
         JOIN session_exercises se ON se.id=ss.session_exercise_id JOIN sessions s ON s.id=se.session_id
         WHERE se.exercise_id=? AND s.user_id=? AND s.status='completed' AND s.id<>? AND ss.is_completed=1 AND s.ended_at < ?`,
      )
      .all(ex.exerciseId, userId, id, s.ended_at ?? nowIso()) as SetResult[];
    for (const p of newPRs(done, earlier)) prs.push({ exerciseName: ex.name, ...p });
  }
  const end = s.ended_at ? Date.parse(s.ended_at) : Date.now();
  return { sessionId: id, name: s.name_snapshot, durationSec: Math.max(0, Math.round((end - Date.parse(s.started_at)) / 1000)), exercises: exs.length, setsDone, setsTotal, volumeKg: vol, prs };
}

/** Idempotent: finishing a completed session just returns its summary. */
export function finishSession(db: DB, userId: string, id: string): FinishSummary {
  const s = must(db.prepare("SELECT status FROM sessions WHERE id=? AND user_id=?").get(id, userId) as any);
  if (s.status === "discarded") throw new AppError("Session was discarded");
  if (s.status === "active") db.prepare("UPDATE sessions SET status='completed', ended_at=?, updated_at=?, revision=revision+1 WHERE id=? AND user_id=?").run(nowIso(), nowIso(), id, userId);
  return summarizeSession(db, userId, id);
}

export function discardSession(db: DB, userId: string, id: string) {
  const r = db.prepare("UPDATE sessions SET status='discarded', ended_at=?, updated_at=? WHERE id=? AND user_id=? AND status='active'").run(nowIso(), nowIso(), id, userId);
  if (!r.changes) throw new AppError("No active session");
}

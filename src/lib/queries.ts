import { getDb } from "./db";

export type Region = "upper" | "lower" | "core";
export type MuscleRow = { id: string; name: string; region: Region };
export type ExerciseRow = { id: string; name: string; category: string; muscles: MuscleRow[]; regions: Region[]; equipment: string | null; instructions: string | null; imagePath: string | null; videoPath: string | null; active: number };

export function listMuscles(): MuscleRow[] {
  return getDb().prepare("SELECT id, name, region FROM muscles ORDER BY sort_order").all() as MuscleRow[];
}

export function listExercises(includeInactive = false): ExerciseRow[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id, name, category, equipment, instructions, image_path AS imagePath, video_path AS videoPath, active
              FROM exercises ${includeInactive ? "" : "WHERE active=1"} ORDER BY category, name`)
    .all() as any[];
  const links = db
    .prepare("SELECT em.exercise_id AS eid, m.id, m.name, m.region FROM exercise_muscles em JOIN muscles m ON m.id=em.muscle_id ORDER BY m.sort_order")
    .all() as (MuscleRow & { eid: string })[];
  const by = new Map<string, MuscleRow[]>();
  for (const l of links) (by.get(l.eid) ?? by.set(l.eid, []).get(l.eid)!).push({ id: l.id, name: l.name, region: l.region });
  const order: Region[] = ["upper", "core", "lower"];
  return rows.map((r) => {
    const muscles = by.get(r.id) ?? [];
    return { ...r, muscles, regions: order.filter((g) => muscles.some((m) => m.region === g)) };
  });
}

export function listWorkouts(userId: string, archived = false) {
  return getDb()
    .prepare(
      `SELECT w.id, w.name, w.archived_at AS archivedAt,
              (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id=w.id) AS exerciseCount,
              (SELECT COUNT(*) FROM workout_sets ws JOIN workout_exercises we ON we.id=ws.workout_exercise_id WHERE we.workout_id=w.id) AS setCount
       FROM workouts w WHERE w.user_id=? AND (w.archived_at IS NOT NULL) = ? ORDER BY w.updated_at DESC`,
    )
    .all(userId, archived ? 1 : 0) as { id: string; name: string; archivedAt: string | null; exerciseCount: number; setCount: number }[];
}

export function listPrograms(userId: string) {
  return getDb()
    .prepare(
      `SELECT p.id, p.name, p.default_weeks AS weeks,
              (SELECT COUNT(*) FROM program_workouts pw WHERE pw.program_id=p.id) AS slotCount
       FROM programs p WHERE p.user_id=? AND p.archived_at IS NULL ORDER BY p.updated_at DESC`,
    )
    .all(userId) as { id: string; name: string; weeks: number; slotCount: number }[];
}

export type ScheduledRow = { id: string; workoutId: string; name: string; date: string; sessionId: string | null; status: "planned" | "active" | "completed" };

export function scheduledBetween(userId: string, from: string, to: string): ScheduledRow[] {
  const rows = getDb()
    .prepare(
      `SELECT sw.id, sw.workout_id AS workoutId, w.name, sw.scheduled_date AS date,
              s.id AS sessionId, s.status AS sstatus
       FROM scheduled_workouts sw JOIN workouts w ON w.id=sw.workout_id
       LEFT JOIN sessions s ON s.scheduled_workout_id=sw.id AND s.status<>'discarded'
       WHERE sw.user_id=? AND sw.cancelled_at IS NULL AND sw.scheduled_date BETWEEN ? AND ?
       ORDER BY sw.scheduled_date, sw.created_at`,
    )
    .all(userId, from, to) as any[];
  return rows.map((r) => ({ id: r.id, workoutId: r.workoutId, name: r.name, date: r.date, sessionId: r.sessionId, status: r.sstatus === "completed" ? "completed" : r.sstatus === "active" ? "active" : "planned" }));
}

export function activeSession(userId: string) {
  return getDb().prepare("SELECT id, name_snapshot AS name, started_at AS startedAt FROM sessions WHERE user_id=? AND status='active'").get(userId) as { id: string; name: string; startedAt: string } | undefined;
}

export function recentSessions(userId: string, limit = 20) {
  return getDb()
    .prepare(
      `SELECT s.id, s.name_snapshot AS name, s.started_at AS startedAt, s.ended_at AS endedAt,
              (SELECT COUNT(*) FROM session_sets ss JOIN session_exercises se ON se.id=ss.session_exercise_id WHERE se.session_id=s.id AND ss.is_completed=1) AS setsDone
       FROM sessions s WHERE s.user_id=? AND s.status='completed' ORDER BY s.ended_at DESC LIMIT ?`,
    )
    .all(userId, limit) as { id: string; name: string; startedAt: string; endedAt: string; setsDone: number }[];
}

export function exerciseHistory(userId: string, exerciseId: string) {
  return getDb()
    .prepare(
      `SELECT s.id AS sessionId, s.ended_at AS endedAt, ss.actual_reps AS reps, ss.actual_weight_kg AS weightKg, ss.actual_duration_sec AS durationSec
       FROM session_sets ss JOIN session_exercises se ON se.id=ss.session_exercise_id JOIN sessions s ON s.id=se.session_id
       WHERE se.exercise_id=? AND s.user_id=? AND s.status='completed' AND ss.is_completed=1
       ORDER BY s.ended_at, ss.sort_order`,
    )
    .all(exerciseId, userId) as { sessionId: string; endedAt: string; reps: number | null; weightKg: number | null; durationSec: number | null }[];
}

export function trainedExercises(userId: string) {
  return getDb()
    .prepare(
      `SELECT e.id, e.name, COUNT(DISTINCT s.id) AS sessions
       FROM session_exercises se JOIN sessions s ON s.id=se.session_id JOIN exercises e ON e.id=se.exercise_id
       WHERE s.user_id=? AND s.status='completed'
         AND EXISTS (SELECT 1 FROM session_sets x WHERE x.session_exercise_id=se.id AND x.is_completed=1)
       GROUP BY e.id ORDER BY sessions DESC, e.name`,
    )
    .all(userId) as { id: string; name: string; sessions: number }[];
}

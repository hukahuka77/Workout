import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listWorkouts } from "@/lib/queries";
import { todayInTz } from "@/lib/dates";
import ProgramEditor from "@/components/ProgramEditor";

export default async function EditProgram({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const db = getDb();
  const p = db.prepare("SELECT id, name, default_weeks AS weeks FROM programs WHERE id=? AND user_id=? AND archived_at IS NULL").get(id, u.id) as any;
  if (!p) notFound();
  const slots = db.prepare("SELECT workout_id AS workoutId, iso_weekday AS day FROM program_workouts WHERE program_id=? AND user_id=? ORDER BY sort_order").all(id, u.id) as any[];
  return <ProgramEditor id={id} initial={{ name: p.name, weeks: p.weeks, slots }} workouts={listWorkouts(u.id).map((w) => ({ id: w.id, name: w.name }))} today={todayInTz(u.timezone)} />;
}

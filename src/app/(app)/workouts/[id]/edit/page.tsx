import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listExercises } from "@/lib/queries";
import { loadWorkout } from "@/lib/service";
import WorkoutBuilder from "@/components/WorkoutBuilder";

export default async function EditWorkout({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const w = loadWorkout(getDb(), u.id, id);
  if (!w) notFound();
  return <WorkoutBuilder initial={{ id: w.id, name: w.name, exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, imagePath: e.imagePath, sets: e.sets })) }} exercises={listExercises()} unit={u.unit} />;
}

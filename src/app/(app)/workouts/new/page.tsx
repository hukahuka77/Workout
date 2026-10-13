import { requireUser } from "@/lib/auth";
import { listExercises } from "@/lib/queries";
import WorkoutBuilder from "@/components/WorkoutBuilder";

export default async function NewWorkout() {
  const u = await requireUser();
  return <WorkoutBuilder initial={{ name: "", exercises: [] }} exercises={listExercises()} unit={u.unit} />;
}

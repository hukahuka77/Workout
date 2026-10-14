import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listExercises } from "@/lib/queries";
import { listTags, tagsByEntity } from "@/lib/tags";
import WorkoutBuilder from "@/components/WorkoutBuilder";

export default async function NewWorkout() {
  const u = await requireUser();
  return <WorkoutBuilder initial={{ name: "", exercises: [] }} exercises={listExercises()} unit={u.unit} allTags={listTags(getDb(), u.id).map((t) => t.name)} />;
}

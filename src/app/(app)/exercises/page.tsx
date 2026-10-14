import { requireUser } from "@/lib/auth";
import { listExercises, listMuscles } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { listTags, tagsByEntity } from "@/lib/tags";
import ExerciseBrowser from "@/components/ExerciseBrowser";

export default async function ExercisesPage() {
  const u = await requireUser();
  return <ExerciseBrowser exercises={listExercises()} muscles={listMuscles()} tagsByExercise={tagsByEntity(getDb(), u.id, "exercise")} allTags={listTags(getDb(), u.id).map((t) => t.name)} isAdmin={u.isAdmin} />;
}

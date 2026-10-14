import { requireUser } from "@/lib/auth";
import { listExercises, listMuscles } from "@/lib/queries";
import ExerciseBrowser from "@/components/ExerciseBrowser";

export default async function ExercisesPage() {
  const u = await requireUser();
  return <ExerciseBrowser exercises={listExercises()} muscles={listMuscles()} isAdmin={u.isAdmin} />;
}

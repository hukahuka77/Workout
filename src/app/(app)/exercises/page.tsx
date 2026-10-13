import { requireUser } from "@/lib/auth";
import { listExercises } from "@/lib/queries";
import ExerciseBrowser from "@/components/ExerciseBrowser";

export default async function ExercisesPage() {
  const u = await requireUser();
  return <ExerciseBrowser exercises={listExercises()} isAdmin={u.isAdmin} />;
}

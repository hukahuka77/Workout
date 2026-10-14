import { requireAdmin } from "@/lib/auth";
import { listExercises, listMuscles } from "@/lib/queries";
import AdminExerciseForm from "@/components/AdminExerciseForm";
import Thumb from "@/components/Thumb";

export default async function AdminExercises() {
  await requireAdmin();
  const all = listExercises(true);
  const muscles = listMuscles();
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="h1">Manage exercises</h1>
      <details className="card" open={false}>
        <summary className="p-4 font-semibold cursor-pointer min-h-11">Add exercise</summary>
        <div className="p-2"><AdminExerciseForm muscles={muscles} /></div>
      </details>
      <div className="space-y-2">
        {all.map((e) => (
          <details key={e.id} className="card">
            <summary className="p-3 flex items-center gap-3 cursor-pointer min-h-14">
              <Thumb path={e.imagePath} /><span className="font-semibold flex-1">{e.name}</span><span className="text-xs text-muted hidden sm:inline">{e.muscles.map((m) => m.name).join(", ")}</span>{!e.active && <span className="badge !bg-canvas !text-muted">Archived</span>}
            </summary>
            <div className="p-2"><AdminExerciseForm ex={e} muscles={muscles} /></div>
          </details>
        ))}
      </div>
    </div>
  );
}

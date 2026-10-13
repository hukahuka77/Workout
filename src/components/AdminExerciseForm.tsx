"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminSaveExercise } from "@/app/actions";
import type { ExerciseRow } from "@/lib/queries";

export default function AdminExerciseForm({ ex, onDone }: { ex?: ExerciseRow; onDone?: () => void }) {
  const r = useRouter();
  const [state, run, pending] = useActionState(adminSaveExercise, {} as { ok?: boolean; error?: string });
  useEffect(() => { if (state.ok) { r.refresh(); onDone?.(); } }, [state, r, onDone]);
  return (
    <form action={run} className="card p-4 space-y-3">
      {ex && <input type="hidden" name="id" value={ex.id} />}
      <label className="block"><span className="label">Name</span><input name="name" required defaultValue={ex?.name} className="input" /></label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block"><span className="label">Category</span><input name="category" required defaultValue={ex?.category ?? "Strength"} className="input" list="cats" /></label>
        <label className="block"><span className="label">Muscle</span><input name="muscle" defaultValue={ex?.muscle ?? ""} className="input" /></label>
        <label className="block"><span className="label">Equipment</span><input name="equipment" defaultValue={ex?.equipment ?? ""} className="input" /></label>
      </div>
      <datalist id="cats"><option>Strength</option><option>Mobility</option><option>Bodyweight</option><option>Cardio</option></datalist>
      <label className="block"><span className="label">Cues</span><textarea name="instructions" defaultValue={ex?.instructions ?? ""} className="input !py-2" rows={2} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Image (≤5 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" /></label>
        <label className="block"><span className="label">Video (≤40 MB)</span><input name="video" type="file" accept="video/mp4,video/webm" className="text-sm" /></label>
      </div>
      {ex && <label className="flex items-center gap-2 min-h-11"><input type="checkbox" name="active" defaultChecked={!!ex.active} className="w-5 h-5" /> Active</label>}
      {!ex && <input type="hidden" name="active" value="on" />}
      {state.error && <p className="text-danger text-sm">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{ex ? "Save" : "Add exercise"}</button>
    </form>
  );
}

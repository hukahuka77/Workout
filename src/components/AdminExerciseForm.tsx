"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminSaveExercise } from "@/app/actions";
import type { ExerciseRow, MuscleRow } from "@/lib/queries";
import { REGIONS } from "@/lib/exercise-filter";

export default function AdminExerciseForm({ ex, muscles, onDone }: { ex?: ExerciseRow; muscles: MuscleRow[]; onDone?: () => void }) {
  const r = useRouter();
  const [state, run, pending] = useActionState(adminSaveExercise, {} as { ok?: boolean; error?: string });
  useEffect(() => { if (state.ok) { r.refresh(); onDone?.(); } }, [state, r, onDone]);
  return (
    <form action={run} className="card p-4 space-y-3">
      {ex && <input type="hidden" name="id" value={ex.id} />}
      <label className="block"><span className="label">Name</span><input name="name" required defaultValue={ex?.name} className="input" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Category</span><input name="category" required defaultValue={ex?.category ?? "Strength"} className="input" list="cats" /></label>
        <label className="block"><span className="label">Equipment</span><input name="equipment" defaultValue={ex?.equipment ?? ""} className="input" /></label>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Primary muscles</legend>
        {REGIONS.map((g) => (
          <div key={g.id}>
            <div className="text-xs font-semibold uppercase text-muted mb-1">{g.label}</div>
            <div className="flex flex-wrap gap-2">
              {muscles.filter((m) => m.region === g.id).map((m) => (
                <label key={m.id} className="relative">
                  <input type="checkbox" name="muscles" value={m.id} defaultChecked={ex?.muscles.some((x) => x.id === m.id)} className="peer sr-only" />
                  <span className="inline-flex items-center min-h-10 px-3 rounded-full border border-stroke bg-surface text-sm cursor-pointer peer-checked:bg-accent peer-checked:text-white peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-soft">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
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

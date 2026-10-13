"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown, Copy, Trash2, Plus } from "lucide-react";
import Thumb from "./Thumb";
import ExercisePicker from "./ExercisePicker";
import { saveWorkoutAction } from "@/app/actions";
import { toKg, fromKg, type Unit } from "@/lib/units";
import type { ExerciseRow } from "@/lib/queries";

type SetState = { key: string; reps: string; weight: string; dur: string; rest: string };
type ExState = { key: string; exerciseId: string; name: string; imagePath: string | null; open: boolean; sets: SetState[] };

export type InitialWorkout = {
  id?: string; name: string;
  exercises: { exerciseId: string; name: string; imagePath: string | null; sets: { reps: number | null; weightKg: number | null; durationSec: number | null; restSec: number | null }[] }[];
};

const k = () => Math.random().toString(36).slice(2);
const s2 = (n: number | null) => (n == null ? "" : String(n));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export default function WorkoutBuilder({ initial, exercises, unit }: { initial: InitialWorkout; exercises: ExerciseRow[]; unit: Unit }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<ExState[]>(() =>
    initial.exercises.map((e) => ({ key: k(), exerciseId: e.exerciseId, name: e.name, imagePath: e.imagePath, open: true, sets: e.sets.map((s) => ({ key: k(), reps: s2(s.reps), weight: s.weightKg == null ? "" : String(fromKg(s.weightKg, unit)), dur: s2(s.durationSec), rest: s2(s.restSec) })) })),
  );
  const [picker, setPicker] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const edit = (fn: (x: ExState[]) => ExState[]) => { setItems(fn); setDirty(true); };
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    edit((x) => arrayMove(x, x.findIndex((i) => i.key === e.active.id), x.findIndex((i) => i.key === e.over!.id)));
  };
  const move = (idx: number, d: number) => edit((x) => (idx + d < 0 || idx + d >= x.length ? x : arrayMove(x, idx, idx + d)));
  const upd = (ek: string, fn: (e: ExState) => ExState) => edit((x) => x.map((e) => (e.key === ek ? fn(e) : e)));

  const save = () =>
    start(async () => {
      setError("");
      if (!name.trim()) return setError("Add a name");
      const payload = {
        id: initial.id, name,
        exercises: items.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets.map((s) => ({ reps: num(s.reps), weightKg: num(s.weight) == null ? null : toKg(num(s.weight)!, unit), durationSec: num(s.dur), restSec: num(s.rest) })),
        })),
      };
      if (payload.exercises.some((e) => e.sets.some((s) => s.reps == null && s.weightKg == null && s.durationSec == null))) return setError("Each set needs reps, weight or duration");
      if (payload.exercises.some((e) => e.sets.some((s) => [s.reps, s.weightKg, s.durationSec, s.restSec].some((v) => v != null && (isNaN(v) || v < 0))))) return setError("Check your numbers");
      const r = await saveWorkoutAction(payload);
      if (r.ok) { setDirty(false); router.push("/workouts"); router.refresh(); } else setError(r.error);
    });

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="h1">{initial.id ? "Edit workout" : "New workout"}</h1>
      </div>
      <label className="block"><span className="label">Name</span><input className="input" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} placeholder="Upper strength" /></label>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((ex, idx) => (
              <ExCard key={ex.key} ex={ex} idx={idx} count={items.length} unit={unit} move={move} upd={upd} remove={() => edit((x) => x.filter((i) => i.key !== ex.key))} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button className="btn w-full" onClick={() => setPicker(true)}><Plus size={18} /> Add exercise</button>
      {error && <p className="text-danger text-sm" role="alert">{error}</p>}

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:left-56 z-20 p-3 bg-canvas/95 backdrop-blur border-t border-stroke">
        <div className="mx-auto max-w-5xl flex gap-2">
          <button className="btn" onClick={() => { if (!dirty || confirm("Discard changes?")) router.push("/workouts"); }}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save workout"}</button>
        </div>
      </div>

      {picker && (
        <ExercisePicker exercises={exercises} onClose={() => setPicker(false)} onPick={(e) => edit((x) => [...x, { key: k(), exerciseId: e.id, name: e.name, imagePath: e.imagePath, open: true, sets: [{ key: k(), reps: "8", weight: "", dur: "", rest: "90" }] }])} />
      )}
    </div>
  );
}

function ExCard({ ex, idx, count, unit, move, upd, remove }: { ex: ExState; idx: number; count: number; unit: Unit; move: (i: number, d: number) => void; upd: (k: string, fn: (e: ExState) => ExState) => void; remove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.key });
  const setField = (sk: string, f: keyof SetState, v: string) => upd(ex.key, (e) => ({ ...e, sets: e.sets.map((s) => (s.key === sk ? { ...s, [f]: v } : s)) }));
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} aria-label="Drag to reorder" className="w-9 h-11 grid place-items-center text-muted touch-none cursor-grab"><GripVertical size={20} /></button>
        <Thumb path={ex.imagePath} />
        <button className="flex-1 text-left font-semibold min-w-0 truncate" onClick={() => upd(ex.key, (e) => ({ ...e, open: !e.open }))}>{idx + 1}. {ex.name}</button>
        <div className="flex flex-col">
          <button aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)} className="h-5 px-1 text-muted disabled:opacity-30"><ChevronUp size={16} /></button>
          <button aria-label="Move down" disabled={idx === count - 1} onClick={() => move(idx, 1)} className="h-5 px-1 text-muted disabled:opacity-30"><ChevronDown size={16} /></button>
        </div>
      </div>
      {ex.open && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr_2.5rem] gap-2 text-xs text-muted px-1">
            <span>#</span><span>Reps</span><span>{unit}</span><span>Sec</span><span>Rest</span><span />
          </div>
          {ex.sets.map((s, i) => (
            <div key={s.key} className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr_2.5rem] gap-2 items-center">
              <span className="text-sm text-muted text-center">{i + 1}</span>
              {(["reps", "weight", "dur", "rest"] as const).map((f) => (
                <input key={f} inputMode="decimal" className="input !px-2 text-center" aria-label={f} value={s[f]} onChange={(e) => setField(s.key, f, e.target.value)} />
              ))}
              <button aria-label="Duplicate set" className="h-11 grid place-items-center text-muted" onClick={() => upd(ex.key, (e) => ({ ...e, sets: [...e.sets.slice(0, i + 1), { ...s, key: k() }, ...e.sets.slice(i + 1)] }))}><Copy size={16} /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn flex-1 !min-h-10" onClick={() => upd(ex.key, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { reps: "8", weight: "", dur: "", rest: "90" }), key: k() }] }))}><Plus size={16} /> Add set</button>
            {ex.sets.length > 1 && <button className="btn btn-ghost !min-h-10" onClick={() => upd(ex.key, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>Remove set</button>}
            <button className="btn btn-danger !min-h-10" onClick={remove} aria-label="Remove exercise"><Trash2 size={16} /> Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

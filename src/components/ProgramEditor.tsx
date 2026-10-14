"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TagEditor from "./TagEditor";
import { saveProgramAction, startProgramAction, archiveProgramAction } from "@/app/actions";
import { WEEKDAYS, mondayOf } from "@/lib/dates";
import { Plus, X } from "lucide-react";

type W = { id: string; name: string };
type Slot = { key: string; workoutId: string; day: number };
const k = () => Math.random().toString(36).slice(2);

export default function ProgramEditor({ id, initial, workouts, today, allTags = [] }: { id?: string; initial: { name: string; weeks: number; tags?: string[]; slots: { workoutId: string; day: number }[] }; workouts: W[]; today: string; allTags?: string[] }) {
  const r = useRouter();
  const [name, setName] = useState(initial.name);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [weeks, setWeeks] = useState(String(initial.weeks));
  const [slots, setSlots] = useState<Slot[]>(initial.slots.map((s) => ({ ...s, key: k() })));
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [start, setStart] = useState(mondayOf(today));
  const [pending, run] = useTransition();
  const [runKey, setRunKey] = useState(() => crypto.randomUUID());

  const save = () => run(async () => {
    setError(""); setMsg("");
    const res = await saveProgramAction({ id, name, tags, weeks: Number(weeks), slots: slots.map((s) => ({ workoutId: s.workoutId, isoWeekday: s.day })) });
    if (res.ok) { if (!id) r.replace(`/programs/${res.id}/edit`); else { setMsg("Saved"); r.refresh(); } } else setError(res.error);
  });
  const startIt = () => run(async () => {
    setError(""); setMsg("");
    if (!id) return setError("Save the program first");
    if (new Date(start + "T00:00:00Z").getUTCDay() !== 1) return setError("Pick a Monday");
    const res = await startProgramAction(id, start, Number(weeks), runKey);
    if (res.ok) { setRunKey(crypto.randomUUID()); r.push("/calendar"); } else setError(res.error);
  });

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="h1">{id ? "Edit program" : "New program"}</h1>
      <label className="block"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Push / Pull / Legs" /></label>
      <label className="block"><span className="label">Weeks</span><input className="input" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} /></label>

      <TagEditor value={tags} suggestions={allTags} onChange={setTags} />

      <section className="space-y-2">
        <h2 className="h2">Weekly schedule</h2>
        {slots.map((s) => (
          <div key={s.key} className="card p-2 flex gap-2 items-center">
            <select className="input !w-24" value={s.day} onChange={(e) => setSlots(slots.map((x) => (x.key === s.key ? { ...x, day: Number(e.target.value) } : x)))}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
            <select className="input flex-1" value={s.workoutId} onChange={(e) => setSlots(slots.map((x) => (x.key === s.key ? { ...x, workoutId: e.target.value } : x)))}>
              {workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button aria-label="Remove" className="w-11 h-11 grid place-items-center text-muted" onClick={() => setSlots(slots.filter((x) => x.key !== s.key))}><X size={18} /></button>
          </div>
        ))}
        <button className="btn w-full" disabled={!workouts.length} onClick={() => setSlots([...slots, { key: k(), workoutId: workouts[0].id, day: Math.min(7, (slots.at(-1)?.day ?? 0) + 1) }])}><Plus size={18} /> Add workout</button>
        {!workouts.length && <p className="text-sm text-muted">Create a workout first.</p>}
      </section>

      {error && <p className="text-danger text-sm" role="alert">{error}</p>}
      {msg && <p className="text-accent text-sm">{msg}</p>}
      <button className="btn btn-primary w-full" disabled={pending} onClick={save}>Save program</button>

      {id && (
        <section className="card p-4 space-y-3">
          <h2 className="h2">Start program</h2>
          <label className="block"><span className="label">Week 1 Monday</span><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <button className="btn btn-primary w-full" disabled={pending} onClick={startIt}>Add to calendar</button>
          <p className="text-xs text-muted">Existing calendar events aren’t changed when you edit a program.</p>
          <button className="btn btn-danger w-full" onClick={() => confirm("Archive this program?") && run(async () => { await archiveProgramAction(id); r.push("/workouts"); })}>Archive program</button>
        </section>
      )}
    </div>
  );
}

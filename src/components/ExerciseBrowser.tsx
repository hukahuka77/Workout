"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import Thumb from "./Thumb";
import type { ExerciseRow, MuscleRow, Region } from "@/lib/queries";
import { matches, muscleLine, REGIONS } from "@/lib/exercise-filter";

export default function ExerciseBrowser({ exercises, muscles, isAdmin }: { exercises: ExerciseRow[]; muscles: MuscleRow[]; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [equip, setEquip] = useState("");
  const [open, setOpen] = useState<ExerciseRow | null>(null);
  const uniq = (f: (e: ExerciseRow) => string | null) => [...new Set(exercises.map(f).filter(Boolean) as string[])].sort();
  const list = useMemo(() => exercises.filter((e) => matches(e, { q, category: cat, muscle, equipment: equip, region })), [exercises, q, cat, muscle, equip, region]);
  const shownMuscles = muscles.filter((m) => !region || m.region === region);
  const sel = "input !w-auto flex-1 min-w-[7rem]";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Exercises</h1>
        {isAdmin && <Link href="/admin/exercises" className="btn">Manage</Link>}
      </div>
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input className="input pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex gap-2 flex-wrap">
        <select className={sel} value={region} onChange={(e) => { setRegion(e.target.value as Region | ""); setMuscle(""); }}><option value="">Region</option>{REGIONS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Category</option>{uniq((e) => e.category).map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={muscle} onChange={(e) => setMuscle(e.target.value)}><option value="">Muscle</option>{shownMuscles.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select className={sel} value={equip} onChange={(e) => setEquip(e.target.value)}><option value="">Equipment</option>{uniq((e) => e.equipment).map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map((e) => (
          <button key={e.id} className="card p-3 flex items-center gap-3 text-left min-h-16" onClick={() => setOpen(e)}>
            <Thumb path={e.imagePath} size={52} />
            <div className="min-w-0"><div className="font-semibold truncate">{e.name}</div><div className="text-xs text-muted truncate">{muscleLine(e) || e.category}</div></div>
          </button>
        ))}
      </div>
      {!list.length && <p className="text-center text-muted py-8">No matches</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/40" onClick={() => setOpen(null)}>
          <div className="bg-surface w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start"><h2 className="h1 !text-2xl">{open.name}</h2><button className="w-10 h-10 grid place-items-center" aria-label="Close" onClick={() => setOpen(null)}><X size={20} /></button></div>
            {open.videoPath ? <video src={`/media/${open.videoPath}`} controls playsInline className="w-full rounded-xl bg-soft" /> : open.imagePath ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${open.imagePath}`} alt="" className="w-full rounded-xl" /> : <div className="rounded-xl bg-soft aspect-video grid place-items-center"><Thumb size={64} /></div>}
            <div className="flex gap-2 flex-wrap"><span className="badge !bg-canvas !text-muted border border-stroke">{open.category}</span>{open.regions.map((g) => <span key={g} className="badge !bg-ink !text-white capitalize">{g}</span>)}{open.muscles.map((m) => <span key={m.id} className="badge">{m.name}</span>)}{open.equipment && <span className="badge">{open.equipment}</span>}</div>
            {open.instructions && <p className="text-muted">{open.instructions}</p>}
            <Link href={`/progress?ex=${open.id}`} className="btn w-full">History & PRs</Link>
          </div>
        </div>
      )}
    </div>
  );
}

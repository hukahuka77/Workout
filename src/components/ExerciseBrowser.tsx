"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import Thumb from "./Thumb";
import type { ExerciseRow } from "@/lib/queries";

export default function ExerciseBrowser({ exercises, isAdmin }: { exercises: ExerciseRow[]; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equip, setEquip] = useState("");
  const [open, setOpen] = useState<ExerciseRow | null>(null);
  const uniq = (f: (e: ExerciseRow) => string | null) => [...new Set(exercises.map(f).filter(Boolean) as string[])].sort();
  const list = useMemo(() => exercises.filter((e) => (!cat || e.category === cat) && (!muscle || e.muscle === muscle) && (!equip || e.equipment === equip) && (!q || e.name.toLowerCase().includes(q.toLowerCase()))), [exercises, q, cat, muscle, equip]);
  const sel = "input !w-auto flex-1 min-w-[7rem]";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Exercises</h1>
        {isAdmin && <Link href="/admin/exercises" className="btn">Manage</Link>}
      </div>
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input className="input pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex gap-2 flex-wrap">
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Category</option>{uniq((e) => e.category).map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={muscle} onChange={(e) => setMuscle(e.target.value)}><option value="">Muscle</option>{uniq((e) => e.muscle).map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={equip} onChange={(e) => setEquip(e.target.value)}><option value="">Equipment</option>{uniq((e) => e.equipment).map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map((e) => (
          <button key={e.id} className="card p-3 flex items-center gap-3 text-left min-h-16" onClick={() => setOpen(e)}>
            <Thumb path={e.imagePath} size={52} />
            <div className="min-w-0"><div className="font-semibold truncate">{e.name}</div><div className="text-xs text-muted truncate">{[e.category, e.muscle].filter(Boolean).join(" · ")}</div></div>
          </button>
        ))}
      </div>
      {!list.length && <p className="text-center text-muted py-8">No matches</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/40" onClick={() => setOpen(null)}>
          <div className="bg-surface w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start"><h2 className="h1 !text-2xl">{open.name}</h2><button className="w-10 h-10 grid place-items-center" aria-label="Close" onClick={() => setOpen(null)}><X size={20} /></button></div>
            {open.videoPath ? <video src={`/media/${open.videoPath}`} controls playsInline className="w-full rounded-xl bg-soft" /> : open.imagePath ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${open.imagePath}`} alt="" className="w-full rounded-xl" /> : <div className="rounded-xl bg-soft aspect-video grid place-items-center"><Thumb size={64} /></div>}
            <div className="flex gap-2 flex-wrap"><span className="badge">{open.category}</span>{open.muscle && <span className="badge">{open.muscle}</span>}{open.equipment && <span className="badge">{open.equipment}</span>}</div>
            {open.instructions && <p className="text-muted">{open.instructions}</p>}
            <Link href={`/progress?ex=${open.id}`} className="btn w-full">History & PRs</Link>
          </div>
        </div>
      )}
    </div>
  );
}

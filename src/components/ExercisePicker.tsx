"use client";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import Thumb from "./Thumb";
import type { ExerciseRow, Region } from "@/lib/queries";
import { matches, muscleLine, REGIONS } from "@/lib/exercise-filter";

export default function ExercisePicker({ exercises, onPick, onClose, multi = true }: { exercises: ExerciseRow[]; onPick: (e: ExerciseRow) => void; onClose: () => void; multi?: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const cats = useMemo(() => [...new Set(exercises.map((e) => e.category))], [exercises]);
  const list = useMemo(() => exercises.filter((e) => matches(e, { q, category: cat, region })), [exercises, q, cat, region]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/40" onClick={onClose}>
      <div className="bg-canvas w-full md:max-w-lg h-[85dvh] md:h-[80dvh] rounded-t-3xl md:rounded-3xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 space-y-3 border-b border-stroke">
          <div className="flex items-center justify-between"><h2 className="h2">Add exercise</h2><button className="btn btn-ghost !px-2" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
          <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input autoFocus className="input pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: "", label: "All" }, ...REGIONS].map((g) => (
              <button key={g.id} onClick={() => setRegion(g.id as Region | "")} className={`px-3 min-h-9 rounded-full text-sm font-semibold whitespace-nowrap border ${region === g.id ? "bg-ink text-white border-ink" : "bg-surface border-stroke text-ink"}`}>{g.label}</button>
            ))}
            <span className="w-px bg-stroke mx-1" />
            {["", ...cats].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`px-3 min-h-9 rounded-full text-sm font-medium whitespace-nowrap border ${cat === c ? "bg-accent text-white border-accent" : "bg-surface border-stroke text-muted"}`}>{c || "All"}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {list.map((e) => (
            <button key={e.id} className="card w-full flex items-center gap-3 p-3 text-left min-h-14" onClick={() => { onPick(e); if (multi) setAdded(new Set(added).add(e.id)); else onClose(); }}>
              <Thumb path={e.imagePath} />
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{e.name}</div><div className="text-xs text-muted truncate">{[muscleLine(e), e.equipment].filter(Boolean).join(" · ")}</div></div>
              {added.has(e.id) && <span className="badge">Added</span>}
            </button>
          ))}
          {!list.length && <p className="text-center text-muted py-8">No matches</p>}
        </div>
        {multi && <div className="p-3 border-t border-stroke safe-bottom"><button className="btn btn-primary w-full" onClick={onClose}>Done</button></div>}
      </div>
    </div>
  );
}

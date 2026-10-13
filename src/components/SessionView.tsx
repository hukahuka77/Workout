"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Plus, Trash2, X, ArrowLeft, Trophy } from "lucide-react";
import Thumb from "./Thumb";
import ExercisePicker from "./ExercisePicker";
import { saveSessionAction, finishSessionAction, discardSessionAction } from "@/app/actions";
import { fmtClock, fmtWeight, toKg, fromKg, type Unit } from "@/lib/units";
import type { SessionDTO } from "@/lib/service";
import type { FinishSummary } from "@/lib/service";
import type { ExerciseRow } from "@/lib/queries";

type LSet = { id: string; targetReps: number | null; targetWeightKg: number | null; targetDurationSec: number | null; reps: string; weight: string; dur: string; restSec: number | null; done: boolean; completedAt: string | null };
type LEx = { id: string; exerciseId: string; name: string; imagePath: string | null; notes: string | null; sets: LSet[] };
type Status = "saved" | "saving" | "pending" | "error" | "conflict" | "offline";

const toLocal = (s: SessionDTO, unit: Unit): LEx[] =>
  s.exercises.map((e) => ({
    id: e.id, exerciseId: e.exerciseId, name: e.name, imagePath: e.imagePath, notes: e.notes,
    sets: e.sets.map((x) => ({ id: x.id, targetReps: x.targetReps, targetWeightKg: x.targetWeightKg, targetDurationSec: x.targetDurationSec, reps: x.reps == null ? "" : String(x.reps), weight: x.weightKg == null ? "" : String(fromKg(x.weightKg, unit)), dur: x.durationSec == null ? "" : String(x.durationSec), restSec: x.restSec, done: x.done, completedAt: x.completedAt })),
  }));

const n = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));
const tmp = () => "tmp-" + Math.random().toString(36).slice(2);

export default function SessionView({ session, exercises, unit, readOnly, summary }: { session: SessionDTO; exercises: ExerciseRow[]; unit: Unit; readOnly: boolean; summary?: FinishSummary }) {
  const router = useRouter();
  const [exs, setExs] = useState<LEx[]>(() => toLocal(session, unit));
  const [notes] = useState(session.notes);
  const [status, setStatus] = useState<Status>("saved");
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const [fin, setFin] = useState<FinishSummary | null>(summary ?? null);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState<string | null>(null);

  const rev = useRef(session.revision);
  const latest = useRef(exs);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = `wk_draft_${session.id}`;

  // restore an unsynced draft from a previous interrupted page
  useEffect(() => {
    if (readOnly) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as { rev: number; exs: LEx[] };
        if (d.rev === session.revision) { setExs(d.exs); latest.current = d.exs; dirty.current = true; setStatus("pending"); schedule(0); }
        else localStorage.removeItem(draftKey);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const payload = useCallback(() => ({
    id: session.id, revision: rev.current, notes,
    exercises: latest.current.map((e) => ({
      id: e.id, exerciseId: e.exerciseId, name: e.name, notes: e.notes,
      sets: e.sets.map((s) => ({
        id: s.id, targetReps: s.targetReps, targetWeightKg: s.targetWeightKg, targetDurationSec: s.targetDurationSec,
        reps: n(s.reps), weightKg: n(s.weight) == null ? null : toKg(n(s.weight)!, unit), durationSec: n(s.dur), restSec: s.restSec,
        done: s.done, completedAt: s.completedAt,
      })),
    })),
  }), [session.id, notes, unit]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (saving.current) return false;
    if (!dirty.current) return true;
    saving.current = true; dirty.current = false; setStatus("saving");
    try {
      const res = await saveSessionAction(payload());
      if (res.ok) {
        rev.current = res.revision;
        const ids = res.ids;
        if (Object.keys(ids).length) {
          const remap = (xs: LEx[]) => xs.map((e) => ({ ...e, id: ids[e.id] ?? e.id, sets: e.sets.map((s) => ({ ...s, id: ids[s.id] ?? s.id })) }));
          latest.current = remap(latest.current);
          setExs((cur) => remap(cur));
        }
        if (dirty.current) { setStatus("pending"); schedule(300); }
        else { setStatus("saved"); try { localStorage.removeItem(draftKey); } catch {} }
        return !dirty.current;
      }
      dirty.current = true;
      if ("conflict" in res && res.conflict) setStatus("conflict"); else { setStatus("error"); setErr(("error" in res && res.error) || ""); }
      return false;
    } catch {
      dirty.current = true; setStatus(navigator.onLine ? "error" : "offline");
      return false;
    } finally { saving.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, draftKey]);

  function schedule(ms = 600) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, ms);
  }

  const edit = (fn: (x: LEx[]) => LEx[]) => {
    const next = fn(latest.current);
    latest.current = next; setExs(next);
    dirty.current = true; setStatus("pending");
    try { localStorage.setItem(draftKey, JSON.stringify({ rev: rev.current, exs: next })); } catch {}
    schedule();
  };

  // flush on blur / tab hide / back online
  useEffect(() => {
    if (readOnly) return;
    const f = () => { if (dirty.current) void flush(); };
    const vis = () => { if (document.visibilityState === "hidden") f(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", f);
    window.addEventListener("pagehide", f);
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", f); window.removeEventListener("pagehide", f); window.removeEventListener("beforeunload", warn); };
  }, [flush, readOnly]);

  const setS = (eid: string, sid: string, patch: Partial<LSet>) => edit((x) => x.map((e) => (e.id === eid ? { ...e, sets: e.sets.map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : e)));

  const toggleDone = (e: LEx, s: LSet) => {
    if (!s.done) {
      if (!((n(s.reps) ?? 0) > 0 || (n(s.dur) ?? 0) > 0)) { setShake(s.id); setTimeout(() => setShake(null), 400); return; }
      setS(e.id, s.id, { done: true, completedAt: new Date().toISOString() });
      if (s.restSec) setRest({ end: Date.now() + s.restSec * 1000, total: s.restSec });
    } else setS(e.id, s.id, { done: false, completedAt: null });
  };

  const move = (i: number, d: number) => edit((x) => { if (i + d < 0 || i + d >= x.length) return x; const c = [...x]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c; });

  const elapsed = Math.floor(((session.endedAt ? Date.parse(session.endedAt) : now) - Date.parse(session.startedAt)) / 1000);
  const doneCount = exs.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const total = exs.reduce((a, e) => a + e.sets.length, 0);
  const restLeft = rest ? Math.ceil((rest.end - now) / 1000) : 0;
  useEffect(() => { if (rest && rest.end <= now - 4000) setRest(null); }, [now, rest]);

  const finish = async () => {
    setErr("");
    if (timer.current) clearTimeout(timer.current);
    let ok = await flush();
    if (!ok && saving.current === false && dirty.current) ok = await flush();
    if (!ok) { setErr("Not saved yet — fix the connection and retry before finishing."); return; }
    const r = await finishSessionAction(session.id);
    if (r.ok) setFin(r.summary); else setErr(r.error);
  };
  const discard = async () => {
    if (!confirm("Discard this workout? Logged sets will be lost.")) return;
    const r = await discardSessionAction(session.id);
    if (r.ok) { try { localStorage.removeItem(draftKey); } catch {} router.push("/app"); router.refresh(); } else setErr(r.error);
  };

  const statusLabel = useMemo(() => ({ saved: "Saved", saving: "Saving…", pending: "Saving…", error: "Not saved", offline: "Offline — not saved", conflict: "Out of date" }[status]), [status]);

  if (fin) return <SummaryView s={fin} unit={unit} />;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur border-b border-stroke">
        <div className="mx-auto max-w-[700px] px-4 h-14 flex items-center gap-3">
          <Link href={readOnly ? "/progress" : "/app"} aria-label="Back" className="w-9 h-11 grid place-items-center text-muted"><ArrowLeft size={20} /></Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate leading-tight">{session.name}</div>
            <div className="text-xs text-muted tabular-nums">{fmtClock(elapsed)} · {doneCount}/{total} sets</div>
          </div>
          {!readOnly && (
            <>
              <span className={`text-xs font-medium ${status === "saved" ? "text-muted" : status === "saving" || status === "pending" ? "text-muted" : "text-danger"}`} aria-live="polite">{statusLabel}</span>
              {(status === "error" || status === "offline") && <button className="btn !min-h-9 !px-3 btn-danger" onClick={() => void flush()}>Retry</button>}
              <button className="btn btn-primary !min-h-10" onClick={finish}>Finish</button>
            </>
          )}
        </div>
        {rest && restLeft > 0 && (
          <div className="bg-ink text-white">
            <div className="mx-auto max-w-[700px] px-4 h-11 flex items-center justify-between">
              <span className="text-sm">Rest <b className="tabular-nums">{fmtClock(restLeft)}</b></span>
              <div className="flex gap-2 text-sm">
                <button className="underline" onClick={() => setRest({ ...rest, end: rest.end + 15000 })}>+15s</button>
                <button className="underline" onClick={() => setRest(null)}>Skip</button>
              </div>
            </div>
          </div>
        )}
      </header>

      {status === "conflict" && (
        <div className="mx-auto max-w-[700px] px-4 pt-3"><div className="card p-3 text-sm border-danger">This workout changed on another device. <button className="underline font-semibold" onClick={() => { try { localStorage.removeItem(draftKey); } catch {} location.reload(); }}>Reload</button></div></div>
      )}
      {err && <div className="mx-auto max-w-[700px] px-4 pt-3 text-danger text-sm" role="alert">{err}</div>}

      <main className="mx-auto max-w-[700px] px-4 py-4 space-y-4 pb-32">
        {exs.map((e, i) => (
          <section key={e.id} className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <Thumb path={e.imagePath} />
              <div className="flex-1 min-w-0 font-semibold truncate">{e.name}</div>
              {!readOnly && (
                <div className="flex items-center">
                  <button aria-label="Move up" disabled={i === 0} className="w-9 h-11 grid place-items-center text-muted disabled:opacity-30" onClick={() => move(i, -1)}><ChevronUp size={18} /></button>
                  <button aria-label="Move down" disabled={i === exs.length - 1} className="w-9 h-11 grid place-items-center text-muted disabled:opacity-30" onClick={() => move(i, 1)}><ChevronDown size={18} /></button>
                  <button aria-label="Remove exercise" className="w-9 h-11 grid place-items-center text-muted" onClick={() => confirm(`Remove ${e.name}?`) && edit((x) => x.filter((y) => y.id !== e.id))}><Trash2 size={17} /></button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem] gap-2 text-xs text-muted px-1">
              <span>Set</span><span>{unit}</span><span>Reps / sec</span><span />
            </div>
            {e.sets.map((s, j) => {
              const timed = s.targetDurationSec != null && s.targetReps == null;
              const target = [s.targetWeightKg != null ? `${fmtWeight(s.targetWeightKg, unit)} ${unit}` : null, s.targetReps != null ? `× ${s.targetReps}` : null, s.targetDurationSec != null ? `${s.targetDurationSec}s` : null].filter(Boolean).join(" ");
              return (
                <div key={s.id} className={`space-y-1 ${shake === s.id ? "animate-pulse" : ""}`}>
                  <div className={`grid grid-cols-[1.75rem_1fr_1fr_3.25rem] gap-2 items-center rounded-xl ${s.done ? "bg-soft/60" : ""}`}>
                    <span className="text-sm text-muted text-center">{j + 1}</span>
                    <input disabled={readOnly} inputMode="decimal" aria-label="Weight" className="input !min-h-12 text-center text-lg font-semibold" value={s.weight} onChange={(x) => setS(e.id, s.id, { weight: x.target.value })} />
                    {timed ? (
                      <input disabled={readOnly} inputMode="numeric" aria-label="Seconds" className="input !min-h-12 text-center text-lg font-semibold" value={s.dur} onChange={(x) => setS(e.id, s.id, { dur: x.target.value })} />
                    ) : (
                      <input disabled={readOnly} inputMode="numeric" aria-label="Reps" className="input !min-h-12 text-center text-lg font-semibold" value={s.reps} onChange={(x) => setS(e.id, s.id, { reps: x.target.value })} />
                    )}
                    <button disabled={readOnly} aria-label={s.done ? "Mark not done" : "Mark done"} aria-pressed={s.done} onClick={() => toggleDone(e, s)} className={`h-12 rounded-xl grid place-items-center border ${s.done ? "bg-accent border-accent text-white" : "bg-surface border-stroke text-muted"}`}><Check size={22} /></button>
                  </div>
                  {target && <div className="text-[11px] text-muted pl-9">Target {target}</div>}
                </div>
              );
            })}
            {!readOnly && (
              <div className="flex gap-2 pt-1">
                <button className="btn !min-h-10 flex-1" onClick={() => edit((x) => x.map((y) => { if (y.id !== e.id) return y; const last = y.sets.at(-1); return { ...y, sets: [...y.sets, { id: tmp(), targetReps: null, targetWeightKg: null, targetDurationSec: null, reps: last?.reps ?? "", weight: last?.weight ?? "", dur: last?.dur ?? "", restSec: last?.restSec ?? 90, done: false, completedAt: null }] }; }))}><Plus size={16} /> Add set</button>
                {e.sets.length > 0 && <button className="btn btn-ghost !min-h-10" onClick={() => edit((x) => x.map((y) => (y.id === e.id ? { ...y, sets: y.sets.slice(0, -1) } : y)))}>Remove set</button>}
              </div>
            )}
          </section>
        ))}
        {!exs.length && <div className="card p-6 text-center text-muted">Empty workout. Add an exercise to begin.</div>}
        {!readOnly && (
          <>
            <button className="btn w-full" onClick={() => setPicker(true)}><Plus size={18} /> Add exercise</button>
            <button className="btn btn-ghost w-full text-danger" onClick={discard}><X size={16} /> Discard workout</button>
          </>
        )}
      </main>

      {picker && (
        <ExercisePicker exercises={exercises} multi={false} onClose={() => setPicker(false)}
          onPick={(x) => edit((cur) => [...cur, { id: tmp(), exerciseId: x.id, name: x.name, imagePath: x.imagePath, notes: null, sets: [{ id: tmp(), targetReps: null, targetWeightKg: null, targetDurationSec: null, reps: "", weight: "", dur: "", restSec: 90, done: false, completedAt: null }] }])} />
      )}
    </div>
  );
}

function SummaryView({ s, unit }: { s: FinishSummary; unit: Unit }) {
  const mins = Math.round(s.durationSec / 60);
  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="card w-full max-w-md p-6 space-y-4 text-center">
        <div className="w-14 h-14 rounded-full bg-soft text-accent grid place-items-center mx-auto"><Check size={28} /></div>
        <h1 className="h1">Workout done</h1>
        <p className="text-muted">{s.name}</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Time" value={`${mins} min`} />
          <Stat label="Sets" value={`${s.setsDone}/${s.setsTotal}`} />
          <Stat label="Volume" value={s.volumeKg > 0 ? `${Math.round(fromKg(s.volumeKg, unit)).toLocaleString()} ${unit}` : "—"} />
        </div>
        {s.prs.length > 0 && (
          <div className="text-left space-y-2">
            <h2 className="h2 flex items-center gap-2"><Trophy size={18} className="text-accent" /> New PRs</h2>
            {s.prs.map((p, i) => <div key={i} className="flex justify-between text-sm"><span>{p.exerciseName}</span><span className="badge">{p.kind === "heaviest" ? "Heaviest" : "Est. 1RM"} {fromKg(p.valueKg, unit)} {unit}</span></div>)}
          </div>
        )}
        <Link href="/app" className="btn btn-primary w-full">Done</Link>
      </div>
    </div>
  );
}
const Stat = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-canvas p-3"><div className="font-bold">{value}</div><div className="text-xs text-muted">{label}</div></div>;

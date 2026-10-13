"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { addDays, isoWeekday, fmtDay, WEEKDAYS, parseDate, isoDate } from "@/lib/dates";
import { addScheduledAction, moveScheduledAction, removeScheduledAction } from "@/app/actions";
import StartButton from "./StartButton";
import type { ScheduledRow } from "@/lib/queries";

const dot = { planned: "bg-accent/50", active: "bg-accent", completed: "bg-accent" } as const;

export default function CalendarView({ month, today, events, workouts, hasActive }: { month: string; today: string; events: ScheduledRow[]; workouts: { id: string; name: string }[]; hasActive: boolean }) {
  const r = useRouter();
  const [sel, setSel] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [workoutId, setWorkoutId] = useState(workouts[0]?.id ?? "");
  const [moving, setMoving] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [err, setErr] = useState("");
  const [pending, run] = useTransition();

  const first = `${month}-01`;
  const start = addDays(first, -(isoWeekday(first) - 1));
  const nextMonth = isoDate(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1))).slice(0, 7);
  const prevMonth = isoDate(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1))).slice(0, 7);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const by = (d: string) => events.filter((e) => e.date === d);
  const selEvents = by(sel);

  const act = (fn: () => Promise<{ ok: boolean; error?: string } | any>) => run(async () => { setErr(""); const res = await fn(); if (!res.ok) setErr(res.error); else r.refresh(); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDate(first))}</h1>
        <div className="flex gap-1">
          <Link aria-label="Previous month" href={`/calendar?m=${prevMonth}`} className="btn !px-3"><ChevronLeft size={18} /></Link>
          <Link href="/calendar" className="btn">Today</Link>
          <Link aria-label="Next month" href={`/calendar?m=${nextMonth}`} className="btn !px-3"><ChevronRight size={18} /></Link>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_20rem] gap-4 items-start">
        <div className="card p-2">
          <div className="grid grid-cols-7 text-center text-xs text-muted pb-1">{WEEKDAYS.map((d) => <span key={d}>{d[0]}<span className="hidden md:inline">{d.slice(1)}</span></span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const ev = by(d);
              const inMonth = d.startsWith(month);
              return (
                <button key={d} onClick={() => { setSel(d); setMoving(null); setErr(""); }} className={`min-h-12 md:min-h-20 rounded-xl p-1 flex flex-col items-center md:items-start gap-1 border ${d === sel ? "border-accent bg-soft" : "border-transparent hover:bg-canvas"} ${inMonth ? "" : "opacity-40"}`}>
                  <span className={`text-sm w-7 h-7 grid place-items-center rounded-full ${d === today ? "bg-accent text-white font-bold" : ""}`}>{Number(d.slice(8))}</span>
                  <span className="hidden md:flex flex-col gap-0.5 w-full">
                    {ev.slice(0, 2).map((e) => <span key={e.id} className={`truncate text-[11px] rounded px-1 ${e.status === "completed" ? "bg-accent text-white" : "bg-soft text-accent"}`}>{e.name}</span>)}
                    {ev.length > 2 && <span className="text-[11px] text-muted">+{ev.length - 2}</span>}
                  </span>
                  <span className="md:hidden flex gap-0.5">{ev.slice(0, 3).map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${dot[e.status]}`} />)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="card p-4 space-y-3">
          <h2 className="h2">{fmtDay(sel, { weekday: "long", month: "short", day: "numeric" })}</h2>
          {selEvents.map((e) => {
            const past = e.date < today && e.status === "planned";
            return (
              <div key={e.id} className="border border-stroke rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{e.name}</span>
                  <span className={`badge ${past ? "!bg-canvas !text-muted" : ""}`}>{e.status === "completed" ? "Done" : e.status === "active" ? "In progress" : past ? "Past due" : "Planned"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.status === "completed" && e.sessionId && <Link href={`/sessions/${e.sessionId}`} className="btn !min-h-10">View</Link>}
                  {e.status === "active" && e.sessionId && <Link href={`/sessions/${e.sessionId}`} className="btn btn-primary !min-h-10">Resume</Link>}
                  {e.status === "planned" && (
                    <>
                      <StartButton scheduledId={e.id} label="Start" className="btn btn-primary !min-h-10" hasActive={hasActive} />
                      <button className="btn !min-h-10" onClick={() => { setMoving(moving === e.id ? null : e.id); setMoveDate(e.date); }}>Move</button>
                      <button className="btn btn-danger !min-h-10" disabled={pending} onClick={() => confirm("Remove this event?") && act(() => removeScheduledAction(e.id))}><X size={16} /> Remove</button>
                    </>
                  )}
                </div>
                {moving === e.id && (
                  <div className="flex gap-2">
                    <input type="date" className="input" value={moveDate} onChange={(x) => setMoveDate(x.target.value)} />
                    <button className="btn btn-primary" disabled={pending || !moveDate} onClick={() => act(async () => { const res = await moveScheduledAction(e.id, moveDate); if (res.ok) { setMoving(null); setSel(moveDate); } return res; })}>Save</button>
                  </div>
                )}
              </div>
            );
          })}
          {!selEvents.length && <p className="text-sm text-muted">Nothing planned.</p>}
          {workouts.length > 0 ? (
            <div className="flex gap-2 pt-1">
              <select className="input flex-1" value={workoutId} onChange={(e) => setWorkoutId(e.target.value)}>{workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              <button className="btn btn-primary" disabled={pending} onClick={() => act(() => addScheduledAction(workoutId, sel))}><Plus size={18} /> Add</button>
            </div>
          ) : <Link href="/workouts/new" className="btn btn-primary w-full">Create workout</Link>}
          {err && <p className="text-danger text-sm" role="alert">{err}</p>}
        </aside>
      </div>
    </div>
  );
}

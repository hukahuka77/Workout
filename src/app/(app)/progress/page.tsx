import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { recentSessions, trainedExercises, exerciseHistory } from "@/lib/queries";
import { heaviest, bestE1rm, newPRs, type SetResult } from "@/lib/pr";
import { fromKg } from "@/lib/units";
import { fmtDay, mondayOf, addDays, todayInTz } from "@/lib/dates";
import { WeeklyChart, TrendChart } from "@/components/ProgressCharts";

const RANGES = [{ k: "30", label: "30d", days: 30 }, { k: "90", label: "90d", days: 90 }, { k: "365", label: "1y", days: 365 }];

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ ex?: string; r?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const range = RANGES.find((x) => x.k === sp.r) ?? RANGES[1];
  const today = todayInTz(u.timezone);
  const since = addDays(today, -range.days);
  const trained = trainedExercises(u.id);
  const rangeLinks = (ex?: string) => (
    <div className="flex gap-2">
      {RANGES.map((x) => <Link key={x.k} href={`/progress?r=${x.k}${ex ? `&ex=${ex}` : ""}`} className={`px-3 min-h-9 inline-flex items-center rounded-full text-sm font-medium border ${x.k === range.k ? "bg-accent text-white border-accent" : "bg-surface border-stroke text-muted"}`}>{x.label}</Link>)}
    </div>
  );

  if (sp.ex) {
    const hist = exerciseHistory(u.id, sp.ex);
    const name = trained.find((t) => t.id === sp.ex)?.name ?? "Exercise";
    const byDate = new Map<string, { date: string; sets: SetResult[] }>();
    for (const h of hist) {
      const g = byDate.get(h.sessionId) ?? { date: h.endedAt.slice(0, 10), sets: [] };
      g.sets.push({ reps: h.reps, weightKg: h.weightKg });
      byDate.set(h.sessionId, g);
    }
    const sessions = [...byDate.values()];
    const trend = sessions.filter((s) => s.date >= since).map((s) => ({ date: s.date.slice(5), load: heaviest(s.sets) == null ? null : fromKg(heaviest(s.sets)!, u.unit), e1rm: bestE1rm(s.sets) == null ? null : Math.round(fromKg(bestE1rm(s.sets)!, u.unit)) }));
    const all = hist.map((h) => ({ reps: h.reps, weightKg: h.weightKg }));
    const bestLoad = heaviest(all), bestE = bestE1rm(all);
    return (
      <div className="space-y-5">
        <Link href="/progress" className="text-accent text-sm font-semibold">← Progress</Link>
        <h1 className="h1">{name}</h1>
        {rangeLinks(sp.ex)}
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-4"><div className="text-xs text-muted">Best weight</div><div className="text-xl font-bold">{bestLoad ? `${fromKg(bestLoad, u.unit)} ${u.unit}` : "—"}</div></div>
          <div className="card p-4"><div className="text-xs text-muted">Est. 1RM</div><div className="text-xl font-bold">{bestE ? `${Math.round(fromKg(bestE, u.unit))} ${u.unit}` : "—"}</div></div>
        </div>
        {trend.some((t) => t.load != null) ? <div className="card p-3"><TrendChart data={trend} unit={u.unit} /></div> : <div className="card p-5 text-muted text-center">No loaded sets in this range.</div>}
        <section className="space-y-2">
          <h2 className="h2">Recent sessions</h2>
          {sessions.slice(-6).reverse().map((s, i) => (
            <div key={i} className="card p-3"><div className="text-sm font-semibold">{fmtDay(s.date)}</div><div className="text-sm text-muted">{s.sets.map((x) => `${x.weightKg != null ? fromKg(x.weightKg, u.unit) : "BW"}×${x.reps ?? "–"}`).join("  ")}</div></div>
          ))}
        </section>
      </div>
    );
  }

  const sess = recentSessions(u.id, 400);
  const weeks = new Map<string, number>();
  for (let w = mondayOf(since); w <= today; w = addDays(w, 7)) weeks.set(w, 0);
  for (const s of sess) { const m = mondayOf(s.endedAt.slice(0, 10)); if (weeks.has(m)) weeks.set(m, weeks.get(m)! + 1); }
  const weekly = [...weeks].map(([w, c]) => ({ week: w.slice(5), sessions: c }));
  const inRange = sess.filter((s) => s.endedAt.slice(0, 10) >= since).length;

  // latest PRs: for each trained exercise, did its most recent session beat earlier ones?
  const prs: { exId: string; name: string; date: string; label: string }[] = [];
  for (const t of trained) {
    const hist = exerciseHistory(u.id, t.id);
    const groups = new Map<string, { date: string; sets: SetResult[] }>();
    for (const h of hist) { const g = groups.get(h.sessionId) ?? { date: h.endedAt.slice(0, 10), sets: [] }; g.sets.push({ reps: h.reps, weightKg: h.weightKg }); groups.set(h.sessionId, g); }
    const arr = [...groups.values()];
    for (let i = arr.length - 1; i >= 1; i--) {
      const p = newPRs(arr[i].sets, arr.slice(0, i).flatMap((x) => x.sets));
      if (p.length) { prs.push({ exId: t.id, name: t.name, date: arr[i].date, label: `${p[0].kind === "heaviest" ? "Heaviest" : "Est. 1RM"} ${Math.round(fromKg(p[0].valueKg, u.unit))} ${u.unit}` }); break; }
    }
  }
  prs.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <h1 className="h1">Progress</h1>
      {rangeLinks()}
      <div className="grid md:grid-cols-2 gap-4">
        <section className="card p-4 space-y-2"><div className="flex justify-between"><h2 className="h2">Sessions per week</h2><span className="badge">{inRange} total</span></div><WeeklyChart data={weekly} /></section>
        <section className="space-y-2">
          <h2 className="h2">Latest PRs</h2>
          {prs.slice(0, 5).map((p) => <Link key={p.exId} href={`/progress?ex=${p.exId}`} className="card p-3 flex justify-between items-center"><span className="font-medium">{p.name}</span><span className="badge">{p.label}</span></Link>)}
          {!prs.length && <div className="card p-4 text-muted text-sm">PRs show up once you beat a previous best.</div>}
        </section>
      </div>
      <section className="space-y-2">
        <h2 className="h2">Recent workouts</h2>
        {sess.slice(0, 8).map((s) => <Link key={s.id} href={`/sessions/${s.id}`} className="card p-3 flex justify-between"><span className="font-medium">{s.name}</span><span className="text-sm text-muted">{s.setsDone} sets · {fmtDay(s.endedAt.slice(0, 10))}</span></Link>)}
        {!sess.length && <div className="card p-5 text-center text-muted">No finished workouts yet.</div>}
      </section>
      {trained.length > 0 && (
        <section className="space-y-2"><h2 className="h2">Exercises</h2><div className="flex flex-wrap gap-2">{trained.map((t) => <Link key={t.id} href={`/progress?ex=${t.id}`} className="px-3 min-h-10 inline-flex items-center rounded-full border border-stroke bg-surface text-sm">{t.name}</Link>)}</div></section>
      )}
    </div>
  );
}

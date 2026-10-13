import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { scheduledBetween, activeSession, recentSessions } from "@/lib/queries";
import { todayInTz, addDays, fmtDay } from "@/lib/dates";
import StartButton from "@/components/StartButton";
import { Play } from "lucide-react";

export default async function HomePage() {
  const u = await requireUser();
  const today = todayInTz(u.timezone);
  const active = activeSession(u.id);
  const upcoming = scheduledBetween(u.id, today, addDays(today, 14)).filter((s) => s.status !== "completed");
  const todays = upcoming.filter((s) => s.date === today);
  const next = upcoming.filter((s) => s.date > today).slice(0, 3);
  const last = recentSessions(u.id, 1)[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-muted text-sm">{fmtDay(today, { weekday: "long", month: "short", day: "numeric" })}</p>
        <h1 className="h1">{greet}{u.displayName ? `, ${u.displayName.split(" ")[0]}` : ""}</h1>
      </header>

      {active ? (
        <section className="card p-5 space-y-3 border-accent">
          <span className="badge w-fit">In progress</span>
          <h2 className="h2">{active.name}</h2>
          <Link href={`/sessions/${active.id}`} className="btn btn-primary w-full"><Play size={18} /> Resume workout</Link>
        </section>
      ) : todays.length ? (
        todays.map((s) => (
          <section key={s.id} className="card p-5 space-y-3">
            <span className="badge w-fit">Today</span>
            <h2 className="h2">{s.name}</h2>
            <StartButton scheduledId={s.id} className="btn btn-primary w-full" />
          </section>
        ))
      ) : (
        <section className="card p-5 space-y-3">
          <h2 className="h2">Nothing scheduled today</h2>
          <div className="flex gap-2 flex-wrap">
            <StartButton label="Empty workout" className="btn btn-primary" />
            <Link href="/workouts" className="btn">Pick a workout</Link>
          </div>
        </section>
      )}

      {next.length > 0 && (
        <section className="space-y-2">
          <h2 className="h2">Upcoming</h2>
          {next.map((s) => (
            <Link key={s.id} href="/calendar" className="card p-4 flex justify-between items-center">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted text-sm">{fmtDay(s.date)}</span>
            </Link>
          ))}
        </section>
      )}

      {last ? (
        <section className="space-y-2">
          <h2 className="h2">Last workout</h2>
          <Link href={`/sessions/${last.id}`} className="card p-4 flex justify-between items-center">
            <span className="font-medium">{last.name}</span>
            <span className="text-muted text-sm">{last.setsDone} sets · {fmtDay(last.endedAt.slice(0, 10))}</span>
          </Link>
        </section>
      ) : (
        !active && (
          <section className="card p-5 text-center space-y-3">
            <p className="text-muted">Build your first workout to get started.</p>
            <Link href="/workouts/new" className="btn btn-primary">Create workout</Link>
          </section>
        )
      )}
    </div>
  );
}

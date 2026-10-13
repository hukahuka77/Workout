import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listWorkouts, listPrograms, activeSession } from "@/lib/queries";
import StartButton from "@/components/StartButton";
import WorkoutRowActions from "@/components/WorkoutRowActions";
import { Plus } from "lucide-react";

export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const u = await requireUser();
  const showArchived = (await searchParams).archived === "1";
  const workouts = listWorkouts(u.id, showArchived);
  const programs = listPrograms(u.id);
  const hasActive = !!activeSession(u.id);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Workouts</h1>
        <Link href="/workouts/new" className="btn btn-primary"><Plus size={18} /> New</Link>
      </div>
      <div className="flex gap-2">
        <Link href="/workouts" className={`px-3 min-h-9 inline-flex items-center rounded-full text-sm font-medium border ${!showArchived ? "bg-accent text-white border-accent" : "bg-surface border-stroke text-muted"}`}>Active</Link>
        <Link href="/workouts?archived=1" className={`px-3 min-h-9 inline-flex items-center rounded-full text-sm font-medium border ${showArchived ? "bg-accent text-white border-accent" : "bg-surface border-stroke text-muted"}`}>Archived</Link>
      </div>
      <section className="space-y-2">
        {workouts.map((w) => (
          <div key={w.id} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/workouts/${w.id}/edit`} className="min-w-0">
                <div className="font-semibold truncate">{w.name}</div>
                <div className="text-sm text-muted">{w.exerciseCount} exercises · {w.setCount} sets</div>
              </Link>
              {!showArchived && <StartButton workoutId={w.id} label="Start" hasActive={hasActive} className="btn btn-primary !min-h-10" />}
            </div>
            <div className="flex justify-between items-center">
              <Link href={`/workouts/${w.id}/edit`} className="text-accent text-sm font-semibold px-1">Edit</Link>
              <WorkoutRowActions id={w.id} archived={showArchived} />
            </div>
          </div>
        ))}
        {!workouts.length && <div className="card p-6 text-center text-muted">{showArchived ? "Nothing archived." : "No workouts yet. Create your first one."}</div>}
      </section>
      {!showArchived && (
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h2 className="h2">Programs</h2><Link href="/programs/new" className="text-accent font-semibold text-sm">New program</Link></div>
          {programs.map((p) => (
            <Link key={p.id} href={`/programs/${p.id}/edit`} className="card p-4 flex justify-between items-center">
              <span className="font-semibold">{p.name}</span>
              <span className="text-sm text-muted">{p.weeks} wks · {p.slotCount} days/wk</span>
            </Link>
          ))}
          {!programs.length && <div className="card p-4 text-muted text-sm">Group workouts into a weekly program and put it on your calendar.</div>}
        </section>
      )}
    </div>
  );
}

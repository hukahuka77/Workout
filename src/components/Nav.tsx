"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Dumbbell, TrendingUp, Settings, Library } from "lucide-react";

const items = [
  { href: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { href: "/workouts", label: "Workouts", icon: Dumbbell, match: (p: string) => p.startsWith("/workouts") || p.startsWith("/programs") },
  { href: "/progress", label: "Progress", icon: TrendingUp, match: (p: string) => p.startsWith("/progress") },
];

export default function Nav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const p = usePathname();
  return (
    <>
      {/* desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col border-r border-stroke bg-surface p-4 gap-1">
        <div className="text-accent font-bold tracking-wide px-3 py-3">WORKOUT</div>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`flex items-center gap-3 px-3 min-h-11 rounded-xl font-medium ${i.match(p) ? "bg-soft text-accent" : "text-muted hover:bg-canvas"}`}>
            <i.icon size={18} /> {i.label}
          </Link>
        ))}
        <Link href="/exercises" className={`flex items-center gap-3 px-3 min-h-11 rounded-xl font-medium ${p.startsWith("/exercises") || p.startsWith("/admin") ? "bg-soft text-accent" : "text-muted hover:bg-canvas"}`}><Library size={18} /> Exercises</Link>
        <div className="mt-auto">
          <Link href="/settings" className="flex items-center gap-3 px-3 min-h-11 rounded-xl text-muted hover:bg-canvas"><Settings size={18} /> {name || "Settings"}</Link>
        </div>
      </aside>
      {/* mobile top-right icon */}
      <Link href="/settings" aria-label="Settings" className="md:hidden fixed top-3 right-3 z-30 w-11 h-11 grid place-items-center rounded-full bg-surface border border-stroke text-muted"><Settings size={20} /></Link>
      {/* mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-stroke safe-bottom">
        <div className="grid grid-cols-4">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={`flex flex-col items-center justify-center gap-0.5 min-h-14 text-[11px] font-medium ${i.match(p) ? "text-accent" : "text-muted"}`}>
              <i.icon size={22} /> {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

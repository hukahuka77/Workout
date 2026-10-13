import { requireUser } from "@/lib/auth";
import { listWorkouts, scheduledBetween, activeSession } from "@/lib/queries";
import { todayInTz, addDays, isoWeekday } from "@/lib/dates";
import CalendarView from "@/components/CalendarView";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const u = await requireUser();
  const today = todayInTz(u.timezone);
  const m = (await searchParams).m;
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7);
  const first = `${month}-01`;
  const from = addDays(first, -(isoWeekday(first) - 1));
  const events = scheduledBetween(u.id, from, addDays(from, 41));
  return <CalendarView key={month} month={month} today={today} events={events} workouts={listWorkouts(u.id).map((w) => ({ id: w.id, name: w.name }))} hasActive={!!activeSession(u.id)} />;
}

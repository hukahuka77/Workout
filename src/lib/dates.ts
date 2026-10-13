/** All planned days are plain YYYY-MM-DD strings; math is done in UTC to avoid day shifts. */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const parseDate = (s: string) => new Date(s + "T00:00:00Z");

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** ISO weekday: Mon=1 … Sun=7. */
export function isoWeekday(s: string) {
  const d = parseDate(s).getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOf(s: string) {
  return addDays(s, -(isoWeekday(s) - 1));
}

export function todayInTz(tz: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return isoDate(now);
  }
}

export type Slot = { id: string; workoutId: string; isoWeekday: number };

/** Materialize dated occurrences for a repeating-week program. */
export function expandProgram(slots: Slot[], startMonday: string, weeks: number) {
  const out: { slotId: string; workoutId: string; date: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const s of slots) {
      out.push({ slotId: s.id, workoutId: s.workoutId, date: addDays(startMonday, w * 7 + (s.isoWeekday - 1)) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function fmtDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(parseDate(s));
}

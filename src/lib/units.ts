export type Unit = "lb" | "kg";
const LB_PER_KG = 2.2046226218;

export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const kgToLb = (kg: number) => kg * LB_PER_KG;

/** Convert a value typed in the user's unit to canonical kg. */
export function toKg(value: number, unit: Unit) {
  return unit === "lb" ? lbToKg(value) : value;
}

/** Convert canonical kg to the user's unit, rounded to 0.1 for display. */
export function fromKg(kg: number, unit: Unit) {
  const v = unit === "lb" ? kgToLb(kg) : kg;
  return Math.round(v * 10) / 10;
}

export function fmtWeight(kg: number | null | undefined, unit: Unit) {
  if (kg == null) return "";
  return String(fromKg(kg, unit));
}

export function fmtDuration(sec: number | null | undefined) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export function fmtClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(2, "0");
  const sss = String(ss).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${sss}` : `${mm}:${sss}`;
}

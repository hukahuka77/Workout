import type { ExerciseRow, Region } from "./queries";

export const REGIONS: { id: Region; label: string }[] = [
  { id: "upper", label: "Upper" },
  { id: "lower", label: "Lower" },
  { id: "core", label: "Core" },
];

export type Filters = { q: string; region: Region | ""; muscle: string; category: string; equipment: string };

export function matches(e: ExerciseRow, f: Partial<Filters>) {
  if (f.region && !e.regions.includes(f.region)) return false;
  if (f.muscle && !e.muscles.some((m) => m.id === f.muscle)) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.equipment && e.equipment !== f.equipment) return false;
  if (f.q) {
    const hay = `${e.name} ${e.equipment ?? ""} ${e.category} ${e.muscles.map((m) => `${m.name} ${m.region}`).join(" ")}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  return true;
}

export const muscleLine = (e: ExerciseRow) => e.muscles.map((m) => m.name).join(", ");

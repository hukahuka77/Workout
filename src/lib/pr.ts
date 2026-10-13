export type SetResult = { reps: number | null; weightKg: number | null };

/** Estimated 1RM per spec: 1 rep = weight; 2-10 reps = w * (1 + reps/30). */
export function e1rm(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || weightKg <= 0 || !reps || reps < 1 || reps > 10) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export function heaviest(sets: SetResult[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if ((s.reps ?? 0) >= 1 && (s.weightKg ?? 0) > 0) best = Math.max(best ?? 0, s.weightKg!);
  }
  return best;
}

export function bestE1rm(sets: SetResult[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const v = e1rm(s.weightKg, s.reps);
    if (v != null) best = Math.max(best ?? 0, v);
  }
  return best;
}

export type NewPR = { kind: "heaviest" | "e1rm"; valueKg: number };

/** Compare this session's completed sets for one exercise against earlier ones. */
export function newPRs(current: SetResult[], earlier: SetResult[]): NewPR[] {
  const out: NewPR[] = [];
  const h = heaviest(current);
  const hPrev = heaviest(earlier);
  if (h != null && hPrev != null && h > hPrev + 1e-9) out.push({ kind: "heaviest", valueKg: h });
  const e = bestE1rm(current);
  const ePrev = bestE1rm(earlier);
  if (e != null && ePrev != null && e > ePrev + 1e-9) out.push({ kind: "e1rm", valueKg: e });
  return out;
}

/** Sum(weight*reps) for completed loaded sets. */
export function volumeKg(sets: SetResult[]): number {
  return sets.reduce((a, s) => ((s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0 ? a + s.weightKg! * s.reps! : a), 0);
}

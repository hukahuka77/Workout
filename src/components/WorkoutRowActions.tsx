"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cloneWorkoutAction, archiveWorkoutAction } from "@/app/actions";

export default function WorkoutRowActions({ id, archived }: { id: string; archived: boolean }) {
  const r = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); r.refresh(); });
  return (
    <div className="flex gap-1">
      {!archived && <button className="btn btn-ghost !min-h-10 !px-3" disabled={pending} onClick={() => run(() => cloneWorkoutAction(id))}>Clone</button>}
      <button className="btn btn-ghost !min-h-10 !px-3" disabled={pending} onClick={() => run(() => archiveWorkoutAction(id, !archived))}>{archived ? "Restore" : "Archive"}</button>
    </div>
  );
}

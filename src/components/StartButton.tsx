"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startSessionAction } from "@/app/actions";

export default function StartButton({ workoutId, scheduledId, label = "Start workout", className = "btn btn-primary", hasActive = false }: { workoutId?: string; scheduledId?: string; label?: string; className?: string; hasActive?: boolean }) {
  const r = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button
        className={className}
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (hasActive && !confirm("You have a workout in progress. Resume it instead?")) return;
            const res = await startSessionAction({ workoutId, scheduledId });
            if (res.ok) r.push(`/sessions/${res.id}`);
            else setErr(res.error);
          })
        }
      >
        {pending ? "Starting…" : label}
      </button>
      {err && <span className="text-danger text-sm">{err}</span>}
    </>
  );
}

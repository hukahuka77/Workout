"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameTagAction, deleteTagAction } from "@/app/actions";

export default function TagManager({ tags }: { tags: { id: string; name: string; uses: number }[] }) {
  const r = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [pending, run] = useTransition();
  if (!tags.length) return <p className="text-sm text-muted">No tags yet. Add them from the Exercises, Workouts or Programs screens.</p>;
  return (
    <div className="space-y-2">
      {tags.map((t) => (
        <div key={t.id} className="card p-2 flex items-center gap-2">
          {editing === t.id ? (
            <>
              <input className="input" value={name} maxLength={30} autoFocus onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-primary !min-h-10" disabled={pending} onClick={() => run(async () => { const res = await renameTagAction(t.id, name); if (res.ok) { setEditing(null); setErr(""); r.refresh(); } else setErr(res.error); })}>Save</button>
              <button className="btn !min-h-10" onClick={() => setEditing(null)}>Cancel</button>
            </>
          ) : (
            <>
              <span className="flex-1 pl-2 font-medium">{t.name} <span className="text-xs text-muted font-normal">· {t.uses} {t.uses === 1 ? "item" : "items"}</span></span>
              <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => { setEditing(t.id); setName(t.name); setErr(""); }}>Rename</button>
              <button className="btn btn-ghost !min-h-10 !px-3 text-danger" disabled={pending} onClick={() => confirm(`Delete “${t.name}”? It will be removed from ${t.uses} item(s).`) && run(async () => { await deleteTagAction(t.id); r.refresh(); })}>Delete</button>
            </>
          )}
        </div>
      ))}
      {err && <p className="text-danger text-sm" role="alert">{err}</p>}
    </div>
  );
}

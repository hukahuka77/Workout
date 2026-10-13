"use client";
import { useState, useTransition } from "react";
import { saveSettings, logoutAction } from "@/app/actions";

export default function SettingsForm({ initial, email }: { initial: { displayName: string; unit: "lb" | "kg"; timezone: string }; email: string }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, run] = useTransition();
  const tzs = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [initial.timezone];
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="h1">Settings</h1>
      <p className="text-sm text-muted">{email}</p>
      <label className="block"><span className="label">Display name</span><input className="input" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} /></label>
      <div>
        <span className="label">Units</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {(["lb", "kg"] as const).map((u) => <button key={u} onClick={() => setV({ ...v, unit: u })} className={`btn ${v.unit === u ? "btn-primary" : ""}`}>{u}</button>)}
        </div>
      </div>
      <label className="block"><span className="label">Timezone</span>
        <select className="input" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })}>{[...new Set([v.timezone, ...tzs])].map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      {msg && <p className="text-sm text-accent">{msg}</p>}
      <button className="btn btn-primary w-full" disabled={pending} onClick={() => run(async () => { const r = await saveSettings(v); setMsg(r.ok ? "Saved" : r.error); })}>Save</button>
      <form action={logoutAction}><button className="btn w-full">Sign out</button></form>
    </div>
  );
}

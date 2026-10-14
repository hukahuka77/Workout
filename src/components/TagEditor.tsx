"use client";
import { useState } from "react";
import { X } from "lucide-react";

/** Controlled tag input: type a name and press Enter/comma to add; tap × to remove. */
export default function TagEditor({ value, onChange, suggestions, label = "Tags" }: { value: string[]; onChange: (next: string[]) => void; suggestions: string[]; label?: string }) {
  const [text, setText] = useState("");
  const has = (n: string) => value.some((v) => v.toLowerCase() === n.toLowerCase());
  const add = (raw: string) => {
    const n = raw.trim().replace(/\s+/g, " ").slice(0, 30);
    setText("");
    if (n && !has(n) && value.length < 20) onChange([...value, suggestions.find((s) => s.toLowerCase() === n.toLowerCase()) ?? n]);
  };
  const hints = suggestions.filter((s) => !has(s) && (!text || s.toLowerCase().includes(text.toLowerCase()))).slice(0, 8);
  return (
    <div className="space-y-2">
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 min-h-9 pl-3 pr-1 rounded-full bg-soft text-accent text-sm font-medium">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="w-8 h-8 grid place-items-center rounded-full" onClick={() => onChange(value.filter((v) => v !== t))}><X size={14} /></button>
          </span>
        ))}
      </div>
      <input
        className="input"
        placeholder="Add a tag…"
        value={text}
        maxLength={30}
        enterKeyHint="done"
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(text); } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => text.trim() && add(text)}
      />
      {hints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hints.map((s) => <button key={s} type="button" className="px-3 min-h-9 rounded-full border border-stroke bg-surface text-sm text-muted" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

export function TagChips({ tags }: { tags?: { id: string; name: string }[] }) {
  if (!tags?.length) return null;
  return <div className="flex flex-wrap gap-1">{tags.map((t) => <span key={t.id} className="rounded-full bg-soft text-accent text-[11px] font-semibold px-2 py-0.5">{t.name}</span>)}</div>;
}

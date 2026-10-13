"use client";
import { useActionState } from "react";
import Link from "next/link";

type Action = (s: unknown, fd: FormData) => Promise<{ error?: string }>;

export default function AuthForm({ mode, action }: { mode: "login" | "signup"; action: Action }) {
  const [state, run, pending] = useActionState(action, {} as { error?: string });
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York";
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <form action={run} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <div className="text-accent font-bold tracking-wide text-sm">WORKOUT</div>
          <h1 className="h1">{mode === "login" ? "Welcome back" : "Create account"}</h1>
        </div>
        {mode === "signup" && (
          <label className="block"><span className="label">Name</span><input name="name" className="input" autoComplete="name" /></label>
        )}
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
        <label className="block"><span className="label">Password</span><input name="password" type="password" required minLength={mode === "signup" ? 8 : 1} className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        <input type="hidden" name="tz" value={tz} />
        {state?.error && <p className="text-danger text-sm" role="alert">{state.error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>{mode === "login" ? "Sign in" : "Create account"}</button>
        <p className="text-sm text-muted text-center">
          {mode === "login" ? <>New here? <Link className="text-accent font-semibold" href="/signup">Create account</Link></> : <>Have an account? <Link className="text-accent font-semibold" href="/login">Sign in</Link></>}
        </p>
      </form>
    </main>
  );
}

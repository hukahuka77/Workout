# Workout

Mobile-first workout tracker: Exercise → Workout → Program → Calendar → Session. Runs entirely on your own machine (Next.js + SQLite) and is reachable over Tailscale. Based on the product/technical spec (Supabase/Vercel swapped for local SQLite + cookie auth).

## Run

```bash
npm install
npm run build
npm start            # http://0.0.0.0:3000
```

Open `http://<your-tailscale-ip-or-magicdns-name>:3000` on your phone (Safari → Share → Add to Home Screen for the PWA).
Dev mode: `npm run dev`.

- The **first account created becomes admin** (exercise manager at `/admin/exercises`). After you've signed up, set `DISABLE_SIGNUP=1` to close registration.
- Data: SQLite at `data/workout.db` (override with `DATABASE_PATH`); uploaded exercise media in `data/media`. Back these up. Both are git-ignored.
- ~50 exercises are seeded automatically on first start.
- Canonical weight unit in the DB is kg; display is lb/kg per user setting.

## Notes
- Auth: email + password, httpOnly cookie sessions. No email verification/reset (local install).
- Every query is scoped by the signed-in user id; child tables use composite FKs `(parent_id, user_id)`.
- Session autosave uses a revision number; stale writes are rejected, failed saves show "Not saved / Retry".
- PRs are computed from completed sets (no stored PR table).

## Tests
`npm test` (units, isolation between users, program generation, session snapshot/prefill/PR logic) and `npm run typecheck`.

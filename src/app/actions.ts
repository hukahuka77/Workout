"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDb, uid } from "@/lib/db";
import { COOKIE, requireUser, requireAdmin } from "@/lib/auth";
import { createUser, verifyLogin, createAuthSession, hashToken } from "@/lib/auth-core";
import * as svc from "@/lib/service";
import { mediaDir } from "@/lib/media";
import * as tagsvc from "@/lib/tags";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof svc.AppError ? e.message : e instanceof z.ZodError ? "Invalid input" : "Something went wrong" });

/* ---------- auth ---------- */
async function setCookie(userId: string) {
  const { token, expires } = createAuthSession(getDb(), userId);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires, secure: false });
}

export async function loginAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const id = verifyLogin(getDb(), String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (!id) return { error: "Wrong email or password" };
  await setCookie(id);
  redirect("/app");
}

export async function signupAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  if (process.env.DISABLE_SIGNUP === "1") return { error: "Signup is disabled" };
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().max(60) }).safeParse({
    email: fd.get("email"), password: fd.get("password"), name: fd.get("name") ?? "",
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of 8+ characters" };
  const tz = String(fd.get("tz") || "America/New_York");
  let id: string;
  try { id = createUser(getDb(), parsed.data.email, parsed.data.password, parsed.data.name, tz); }
  catch { return { error: "That email is already registered" }; }
  await setCookie(id);
  redirect("/app");
}

export async function logoutAction() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (t) getDb().prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(hashToken(t));
  c.delete(COOKIE);
  redirect("/login");
}

export async function saveSettings(input: { displayName: string; unit: "lb" | "kg"; timezone: string }): Promise<Result> {
  const u = await requireUser();
  try {
    const v = z.object({ displayName: z.string().max(60), unit: z.enum(["lb", "kg"]), timezone: z.string().max(64) }).parse(input);
    try { new Intl.DateTimeFormat("en-US", { timeZone: v.timezone }); } catch { return { ok: false, error: "Unknown timezone" }; }
    getDb().prepare("UPDATE profiles SET display_name=?, preferred_unit=?, timezone=? WHERE id=?").run(v.displayName, v.unit, v.timezone, u.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) { return fail(e); }
}

/* ---------- workouts / programs ---------- */
const setSchema = z.object({
  reps: z.number().int().min(0).nullable(), weightKg: z.number().min(0).nullable(),
  durationSec: z.number().int().min(0).nullable(), restSec: z.number().int().min(0).nullable(),
});
const workoutSchema = z.object({
  id: z.string().optional(), tags: z.array(z.string().max(60)).max(20).optional(), name: z.string().min(1).max(80), description: z.string().max(500).nullish(),
  exercises: z.array(z.object({ exerciseId: z.string(), notes: z.string().max(500).nullish(), sets: z.array(setSchema).max(30) })).max(40),
});

export async function saveWorkoutAction(input: unknown): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  try {
    const id = svc.saveWorkout(getDb(), u.id, workoutSchema.parse(input));
    revalidatePath("/workouts");
    return { ok: true, id };
  } catch (e) { return fail(e); }
}
export async function cloneWorkoutAction(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  try { const n = svc.cloneWorkout(getDb(), u.id, id); revalidatePath("/workouts"); return { ok: true, id: n }; } catch (e) { return fail(e); }
}
export async function archiveWorkoutAction(id: string, archived: boolean): Promise<Result> {
  const u = await requireUser();
  try { svc.setWorkoutArchived(getDb(), u.id, id, archived); revalidatePath("/workouts"); return { ok: true }; } catch (e) { return fail(e); }
}
export async function saveProgramAction(input: unknown): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  try {
    const v = z.object({
      id: z.string().optional(), tags: z.array(z.string().max(60)).max(20).optional(), name: z.string().min(1).max(80), description: z.string().max(500).nullish(), weeks: z.number().int().min(1).max(52),
      slots: z.array(z.object({ workoutId: z.string(), isoWeekday: z.number().int().min(1).max(7) })).max(60),
    }).parse(input);
    const id = svc.saveProgram(getDb(), u.id, v);
    revalidatePath("/programs");
    return { ok: true, id };
  } catch (e) { return fail(e); }
}
export async function archiveProgramAction(id: string): Promise<Result> {
  const u = await requireUser();
  getDb().prepare("UPDATE programs SET archived_at=? WHERE id=? AND user_id=?").run(new Date().toISOString(), id, u.id);
  revalidatePath("/programs");
  return { ok: true };
}
export async function startProgramAction(programId: string, startMonday: string, weeks: number, key: string): Promise<Result> {
  const u = await requireUser();
  try {
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(startMonday);
    svc.startProgram(getDb(), u.id, programId, startMonday, weeks, key);
    revalidatePath("/calendar");
    return { ok: true };
  } catch (e) { return fail(e); }
}

/* ---------- calendar ---------- */
const dateS = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export async function addScheduledAction(workoutId: string, date: string): Promise<Result> {
  const u = await requireUser();
  try { svc.addScheduled(getDb(), u.id, workoutId, dateS.parse(date)); revalidatePath("/calendar"); revalidatePath("/app"); return { ok: true }; } catch (e) { return fail(e); }
}
export async function moveScheduledAction(id: string, date: string): Promise<Result> {
  const u = await requireUser();
  try { svc.moveScheduled(getDb(), u.id, id, dateS.parse(date)); revalidatePath("/calendar"); revalidatePath("/app"); return { ok: true }; } catch (e) { return fail(e); }
}
export async function removeScheduledAction(id: string): Promise<Result> {
  const u = await requireUser();
  try { svc.removeScheduled(getDb(), u.id, id); revalidatePath("/calendar"); revalidatePath("/app"); return { ok: true }; } catch (e) { return fail(e); }
}

/* ---------- sessions ---------- */
export async function startSessionAction(opts: { workoutId?: string; scheduledId?: string }): Promise<Result<{ id: string; resumed: boolean }>> {
  const u = await requireUser();
  try { const r = svc.startSession(getDb(), u.id, opts); revalidatePath("/app"); return { ok: true, ...r }; } catch (e) { return fail(e); }
}
export async function saveSessionAction(input: svc.SaveSessionInput): Promise<svc.SaveResult | { ok: false; error: string; conflict?: undefined }> {
  const u = await requireUser();
  try { return svc.saveSession(getDb(), u.id, input); } catch (e) { return fail(e); }
}
export async function finishSessionAction(id: string): Promise<Result<{ summary: svc.FinishSummary }>> {
  const u = await requireUser();
  try { const summary = svc.finishSession(getDb(), u.id, id); revalidatePath("/", "layout"); return { ok: true, summary }; } catch (e) { return fail(e); }
}
export async function discardSessionAction(id: string): Promise<Result> {
  const u = await requireUser();
  try { svc.discardSession(getDb(), u.id, id); revalidatePath("/", "layout"); return { ok: true }; } catch (e) { return fail(e); }
}

/* ---------- admin exercises ---------- */
const MAX_IMG = 5 * 1024 * 1024, MAX_VID = 40 * 1024 * 1024;
const IMG = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>;
const VID = { "video/mp4": "mp4", "video/webm": "webm" } as Record<string, string>;

async function saveMedia(file: File | null, kind: "image" | "video"): Promise<string | null | "bad"> {
  if (!file || file.size === 0) return null;
  const ext = (kind === "image" ? IMG : VID)[file.type];
  if (!ext || file.size > (kind === "image" ? MAX_IMG : MAX_VID)) return "bad";
  fs.mkdirSync(mediaDir(), { recursive: true });
  const name = `${uid()}.${ext}`;
  fs.writeFileSync(path.join(mediaDir(), name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function adminSaveExercise(_: unknown, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const db = getDb();
  try {
    const v = z.object({
      id: z.string().optional(), name: z.string().min(1).max(80), category: z.string().min(1).max(40),
      muscles: z.array(z.string()).max(12), equipment: z.string().max(40).optional(), instructions: z.string().max(600).optional(),
    }).parse({ id: fd.get("id") || undefined, name: fd.get("name"), category: fd.get("category"), muscles: fd.getAll("muscles").map(String), equipment: fd.get("equipment") ?? "", instructions: fd.get("instructions") ?? "" });
    const img = await saveMedia(fd.get("image") as File | null, "image");
    const vid = await saveMedia(fd.get("video") as File | null, "video");
    if (img === "bad" || vid === "bad") return { error: "Images: JPEG/PNG/WebP ≤5 MB. Videos: MP4/WebM ≤40 MB." };
    const active = fd.get("active") === "on" ? 1 : 0;
    const valid = new Set((db.prepare("SELECT id FROM muscles").all() as { id: string }[]).map((m) => m.id));
    if (v.muscles.some((m) => !valid.has(m))) return { error: "Unknown muscle" };
    if (!v.muscles.length) return { error: "Pick at least one muscle" };
    let exId = v.id;
    if (v.id) {
      db.prepare(`UPDATE exercises SET name=?, category=?, equipment=?, instructions=?, active=?, updated_at=?,
                  image_path=COALESCE(?, image_path), video_path=COALESCE(?, video_path) WHERE id=?`)
        .run(v.name, v.category, v.equipment || null, v.instructions || null, active, new Date().toISOString(), img, vid, v.id);
    } else {
      exId = uid();
      db.prepare("INSERT INTO exercises (id,name,category,equipment,instructions,image_path,video_path,active) VALUES (?,?,?,?,?,?,?,1)")
        .run(exId, v.name, v.category, v.equipment || null, v.instructions || null, img, vid);
    }
    db.transaction(() => {
      db.prepare("DELETE FROM exercise_muscles WHERE exercise_id=?").run(exId);
      for (const m of v.muscles) db.prepare("INSERT INTO exercise_muscles (exercise_id, muscle_id) VALUES (?,?)").run(exId, m);
    })();
    revalidatePath("/exercises"); revalidatePath("/admin/exercises");
    return { ok: true };
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) return { error: "An exercise with that name already exists" };
    return { error: "Check the fields and try again" };
  }
}

/* ---------- tags ---------- */
export async function setTagsAction(type: "exercise" | "workout" | "program", entityId: string, names: string[]): Promise<Result<{ tags: tagsvc.Tag[] }>> {
  const u = await requireUser();
  try {
    z.enum(["exercise", "workout", "program"]).parse(type);
    const tags = tagsvc.setTags(getDb(), u.id, type, entityId, z.array(z.string()).max(40).parse(names));
    revalidatePath("/exercises"); revalidatePath("/workouts"); revalidatePath("/settings");
    return { ok: true, tags };
  } catch (e) { return fail(e); }
}
export async function renameTagAction(id: string, name: string): Promise<Result> {
  const u = await requireUser();
  try { tagsvc.renameTag(getDb(), u.id, id, name); revalidatePath("/", "layout"); return { ok: true }; } catch (e) { return fail(e); }
}
export async function deleteTagAction(id: string): Promise<Result> {
  const u = await requireUser();
  try { tagsvc.deleteTag(getDb(), u.id, id); revalidatePath("/", "layout"); return { ok: true }; } catch (e) { return fail(e); }
}

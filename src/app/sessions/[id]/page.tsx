import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { loadSession, summarizeSession } from "@/lib/service";
import { listExercises } from "@/lib/queries";
import SessionView from "@/components/SessionView";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const db = getDb();
  const s = loadSession(db, u.id, id);
  if (!s || s.status === "discarded") notFound();
  const readOnly = s.status !== "active";
  return <SessionView session={s} exercises={listExercises()} unit={u.unit} readOnly={readOnly} summary={undefined} />;
}

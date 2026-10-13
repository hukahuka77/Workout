import { requireUser } from "@/lib/auth";
import { listWorkouts } from "@/lib/queries";
import { todayInTz } from "@/lib/dates";
import ProgramEditor from "@/components/ProgramEditor";

export default async function NewProgram() {
  const u = await requireUser();
  return <ProgramEditor initial={{ name: "", weeks: 8, slots: [] }} workouts={listWorkouts(u.id).map((w) => ({ id: w.id, name: w.name }))} today={todayInTz(u.timezone)} />;
}

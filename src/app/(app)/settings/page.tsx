import { requireUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const u = await requireUser();
  return <SettingsForm email={u.email} initial={{ displayName: u.displayName, unit: u.unit, timezone: u.timezone }} />;
}

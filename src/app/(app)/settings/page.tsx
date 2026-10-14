import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listTags } from "@/lib/tags";
import SettingsForm from "@/components/SettingsForm";
import TagManager from "@/components/TagManager";

export default async function SettingsPage() {
  const u = await requireUser();
  return (
    <div className="space-y-8">
      <SettingsForm email={u.email} initial={{ displayName: u.displayName, unit: u.unit, timezone: u.timezone }} />
      <section className="max-w-md space-y-3">
        <h2 className="h2">My tags</h2>
        <TagManager tags={listTags(getDb(), u.id)} />
      </section>
    </div>
  );
}

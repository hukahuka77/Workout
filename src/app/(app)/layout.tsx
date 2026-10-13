import { requireUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  return (
    <div className="min-h-dvh">
      <Nav name={u.displayName} isAdmin={u.isAdmin} />
      <main className="md:pl-56 pb-24 md:pb-8">
        <div className="mx-auto max-w-5xl px-4 pt-16 md:pt-5">{children}</div>
      </main>
    </div>
  );
}

import { listSubmissions } from "@/lib/submissions";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SubmissionsTable } from "@/components/submissions-table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="mt-4 text-muted-foreground">
          Supabase isn&apos;t configured yet — set{" "}
          <code className="rounded bg-muted px-1">SUPABASE_URL</code> and{" "}
          <code className="rounded bg-muted px-1">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          to see switch-request submissions here.
        </p>
      </main>
    );
  }

  const submissions = await listSubmissions();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-bold">Submissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {submissions.length} total (all brokers)
      </p>
      <SubmissionsTable
        submissions={submissions}
        endpoint="/api/admin/submissions"
        showBroker
      />
    </main>
  );
}

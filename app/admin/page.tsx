import { listSubmissions } from "@/lib/submissions";
import { isSupabaseConfigured } from "@/lib/supabase";
import { StatusSelect } from "@/components/admin/status-select";
import { Badge } from "@/components/ui/badge";

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
        {submissions.length} total
      </p>

      {submissions.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Submitted</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Switching</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {new Date(s.submittedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {s.firstName} {s.lastName}
                    <div className="text-xs text-muted-foreground">
                      {s.street}, {s.postcode} {s.city}
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <div>{s.email}</div>
                    {s.phone && (
                      <div className="text-xs text-muted-foreground">
                        {s.phone}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <Badge variant="secondary">{s.currentInsurerName}</Badge>
                    {" → "}
                    <Badge>{s.newInsurerName}</Badge>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    CHF {s.premium}/mo
                    <div className="text-xs text-muted-foreground">
                      Deductible CHF {s.deductible}
                    </div>
                  </td>
                  <td className="p-3">
                    <StatusSelect id={s.id} status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

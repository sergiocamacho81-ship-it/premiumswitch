import { StatusSelect } from "@/components/status-select";
import { Badge } from "@/components/ui/badge";
import type { SubmissionRecord } from "@/lib/submissions";

export function SubmissionsTable({
  submissions,
  endpoint,
  showBroker = false,
}: {
  submissions: SubmissionRecord[];
  endpoint: string;
  showBroker?: boolean;
}) {
  if (submissions.length === 0) {
    return <p className="mt-8 text-muted-foreground">No submissions yet.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="p-3 font-medium">Submitted</th>
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium">Contact</th>
            <th className="p-3 font-medium">Switching</th>
            <th className="p-3 font-medium">Plan</th>
            {showBroker && <th className="p-3 font-medium">Broker</th>}
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
                  <div className="text-xs text-muted-foreground">{s.phone}</div>
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
              {showBroker && (
                <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                  {s.brokerId ? s.brokerId.slice(0, 8) : "Direct"}
                </td>
              )}
              <td className="p-3">
                <StatusSelect id={s.id} status={s.status} endpoint={endpoint} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

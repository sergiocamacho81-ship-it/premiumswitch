import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getCurrentBroker } from "@/lib/brokers";
import { listSubmissionsForBroker } from "@/lib/submissions";
import { SubmissionsTable } from "@/components/submissions-table";
import { LogoutButton } from "@/components/broker/logout-button";
import { BrandingSettings } from "@/components/broker/branding-settings";
import { ComparisonForm } from "@/components/comparison-form";
import enMessages from "@/messages/en.json";

export const dynamic = "force-dynamic";

export default async function BrokerDashboardPage() {
  const [broker, submissions, headersList] = await Promise.all([
    getCurrentBroker(),
    listSubmissionsForBroker(),
    headers(),
  ]);

  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const publicUrlBase = `${protocol}://${host}/en`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {broker?.companyName ?? "Your dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {broker?.contactEmail}
          </p>
        </div>
        <LogoutButton />
      </div>

      <section className="mb-12">
        <BrandingSettings
          initialSlug={broker?.slug ?? ""}
          initialLogoUrl={broker?.logoUrl ?? ""}
          initialColor={broker?.primaryColor ?? ""}
          publicUrlBase={publicUrlBase}
        />
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">Compare a client&apos;s premium</h2>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ComparisonForm brokerId={broker?.id} />
        </NextIntlClientProvider>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Your submissions</h2>
        <p className="text-sm text-muted-foreground">
          {submissions.length} total
        </p>
        <SubmissionsTable
          submissions={submissions}
          endpoint="/api/broker/submissions"
        />
      </section>
    </main>
  );
}

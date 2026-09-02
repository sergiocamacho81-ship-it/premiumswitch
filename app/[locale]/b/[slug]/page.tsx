import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComparisonForm } from "@/components/comparison-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getPublicBrokerBySlug, type PublicBrokerProfile } from "@/lib/brokers";
import meta from "@/data/meta.json";

// Without this, Next.js's default fetch caching (which also wraps the
// fetch calls @supabase/supabase-js makes internally) would cache the
// broker-by-slug lookup indefinitely — a broker changing their slug or
// branding would keep serving the old data until some unrelated cache
// invalidation happened to occur.
export const dynamic = "force-dynamic";

export default async function BrokerPublicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const broker = await getPublicBrokerBySlug(slug);
  if (!broker) notFound();

  return <BrokerPageContent broker={broker} />;
}

function BrokerPageContent({ broker }: { broker: PublicBrokerProfile }) {
  const t = useTranslations();

  const themeStyle = broker.primaryColorHsl
    ? ({
        "--primary": broker.primaryColorHsl,
        "--ring": broker.primaryColorHsl,
      } as React.CSSProperties)
    : undefined;

  return (
    <main
      style={themeStyle}
      className="mx-auto max-w-2xl px-4 py-12 sm:py-16"
    >
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher />
      </div>

      <div className="mb-10 space-y-4 text-center">
        {broker.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={broker.logoUrl}
            alt={broker.companyName}
            className="mx-auto max-h-16 max-w-[240px] object-contain"
          />
        ) : (
          <p className="text-lg font-semibold">{broker.companyName}</p>
        )}
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          {t("brokerPage.tagline", { company: broker.companyName })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          {t("hero.subtitle")}
        </p>
      </div>

      <ComparisonForm brokerId={broker.id} />

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        {t.rich("footer.text", {
          link: (chunks) => (
            <a
              href="https://opendata.swiss/en/dataset/health-insurance-premiums"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {chunks}
            </a>
          ),
        })}
        {" · "}
        {t("hero.eyebrow", { year: meta.premiumYear })}
      </footer>
    </main>
  );
}

import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ComparisonForm } from "@/components/comparison-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import meta from "@/data/meta.json";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher />
      </div>

      <div className="mb-10 space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          {t("hero.eyebrow", { year: meta.premiumYear })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          {t("hero.subtitle")}
        </p>
      </div>

      <ComparisonForm />

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
      </footer>
    </main>
  );
}

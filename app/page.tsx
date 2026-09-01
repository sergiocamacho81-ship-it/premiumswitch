import { ComparisonForm } from "@/components/comparison-form";
import meta from "@/data/meta.json";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="mb-10 space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Official Priminfo data · {meta.premiumYear}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Find your cheapest health insurance in 60 seconds
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Compare every Swiss health insurer using official government
          premium data. No spam, no sales calls — just the numbers.
        </p>
      </div>

      <ComparisonForm />

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        Premium data from the{" "}
        <a
          href="https://opendata.swiss/en/dataset/health-insurance-premiums"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Federal Office of Public Health (BAG)
        </a>
        . PremiumSwitch is not affiliated with any insurer.
      </footer>
    </main>
  );
}

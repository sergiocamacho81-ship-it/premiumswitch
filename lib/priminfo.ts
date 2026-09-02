import premiums from "@/data/premiums.json";
import insurers from "@/data/insurers.json";
import regions from "@/data/regions.json";
import marketShare from "@/data/market-share.json";
import { ageToAgeClass, getAvailableDeductibles, type AgeClass } from "@/lib/ageClass";

export { ageToAgeClass, getAvailableDeductibles };

type AccidentInclusion = "MIT" | "OHN";

type PremiumTable = Record<
  string, // kanton
  Record<
    string, // region
    Record<
      AgeClass,
      Record<
        AccidentInclusion,
        Record<string, Record<string, number>> // franchise -> insurerCode -> premium
      >
    >
  >
>;

type RegionCandidate = {
  kanton: string;
  region: string;
  gemeinde: string;
  ort: string;
};

type RegionEntry = {
  primary: RegionCandidate;
  ambiguous: boolean;
  candidates?: RegionCandidate[];
};

const premiumTable = premiums as unknown as PremiumTable;
const insurerTable = insurers as Record<string, { name: string; place: string }>;
const regionTable = regions as Record<string, RegionEntry>;
const marketShareTable = marketShare as Record<string, Record<string, number>>;

export type ComparisonInput = {
  postcode: string;
  birthYear: number;
  deductible: number;
  withAccident?: boolean;
  currentPremium?: number;
};

export type ComparisonErrorCode =
  | "postcodeInvalid"
  | "postcodeNotFound"
  | "birthYearInvalid"
  | "deductibleRequired"
  | "deductibleInvalidOptions";

export type ComparisonError = {
  field: "postcode" | "birthYear" | "deductible";
  code: ComparisonErrorCode;
  params?: Record<string, string>;
};

export type InsurerOption = {
  insurerCode: string;
  insurerName: string;
  premium: number;
  monthlySavingsVsCurrent: number | null;
  annualSavingsVsCurrent: number | null;
  badges: Array<"cheapest" | "best-value" | "most-popular">;
};

export type ComparisonResult = {
  kanton: string;
  region: string;
  ageClass: AgeClass;
  ambiguousPostcode: boolean;
  options: InsurerOption[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateComparisonInput(
  input: Partial<ComparisonInput>
): ComparisonError[] {
  const errors: ComparisonError[] = [];
  const currentYear = new Date().getFullYear();

  if (!input.postcode || !/^[1-9]\d{3}$/.test(input.postcode)) {
    errors.push({ field: "postcode", code: "postcodeInvalid" });
  } else if (!regionTable[input.postcode]) {
    errors.push({ field: "postcode", code: "postcodeNotFound" });
  }

  if (
    !input.birthYear ||
    input.birthYear < currentYear - 120 ||
    input.birthYear > currentYear
  ) {
    errors.push({ field: "birthYear", code: "birthYearInvalid" });
  }

  if (
    input.deductible == null ||
    Number.isNaN(input.deductible) ||
    input.deductible < 0
  ) {
    errors.push({ field: "deductible", code: "deductibleRequired" });
  } else if (input.birthYear) {
    const ageClass = ageToAgeClass(input.birthYear);
    const validDeductibles = getAvailableDeductibles(ageClass);
    if (!validDeductibles.includes(input.deductible)) {
      errors.push({
        field: "deductible",
        code: "deductibleInvalidOptions",
        params: { options: validDeductibles.join(", ") },
      });
    }
  }

  return errors;
}

export function getCheapestInsurers(
  input: ComparisonInput,
  limit = 3
): ComparisonResult | null {
  const regionEntry = regionTable[input.postcode];
  if (!regionEntry) return null;

  const { kanton, region } = regionEntry.primary;
  const ageClass = ageToAgeClass(input.birthYear);
  const accident: AccidentInclusion = input.withAccident === false ? "OHN" : "MIT";

  const franchiseTable =
    premiumTable[kanton]?.[region]?.[ageClass]?.[accident] ?? {};
  const rows = franchiseTable[String(input.deductible)] ?? {};

  const rowsWithMarketShare = Object.entries(rows).map(([insurerCode, premium]) => ({
    insurerCode,
    premium,
    share: marketShareTable[kanton]?.[insurerCode] ?? 0,
  }));

  rowsWithMarketShare.sort((a, b) => a.premium - b.premium);

  const shares = rowsWithMarketShare.map((r) => r.share).sort((a, b) => a - b);
  const medianShare = shares[Math.floor(shares.length / 2)] ?? 0;

  const cheapestCode = rowsWithMarketShare[0]?.insurerCode;
  const mostPopularCode = [...rowsWithMarketShare].sort(
    (a, b) => b.share - a.share
  )[0]?.insurerCode;
  const bestValueCode = rowsWithMarketShare.find((r) => r.share >= medianShare)
    ?.insurerCode;

  const options: InsurerOption[] = rowsWithMarketShare.slice(0, limit).map((r) => {
    const badges: InsurerOption["badges"] = [];
    if (r.insurerCode === cheapestCode) badges.push("cheapest");
    if (r.insurerCode === bestValueCode && r.insurerCode !== cheapestCode)
      badges.push("best-value");
    if (r.insurerCode === mostPopularCode) badges.push("most-popular");

    const monthlySavingsVsCurrent =
      input.currentPremium != null
        ? round2(input.currentPremium - r.premium)
        : null;

    return {
      insurerCode: r.insurerCode,
      insurerName: insurerTable[r.insurerCode]?.name ?? `Insurer ${r.insurerCode}`,
      premium: round2(r.premium),
      monthlySavingsVsCurrent,
      annualSavingsVsCurrent:
        monthlySavingsVsCurrent != null ? round2(monthlySavingsVsCurrent * 12) : null,
      badges,
    };
  });

  return {
    kanton,
    region,
    ageClass,
    ambiguousPostcode: regionEntry.ambiguous,
    options,
  };
}

import meta from "@/data/meta.json";

export type AgeClass = "KIN" | "JUG" | "ERW";

export function ageToAgeClass(birthYear: number): AgeClass {
  const age = meta.premiumYear - birthYear;
  if (age <= 18) return "KIN";
  if (age <= 25) return "JUG";
  return "ERW";
}

export function getAvailableDeductibles(ageClass: AgeClass): number[] {
  return meta.deductiblesByAgeClass[ageClass] ?? [];
}

export const AGE_CLASS_LABEL: Record<AgeClass, string> = {
  KIN: "Child",
  JUG: "Young adult",
  ERW: "Adult",
};

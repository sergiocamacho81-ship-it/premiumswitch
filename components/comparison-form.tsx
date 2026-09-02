"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, TrendingDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ageToAgeClass, getAvailableDeductibles } from "@/lib/ageClass";
import { SwitchRequestForm } from "@/components/switch-request-form";
import type { ComparisonResult, ComparisonError } from "@/lib/priminfo";

const BADGE_KEY: Record<string, string> = {
  cheapest: "cheapest",
  "best-value": "bestValue",
  "most-popular": "mostPopular",
};

const BADGE_VARIANT: Record<string, "default" | "secondary"> = {
  cheapest: "default",
  "best-value": "secondary",
  "most-popular": "secondary",
};

export function ComparisonForm({ brokerId }: { brokerId?: string } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const [postcode, setPostcode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [currentPremium, setCurrentPremium] = useState("");
  const [deductible, setDeductible] = useState("300");
  const [fieldErrors, setFieldErrors] = useState<Record<string, ComparisonError>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [switchRequested, setSwitchRequested] = useState(false);

  const deductibleOptions = useMemo(() => {
    const year = Number(birthYear);
    const ageClass =
      birthYear.length === 4 && !Number.isNaN(year)
        ? ageToAgeClass(year)
        : "ERW";
    return getAvailableDeductibles(ageClass);
  }, [birthYear]);

  function errorText(err: ComparisonError): string {
    return t(`errors.${err.code}`, err.params);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setGeneralError(null);
    setSwitchRequested(false);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode,
          birthYear: Number(birthYear),
          deductible: Number(deductible),
          currentPremium: currentPremium ? Number(currentPremium) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errors: Record<string, ComparisonError> = {};
        (data.errors as ComparisonError[]).forEach((err) => {
          errors[err.field] = err;
        });
        setFieldErrors(errors);
        setResult(null);
        return;
      }

      setResult(data as ComparisonResult);
    } catch {
      setGeneralError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("form.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">{t("form.postcode")}</Label>
                <Input
                  id="postcode"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="8001"
                  value={postcode}
                  onChange={(e) =>
                    setPostcode(e.target.value.replace(/\D/g, ""))
                  }
                  required
                />
                {fieldErrors.postcode && (
                  <p className="text-sm text-destructive">
                    {errorText(fieldErrors.postcode)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthYear">{t("form.birthYear")}</Label>
                <Input
                  id="birthYear"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1990"
                  value={birthYear}
                  onChange={(e) =>
                    setBirthYear(e.target.value.replace(/\D/g, ""))
                  }
                  required
                />
                {fieldErrors.birthYear && (
                  <p className="text-sm text-destructive">
                    {errorText(fieldErrors.birthYear)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPremium">
                  {t("form.currentPremium")}
                </Label>
                <Input
                  id="currentPremium"
                  inputMode="decimal"
                  placeholder={t("form.currentPremiumPlaceholder")}
                  value={currentPremium}
                  onChange={(e) =>
                    setCurrentPremium(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deductible">{t("form.deductible")}</Label>
                <Select value={deductible} onValueChange={setDeductible}>
                  <SelectTrigger id="deductible">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {deductibleOptions.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t("form.deductibleOption", { amount: d })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.deductible && (
                  <p className="text-sm text-destructive">
                    {errorText(fieldErrors.deductible)}
                  </p>
                )}
              </div>
            </div>

            {generalError && (
              <Alert variant="destructive">
                <AlertDescription>{generalError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> {t("form.submitting")}
                </>
              ) : (
                t("form.submit")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.ambiguousPostcode && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{t("form.ambiguousPostcode")}</AlertDescription>
            </Alert>
          )}

          {result.options.length === 0 ? (
            <Alert>
              <AlertDescription>{t("form.noResults")}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {result.options.map((option, i) => (
                <Card key={option.insurerCode}>
                  <CardContent className="flex items-center justify-between gap-4 pt-6">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">
                          {i + 1}. {option.insurerName}
                        </span>
                        {option.badges.map((b) => (
                          <Badge key={b} variant={BADGE_VARIANT[b]}>
                            {t(`badges.${BADGE_KEY[b]}`)}
                          </Badge>
                        ))}
                      </div>
                      {option.monthlySavingsVsCurrent != null &&
                        option.monthlySavingsVsCurrent > 0 && (
                          <p className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-500">
                            <TrendingDown className="h-4 w-4" />
                            {t("results.save", {
                              monthly: option.monthlySavingsVsCurrent,
                              yearly: option.annualSavingsVsCurrent ?? 0,
                            })}
                          </p>
                        )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        CHF {option.premium}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("results.perMonth")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.options.length > 0 && (
            <Card className="border-primary">
              <CardContent className="space-y-3 pt-6">
                {switchRequested ? (
                  <SwitchRequestForm
                    options={result.options}
                    deductible={Number(deductible)}
                    locale={locale}
                    brokerId={brokerId}
                    onCancel={() => setSwitchRequested(false)}
                  />
                ) : (
                  <div className="space-y-3 text-center">
                    <h3 className="text-lg font-semibold">{t("cta.title")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("cta.subtitle")}
                    </p>
                    <Button onClick={() => setSwitchRequested(true)}>
                      {t("cta.button")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

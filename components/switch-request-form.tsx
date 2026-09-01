"use client";

import { useState } from "react";
import { Loader2, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import insurers from "@/data/insurers.json";
import type { InsurerOption } from "@/lib/priminfo";

type Props = {
  options: InsurerOption[];
  deductible: number;
  onCancel: () => void;
};

type SubmitResult = {
  cancellationLetter: string;
  applicationSummary: string;
  cancellationDeadline: string;
  effectiveDate: string;
};

const insurerNames = Object.values(insurers as Record<string, { name: string }>)
  .map((i) => i.name)
  .sort((a, b) => a.localeCompare(b));

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SwitchRequestForm({ options, deductible, onCancel }: Props) {
  const [newInsurerName, setNewInsurerName] = useState(
    options[0]?.insurerName ?? ""
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [street, setStreet] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentInsurerName, setCurrentInsurerName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const selectedOption = options.find((o) => o.insurerName === newInsurerName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setGeneralError(null);

    try {
      const res = await fetch("/api/switch-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          birthDate,
          street,
          postcode,
          city,
          email,
          phone: phone || undefined,
          currentInsurerName,
          newInsurerName,
          premium: selectedOption?.premium,
          deductible,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errors: Record<string, string> = {};
        (data.errors as Array<{ field: string; message: string }>).forEach(
          (err) => {
            errors[err.field] = err.message;
          }
        );
        setFieldErrors(errors);
        return;
      }

      setResult(data as SubmitResult);
    } catch {
      setGeneralError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const dateOpts: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    };
    const deadline = new Date(result.cancellationDeadline).toLocaleDateString(
      "en-GB",
      dateOpts
    );
    const effective = new Date(result.effectiveDate).toLocaleDateString(
      "en-GB",
      dateOpts
    );

    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600 dark:text-green-500" />
        <h3 className="text-lg font-semibold">Request received</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ve drafted your cancellation letter (effective {deadline})
          and your new application for {newInsurerName} (starting {effective}).
          No payment has been taken yet — our team will contact you at{" "}
          {email} to confirm details and arrange the CHF 49 fee before
          anything is sent to insurers.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() =>
              downloadText("cancellation-letter.txt", result.cancellationLetter)
            }
          >
            <Download /> Cancellation letter
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadText("application-summary.txt", result.applicationSummary)
            }
          >
            <Download /> Application summary
          </Button>
        </div>
        <details className="text-left text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Preview cancellation letter
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs">
            {result.cancellationLetter}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div className="space-y-2">
        <Label htmlFor="newInsurer">Switch to</Label>
        <Select value={newInsurerName} onValueChange={setNewInsurerName}>
          <SelectTrigger id="newInsurer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.insurerCode} value={o.insurerName}>
                {o.insurerName} — CHF {o.premium}/mo
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          {fieldErrors.firstName && (
            <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          {fieldErrors.lastName && (
            <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Date of birth</Label>
        <Input
          id="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
        />
        {fieldErrors.birthDate && (
          <p className="text-sm text-destructive">{fieldErrors.birthDate}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">Street and number</Label>
        <Input
          id="street"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          required
        />
        {fieldErrors.street && (
          <p className="text-sm text-destructive">{fieldErrors.street}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="switchPostcode">Postcode</Label>
          <Input
            id="switchPostcode"
            inputMode="numeric"
            maxLength={4}
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.replace(/\D/g, ""))}
            required
          />
          {fieldErrors.postcode && (
            <p className="text-sm text-destructive">{fieldErrors.postcode}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          {fieldErrors.city && (
            <p className="text-sm text-destructive">{fieldErrors.city}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {fieldErrors.email && (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentInsurer">Current insurer</Label>
        <Select
          value={currentInsurerName}
          onValueChange={setCurrentInsurerName}
        >
          <SelectTrigger id="currentInsurer">
            <SelectValue placeholder="Select your current insurer" />
          </SelectTrigger>
          <SelectContent>
            {insurerNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.currentInsurerName && (
          <p className="text-sm text-destructive">
            {fieldErrors.currentInsurerName}
          </p>
        )}
      </div>

      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Sending...
            </>
          ) : (
            "Send my switch request"
          )}
        </Button>
      </div>
    </form>
  );
}

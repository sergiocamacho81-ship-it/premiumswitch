import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  validateSwitchRequest,
  generateCancellationLetter,
  generateApplicationSummary,
  getSwitchDates,
  type SwitchRequestInput,
} from "@/lib/switchRequest";
import { saveSubmission } from "@/lib/submissions";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  readJsonWithLimit,
  tooManyRequestsResponse,
  payloadTooLargeResponse,
} from "@/lib/requestGuards";
import { routing, type AppLocale } from "@/i18n/routing";

function parseLocale(value: unknown): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

const DOCUMENTS_DIR = path.join(process.cwd(), "documents");
const MAX_BODY_BYTES = 20_000;

export async function POST(request: Request) {
  // Submitting personal details to switch insurers is a rare, deliberate
  // action for a real user — a much tighter limit than /api/compare.
  const rateLimit = await checkRateLimit(
    `switch-request:${getClientIp(request)}`,
    5,
    3600
  );
  if (!rateLimit.allowed) return tooManyRequestsResponse(3600);

  const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === "too_large") return payloadTooLargeResponse();
    return NextResponse.json(
      { errors: [{ field: "form", code: "invalidBody" }] },
      { status: 400 }
    );
  }

  const raw = parsed.data as Record<string, unknown>;
  const locale = parseLocale(raw.locale);
  const input: Partial<SwitchRequestInput> = {
    firstName: String(raw.firstName ?? "").trim(),
    lastName: String(raw.lastName ?? "").trim(),
    birthDate: String(raw.birthDate ?? "").trim(),
    street: String(raw.street ?? "").trim(),
    postcode: String(raw.postcode ?? "").trim(),
    city: String(raw.city ?? "").trim(),
    email: String(raw.email ?? "").trim(),
    phone: raw.phone ? String(raw.phone).trim() : undefined,
    currentInsurerName: String(raw.currentInsurerName ?? "").trim(),
    policyNumber: raw.policyNumber ? String(raw.policyNumber).trim() : undefined,
    newInsurerName: String(raw.newInsurerName ?? "").trim(),
    premium: Number(raw.premium),
    deductible: Number(raw.deductible),
  };

  const errors = validateSwitchRequest(input);
  if (errors.length) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const validInput = input as SwitchRequestInput;
  const now = new Date();
  const { cancellationDeadline, effectiveDate } = getSwitchDates(now);
  const cancellationLetter = generateCancellationLetter(validInput, now, locale);
  const applicationSummary = generateApplicationSummary(validInput, now, locale);

  const saved = await saveSubmission({
    ...validInput,
    cancellationLetter,
    applicationSummary,
  });
  const id = saved?.id ?? randomUUID();

  const submissionDir = path.join(DOCUMENTS_DIR, id);
  try {
    await mkdir(submissionDir, { recursive: true });
    await Promise.all([
      writeFile(
        path.join(submissionDir, "cancellation-letter.txt"),
        cancellationLetter
      ),
      writeFile(
        path.join(submissionDir, "application-summary.txt"),
        applicationSummary
      ),
      writeFile(
        path.join(submissionDir, "submission.json"),
        JSON.stringify(
          {
            id,
            submittedAt: saved?.submittedAt ?? now.toISOString(),
            status: "new",
            ...validInput,
          },
          null,
          2
        )
      ),
    ]);
  } catch (err) {
    console.error("Failed to persist switch request to local disk", err);
    // Continue anyway — Supabase (if configured) already has the record,
    // and the generated documents are still returned to the client below,
    // so the request isn't a total loss even if this filesystem write
    // fails (e.g. a read-only serverless deployment).
  }

  return NextResponse.json({
    id,
    cancellationLetter,
    applicationSummary,
    cancellationDeadline: cancellationDeadline.toISOString(),
    effectiveDate: effectiveDate.toISOString(),
  });
}

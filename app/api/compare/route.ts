import { NextResponse } from "next/server";
import {
  getCheapestInsurers,
  validateComparisonInput,
  type ComparisonInput,
} from "@/lib/priminfo";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  readJsonWithLimit,
  tooManyRequestsResponse,
  payloadTooLargeResponse,
} from "@/lib/requestGuards";

const MAX_BODY_BYTES = 2_000;

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(
    `compare:${getClientIp(request)}`,
    60,
    60
  );
  if (!rateLimit.allowed) return tooManyRequestsResponse();

  const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === "too_large") return payloadTooLargeResponse();
    return NextResponse.json(
      { errors: [{ field: "postcode", message: "Invalid request body." }] },
      { status: 400 }
    );
  }

  const raw = parsed.data as Record<string, unknown>;
  const input: Partial<ComparisonInput> = {
    postcode: typeof raw.postcode === "string" ? raw.postcode.trim() : "",
    birthYear: Number(raw.birthYear),
    deductible: Number(raw.deductible),
    withAccident:
      typeof raw.withAccident === "boolean" ? raw.withAccident : undefined,
    currentPremium:
      raw.currentPremium != null && raw.currentPremium !== ""
        ? Number(raw.currentPremium)
        : undefined,
  };

  const errors = validateComparisonInput(input);
  if (errors.length) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const result = getCheapestInsurers(input as ComparisonInput);
  if (!result) {
    return NextResponse.json(
      {
        errors: [
          {
            field: "postcode",
            message: "This postcode isn't in the official premium region data.",
          },
        ],
      },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}

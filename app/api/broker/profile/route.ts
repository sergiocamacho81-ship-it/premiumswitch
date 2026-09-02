import { NextResponse } from "next/server";
import { updateBrokerBranding } from "@/lib/brokers";
import { readJsonWithLimit, payloadTooLargeResponse } from "@/lib/requestGuards";

const MAX_BODY_BYTES = 2_000;

export async function PATCH(request: Request) {
  const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === "too_large") return payloadTooLargeResponse();
    return NextResponse.json({ error: "invalidBody" }, { status: 400 });
  }

  const body = parsed.data as Record<string, unknown>;
  const result = await updateBrokerBranding({
    slug: typeof body.slug === "string" ? body.slug : undefined,
    logoUrl: body.logoUrl === null ? null : typeof body.logoUrl === "string" ? body.logoUrl : undefined,
    primaryColor:
      body.primaryColor === null
        ? null
        : typeof body.primaryColor === "string"
          ? body.primaryColor
          : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

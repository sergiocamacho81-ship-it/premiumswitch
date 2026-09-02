import { NextResponse } from "next/server";
import { getSupabaseForRequest, isSupabaseAuthConfigured } from "@/lib/supabaseServer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { readJsonWithLimit, tooManyRequestsResponse, payloadTooLargeResponse } from "@/lib/requestGuards";

const MAX_BODY_BYTES = 2_000;
const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Broker portal is not configured." }, { status: 503 });
  }

  const lockoutKey = `broker-login:${getClientIp(request)}`;
  const rateLimit = await checkRateLimit(lockoutKey, MAX_ATTEMPTS, WINDOW_SECONDS);
  if (!rateLimit.allowed) return tooManyRequestsResponse(WINDOW_SECONDS);

  const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === "too_large") return payloadTooLargeResponse();
    return NextResponse.json({ error: "invalidBody" }, { status: 400 });
  }

  const body = parsed.data as Record<string, unknown>;
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  const supabase = await getSupabaseForRequest();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: "invalidCredentials" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

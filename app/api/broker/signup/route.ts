import { NextResponse } from "next/server";
import { getSupabaseForRequest, isSupabaseAuthConfigured } from "@/lib/supabaseServer";
import { createBrokerProfile } from "@/lib/brokers";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { readJsonWithLimit, tooManyRequestsResponse, payloadTooLargeResponse } from "@/lib/requestGuards";

const MAX_BODY_BYTES = 2_000;

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Broker portal is not configured." }, { status: 503 });
  }

  const rateLimit = await checkRateLimit(`broker-signup:${getClientIp(request)}`, 5, 3600);
  if (!rateLimit.allowed) return tooManyRequestsResponse(3600);

  const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === "too_large") return payloadTooLargeResponse();
    return NextResponse.json({ error: "invalidBody" }, { status: 400 });
  }

  const body = parsed.data as Record<string, unknown>;
  const companyName = String(body.companyName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!companyName || companyName.length > 150) {
    return NextResponse.json({ error: "invalidCompanyName" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "invalidEmail" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "invalidPassword" }, { status: 400 });
  }

  const supabase = await getSupabaseForRequest();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    if (error) console.error("Broker signup failed", error);
    return NextResponse.json(
      { error: error?.message === "User already registered" ? "emailTaken" : "signupFailed" },
      { status: 400 }
    );
  }

  await createBrokerProfile(data.user.id, companyName, email);

  return NextResponse.json({
    needsEmailConfirmation: !data.session,
  });
}

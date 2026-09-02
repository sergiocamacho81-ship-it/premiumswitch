import { NextResponse } from "next/server";
import { getSupabaseForRequest, isSupabaseAuthConfigured } from "@/lib/supabaseServer";

export async function POST() {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Broker portal is not configured." }, { status: 503 });
  }

  const supabase = await getSupabaseForRequest();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}

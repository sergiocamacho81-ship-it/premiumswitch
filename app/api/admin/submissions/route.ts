import { NextResponse } from "next/server";
import { listSubmissions, updateSubmissionStatus, type SubmissionStatus } from "@/lib/submissions";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }
  const submissions = await listSubmissions();
  return NextResponse.json({ submissions });
}

const VALID_STATUSES: SubmissionStatus[] = ["new", "contacted", "done"];

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { id?: string; status?: string };
  if (!body.id || !VALID_STATUSES.includes(body.status as SubmissionStatus)) {
    return NextResponse.json({ error: "Invalid id or status." }, { status: 400 });
  }

  const ok = await updateSubmissionStatus(body.id, body.status as SubmissionStatus);
  if (!ok) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

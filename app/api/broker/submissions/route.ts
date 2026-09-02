import { NextResponse } from "next/server";
import {
  listSubmissionsForBroker,
  updateSubmissionStatusForBroker,
  type SubmissionStatus,
} from "@/lib/submissions";

const VALID_STATUSES: SubmissionStatus[] = ["new", "contacted", "done"];

export async function GET() {
  const submissions = await listSubmissionsForBroker();
  return NextResponse.json({ submissions });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string; status?: string };
  if (!body.id || !VALID_STATUSES.includes(body.status as SubmissionStatus)) {
    return NextResponse.json({ error: "Invalid id or status." }, { status: 400 });
  }

  const ok = await updateSubmissionStatusForBroker(
    body.id,
    body.status as SubmissionStatus
  );
  if (!ok) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

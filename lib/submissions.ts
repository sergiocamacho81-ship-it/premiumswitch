import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type SubmissionStatus = "new" | "contacted" | "done";

export type SubmissionRecord = {
  id: string;
  submittedAt: string;
  status: SubmissionStatus;
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  postcode: string;
  city: string;
  email: string;
  phone?: string;
  currentInsurerName: string;
  newInsurerName: string;
  premium: number;
  deductible: number;
  cancellationLetter: string;
  applicationSummary: string;
};

type NewSubmission = Omit<SubmissionRecord, "id" | "submittedAt" | "status">;

const TABLE = "submissions";

function toRow(s: NewSubmission) {
  return {
    first_name: s.firstName,
    last_name: s.lastName,
    birth_date: s.birthDate,
    street: s.street,
    postcode: s.postcode,
    city: s.city,
    email: s.email,
    phone: s.phone ?? null,
    current_insurer_name: s.currentInsurerName,
    new_insurer_name: s.newInsurerName,
    premium: s.premium,
    deductible: s.deductible,
    cancellation_letter: s.cancellationLetter,
    application_summary: s.applicationSummary,
  };
}

function fromRow(row: Record<string, unknown>): SubmissionRecord {
  return {
    id: row.id as string,
    submittedAt: row.submitted_at as string,
    status: row.status as SubmissionStatus,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    birthDate: row.birth_date as string,
    street: row.street as string,
    postcode: row.postcode as string,
    city: row.city as string,
    email: row.email as string,
    phone: (row.phone as string) ?? undefined,
    currentInsurerName: row.current_insurer_name as string,
    newInsurerName: row.new_insurer_name as string,
    premium: Number(row.premium),
    deductible: Number(row.deductible),
    cancellationLetter: row.cancellation_letter as string,
    applicationSummary: row.application_summary as string,
  };
}

export async function saveSubmission(
  submission: NewSubmission
): Promise<{ id: string; submittedAt: string } | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(toRow(submission))
    .select("id, submitted_at")
    .single();

  if (error) {
    console.error("Failed to save submission to Supabase", error);
    return null;
  }

  return { id: data.id, submittedAt: data.submitted_at };
}

export async function listSubmissions(): Promise<SubmissionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Failed to list submissions", error);
    return [];
  }

  return data.map(fromRow);
}

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Failed to update submission status", error);
    return false;
  }

  return true;
}

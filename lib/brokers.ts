import "server-only";
import { getSupabaseForRequest } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase";

export type BrokerStatus = "trial" | "active" | "canceled";

export type BrokerProfile = {
  id: string;
  companyName: string;
  contactEmail: string;
  status: BrokerStatus;
  createdAt: string;
};

function fromRow(row: Record<string, unknown>): BrokerProfile {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactEmail: row.contact_email as string,
    status: row.status as BrokerStatus,
    createdAt: row.created_at as string,
  };
}

/** The signed-in broker for the current request, or null if not signed in. */
export async function getCurrentBroker(): Promise<BrokerProfile | null> {
  const supabase = await getSupabaseForRequest();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("brokers")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return fromRow(data);
}

/**
 * Creates the broker's profile row using the service-role client rather
 * than the request-scoped one: signUp() may not return an active session
 * yet (e.g. if the Supabase project requires email confirmation), so
 * auth.uid() wouldn't be set for an RLS-scoped insert at this point even
 * though the signup itself just succeeded.
 */
export async function createBrokerProfile(
  id: string,
  companyName: string,
  contactEmail: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("brokers").insert({
    id,
    company_name: companyName,
    contact_email: contactEmail,
  });

  if (error) {
    console.error("Failed to create broker profile", error);
    return false;
  }
  return true;
}

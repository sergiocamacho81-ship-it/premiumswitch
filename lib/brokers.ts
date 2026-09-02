import "server-only";
import { getSupabaseForRequest } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { hexToHslTriplet } from "@/lib/color";

export type BrokerStatus = "trial" | "active" | "canceled";

export type BrokerProfile = {
  id: string;
  companyName: string;
  contactEmail: string;
  status: BrokerStatus;
  createdAt: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
};

export type PublicBrokerProfile = {
  id: string;
  slug: string;
  companyName: string;
  logoUrl?: string;
  primaryColorHsl?: string;
};

function fromRow(row: Record<string, unknown>): BrokerProfile {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactEmail: row.contact_email as string,
    status: row.status as BrokerStatus,
    createdAt: row.created_at as string,
    slug: row.slug as string,
    logoUrl: (row.logo_url as string) ?? undefined,
    primaryColor: (row.primary_color as string) ?? undefined,
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
 * Looked up for anonymous visitors to a white-labeled page — uses the
 * service-role client (bypassing RLS) rather than exposing a public RLS
 * policy, and only ever returns these specific safe fields, so
 * contact_email/status/etc. can never leak this way regardless of what
 * columns get added to the table later.
 */
export async function getPublicBrokerBySlug(
  slug: string
): Promise<PublicBrokerProfile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("brokers")
    .select("id, slug, company_name, logo_url, primary_color")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: data.slug,
    companyName: data.company_name,
    logoUrl: data.logo_url ?? undefined,
    primaryColorHsl: data.primary_color
      ? (hexToHslTriplet(data.primary_color) ?? undefined)
      : undefined,
  };
}

/** True if a real broker with this id exists — used to validate a
 * client-supplied broker id before attributing a public submission to it. */
export async function brokerExists(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("brokers")
    .select("id")
    .eq("id", id)
    .single();
  return !error && Boolean(data);
}

async function generateUniqueSlug(companyName: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const base = slugify(companyName) || "broker";

  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const { data } = await supabase
      .from("brokers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }

  return `${base}-${Date.now()}`;
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
  const slug = await generateUniqueSlug(companyName);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("brokers").insert({
    id,
    company_name: companyName,
    contact_email: contactEmail,
    slug,
  });

  if (error) {
    console.error("Failed to create broker profile", error);
    return false;
  }
  return true;
}

export type BrandingUpdate = {
  slug?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

export type BrandingUpdateError = "slugTaken" | "invalidSlug" | "invalidColor" | "updateFailed";

/** RLS-scoped (broker can only ever update their own row, id = auth.uid()). */
export async function updateBrokerBranding(
  update: BrandingUpdate
): Promise<{ ok: true } | { ok: false; error: BrandingUpdateError }> {
  const supabase = await getSupabaseForRequest();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "updateFailed" };

  const row: Record<string, unknown> = {};

  if (update.slug !== undefined) {
    const clean = slugify(update.slug);
    if (!clean) return { ok: false, error: "invalidSlug" };
    row.slug = clean;
  }
  if (update.logoUrl !== undefined) {
    row.logo_url = update.logoUrl || null;
  }
  if (update.primaryColor !== undefined) {
    if (update.primaryColor && !hexToHslTriplet(update.primaryColor)) {
      return { ok: false, error: "invalidColor" };
    }
    row.primary_color = update.primaryColor || null;
  }

  const { error } = await supabase.from("brokers").update(row).eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "slugTaken" };
    console.error("Failed to update broker branding", error);
    return { ok: false, error: "updateFailed" };
  }

  return { ok: true };
}

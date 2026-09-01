import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type RateLimitResult = { allowed: boolean; limited: boolean };

/**
 * Atomically checks and increments a rate-limit counter in Postgres (see
 * check_rate_limit in supabase/schema.sql). Fails open if Supabase isn't
 * configured or the check itself errors — rate limiting is defense in depth
 * on top of input validation, not the only thing standing between the app
 * and abuse, so an infra hiccup here shouldn't take the whole app down.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!isSupabaseConfigured()) {
    return { allowed: true, limited: false };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("Rate limit check failed", error);
      return { allowed: true, limited: false };
    }

    return { allowed: Boolean(data), limited: true };
  } catch (err) {
    console.error("Rate limit check threw", err);
    return { allowed: true, limited: false };
  }
}

/**
 * Read-only lockout check (doesn't increment) — used to reject already
 * locked-out callers before doing any real work, e.g. credential checks.
 */
export async function isRateLimited(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("is_rate_limited", {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("Lockout check failed", error);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error("Lockout check threw", err);
    return false;
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

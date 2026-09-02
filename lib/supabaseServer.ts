import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(url && anonKey);
}

/**
 * A Supabase client scoped to the current request's session cookie — unlike
 * lib/supabase.ts's service-role client, this respects RLS as the signed-in
 * broker (or as the anonymous/anon-key role if no one is signed in).
 */
export async function getSupabaseForRequest() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase auth is not configured — set SUPABASE_URL and SUPABASE_ANON_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component render, where cookies can't be
          // written — safe to ignore as long as middleware also refreshes
          // the session (it does, see middleware.ts).
        }
      },
    },
  });
}

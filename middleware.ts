import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { isRateLimited, checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;

const intlMiddleware = createIntlMiddleware(routing);

// Plain === on secrets leaks timing information (it returns as soon as the
// first mismatched character is found), letting an attacker recover a
// password one character at a time. This compares every character
// regardless of where a mismatch occurs, taking the same time either way.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function adminAuthMiddleware(request: NextRequest): Promise<NextResponse> {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    return new NextResponse("Admin access is not configured.", { status: 503 });
  }

  const lockoutKey = `admin-login:${getClientIp(request)}`;
  if (await isRateLimited(lockoutKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_SECONDS)) {
    return new NextResponse(
      "Too many failed login attempts. Try again in a few minutes.",
      { status: 429, headers: { "Retry-After": String(LOCKOUT_WINDOW_SECONDS) } }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const separatorIndex = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, separatorIndex);
    const suppliedPassword = decoded.slice(separatorIndex + 1);

    if (
      timingSafeEqual(suppliedUser, user) &&
      timingSafeEqual(suppliedPassword, password)
    ) {
      return NextResponse.next();
    }

    // Only credentials that were actually wrong count as an attempt — the
    // browser's initial request (no header yet) doesn't.
    await checkRateLimit(lockoutKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_SECONDS);
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PremiumSwitch Admin"' },
  });
}

const PUBLIC_BROKER_PATHS = ["/broker/login", "/broker/signup"];

async function brokerSessionMiddleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const isPublicBrokerPath = PUBLIC_BROKER_PATHS.includes(pathname);

  if (!url || !anonKey) {
    // Broker auth isn't configured yet — treat protected broker routes as
    // unavailable rather than silently letting requests through unchecked.
    if (!isPublicBrokerPath) {
      return new NextResponse("Broker portal is not configured.", { status: 503 });
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicBrokerPath) {
    const loginUrl = new URL("/broker/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicBrokerPath) {
    return NextResponse.redirect(new URL("/broker/dashboard", request.url));
  }

  return response;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The admin tool is an internal operator dashboard, not (yet) localized —
  // it keeps its own Basic Auth gate instead of going through locale routing.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return adminAuthMiddleware(request);
  }

  if (pathname.startsWith("/broker")) {
    return brokerSessionMiddleware(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/broker/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};

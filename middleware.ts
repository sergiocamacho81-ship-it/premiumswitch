import { NextRequest, NextResponse } from "next/server";
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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The admin tool is an internal operator dashboard, not (yet) localized —
  // it keeps its own Basic Auth gate instead of going through locale routing.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return adminAuthMiddleware(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/api/admin/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};

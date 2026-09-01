# PremiumSwitch

Compare official Swiss health insurance premium data and switch insurers.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Premium/region/insurer data: cached JSON in `/data`, refreshed from official
  BAG/Priminfo open data (see `data/README.md`)
- Switch-request submissions: Supabase (`/lib/submissions.ts`)
- Admin dashboard at `/admin`, protected by HTTP Basic Auth

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To refresh the cached premium data (run yearly once BAG publishes new rates,
typically late September):

```bash
npm run fetch-data
```

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in real values:

| Variable | Required for | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Switch-request storage + `/admin` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Switch-request storage + `/admin` | Server-side only, full access — never expose to the browser |
| `ADMIN_USER` | `/admin` | Basic Auth username |
| `ADMIN_PASSWORD` | `/admin` | Basic Auth password |

Without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, the comparison tool still
works fully — only switch-request persistence and the admin dashboard need
Supabase. Without `ADMIN_USER`/`ADMIN_PASSWORD`, `/admin` refuses all access
(503) rather than defaulting to open.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql` to create the `submissions`
   table (RLS is enabled with no policies, so only the service_role key —
   server-side only — can read or write it).
3. In Project Settings > API, copy the Project URL and the `service_role`
   secret key into `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel ([vercel.com/new](https://vercel.com/new)).
3. Add the four environment variables above in the Vercel project settings
   (Settings > Environment Variables) before the first deploy, or redeploy
   after adding them.
4. Deploy. No other configuration is needed — this is a standard Next.js App
   Router project.

Note: `/documents` (local `.txt` copies of generated letters, written by
`app/api/switch-request/route.ts`) only persists on a machine with a
writable, non-ephemeral filesystem — it's a local-dev/self-hosting
convenience, not the source of truth in production. Supabase is the source
of truth for `/admin`.

## Security

- **Transport & headers**: HSTS, a restrictive CSP (`default-src 'self'`),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a locked-down
  `Permissions-Policy` are set for every response (`next.config.mjs`).
- **Admin access**: `/admin` and `/api/admin/*` require HTTP Basic Auth
  (`middleware.ts`), refuse all access if the credentials aren't configured
  (fail closed, not open), compare credentials in constant time (not `===`,
  which leaks timing information), and lock out an IP for 15 minutes after 10
  failed attempts.
- **Rate limiting**: `/api/compare` (60 req/min/IP) and `/api/switch-request`
  (5 req/hour/IP — a real user only submits this once) are rate-limited via
  an atomic Postgres function (`supabase/schema.sql`), so concurrent requests
  can't race past the limit. Fails open if Supabase isn't configured or
  errors — rate limiting is defense in depth, not the only safeguard.
- **Input hardening**: every field has a server-side max length, request
  bodies are capped (2KB for `/api/compare`, 20KB for `/api/switch-request`)
  and the cap is enforced while streaming the body — not by trusting the
  spoofable `Content-Length` header — so an attacker can't send a large body
  by lying about or omitting it.
- **Data access**: the Supabase `submissions` table has Row Level Security
  enabled with zero policies, so only the `service_role` key (server-side
  only, guarded by the `server-only` package so it can never end up in a
  client bundle) can read or write it — the public/anon key has no access at
  all.
- **No secrets in the client bundle**: verified by inspecting the production
  build output — `/` ships 133KB total, none of it Supabase credentials or
  the ~800KB of premium/region reference data.
- **No PII in logs**: error logging (`console.error`) only logs the error
  object, never the submitted form data.

**Deliberately not done** (would be disproportionate for a solo-founder MVP
at this data sensitivity level — not a special category of data like health
conditions or government IDs, just name/address/contact/insurer choice):
- Field-level encryption at rest (Supabase/Postgres already encrypts the
  underlying storage; app-level encryption would add real key-management
  complexity for limited extra protection against a threat model — a
  compromised service_role key — where the attacker could likely reach the
  keys needed to decrypt anyway).
- Nonce-based strict CSP (would remove the need for `'unsafe-inline'` in
  `script-src`, but requires wiring a per-request nonce through middleware;
  the main risk it defends against, injecting arbitrary `<script>` tags via
  user-controlled HTML, isn't present here since React escapes all output
  and the app never uses `dangerouslySetInnerHTML`).
- A managed WAF / bot-detection service — the rate limiting above covers the
  realistic abuse case (scripted spam) for current traffic levels.

## Testing checklist

- `npm run build` — typechecks and builds cleanly.
- Comparison flow tested against 5 real postcodes spanning German-, French-,
  and Italian-speaking cantons (8001 Zürich, 1201 Geneva, 6900 Lugano, 3011
  Bern, 4051 Basel) — see project history for details.
- `/admin` and `/api/admin/*` return 503 with no `ADMIN_USER`/`ADMIN_PASSWORD`
  set, 401 with missing/wrong credentials, 200 with correct credentials.
- Oversized request bodies return 413 on both `/api/compare` and
  `/api/switch-request`; over-length fields are rejected with a clear
  per-field error; out-of-range premium/deductible values are rejected.
- CSP verified against a real browser session: Radix UI's inline-styled
  popovers (used by the deductible/insurer `<Select>`s) render correctly, and
  dev-mode Fast Refresh (which needs `unsafe-eval`) works without console
  errors.

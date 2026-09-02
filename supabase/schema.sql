-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- to create the table PremiumSwitch's switch-request form writes to.

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'done')),
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  street text not null,
  postcode text not null,
  city text not null,
  email text not null,
  phone text,
  current_insurer_name text not null,
  new_insurer_name text not null,
  premium numeric not null,
  deductible integer not null,
  cancellation_letter text not null,
  application_summary text not null
);

-- Row Level Security is enabled with no policies, so only requests using the
-- service_role key (server-side only, never exposed to the browser) can read
-- or write this table. The anon/public key has no access at all.
alter table submissions enable row level security;

-- Rate limiting: one row per (key, window), where `key` is something like
-- "switch-request:203.0.113.4" or "admin-login:203.0.113.4". The upsert in
-- check_rate_limit below is atomic (a single statement), so concurrent
-- requests from the same key can't race past the limit.
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;

create or replace function check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Best-effort cleanup of old windows so this table doesn't grow forever.
  delete from rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_max_requests;
end;
$$;

-- Read-only check used for admin-login lockout: lets middleware reject
-- already-locked-out IPs *before* checking credentials, without incrementing
-- the counter itself (only actual failed attempts should count as attempts).
create or replace function is_rate_limited(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  select count into v_count
  from rate_limits
  where key = p_key and window_start = v_window_start;

  return coalesce(v_count, 0) >= p_max_requests;
end;
$$;

-- Phase 7: broker accounts and multi-tenant submission ownership.
-- Re-running this whole file is safe — every statement below is idempotent.

create table if not exists brokers (
  id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null,
  contact_email text not null,
  status text not null default 'trial' check (status in ('trial', 'active', 'canceled')),
  created_at timestamptz not null default now()
);
alter table brokers enable row level security;

drop policy if exists "Brokers manage their own profile" on brokers;
create policy "Brokers manage their own profile" on brokers
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Existing submissions predate broker accounts, so this column has to be
-- nullable: null means "submitted directly through the public tool", not
-- tied to any broker. Phase 8 (white-labeled broker pages) is what will
-- start populating this for real for public submissions.
alter table submissions add column if not exists broker_id uuid references brokers (id);

drop policy if exists "Brokers manage their own submissions" on submissions;
create policy "Brokers manage their own submissions" on submissions
  for all
  using (auth.uid() = broker_id)
  with check (auth.uid() = broker_id);

-- Phase 8: white-labeled public page per broker (/[locale]/b/[slug]).
-- The slug, logo, and color are looked up for anonymous visitors, but that
-- lookup goes through the service-role client server-side (see
-- lib/brokers.ts getPublicBrokerBySlug) rather than a public RLS policy —
-- Postgres RLS is row-level, not column-level, and this keeps contact_email
-- and status out of reach of the public page regardless.

alter table brokers add column if not exists slug text;
alter table brokers add column if not exists logo_url text;
alter table brokers add column if not exists primary_color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brokers_slug_key'
  ) then
    alter table brokers add constraint brokers_slug_key unique (slug);
  end if;
end $$;

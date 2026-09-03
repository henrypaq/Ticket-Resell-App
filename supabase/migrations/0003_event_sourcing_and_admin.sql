-- 0003 — Reconciles the 2026-09-01 revision log entries:
--   * Event sourcing model (Phase 1): user-requested / imported events, admin
--     approval, and the discoverable vs resale_enabled split.
--   * Manual escrow + admin console (Phase 1): held payments, admin release /
--     refund, and the AdminAction audit log.

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type event_status as enum ('pending', 'discoverable', 'resale_enabled', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type price_source as enum (
    'platform_parsed',
    'admin_verified',
    'user_submitted_unverified',
    'producer_confirmed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_action_type as enum (
    'event_approved',
    'event_rejected',
    'listing_flagged',
    'listing_unflagged',
    'listing_removed',
    'payment_released',
    'payment_refunded'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Admin identity
--
-- Seeded by email rather than user id, because these accounts may not exist
-- yet. handle_new_user() consults this table at profile-creation time, so admin
-- status attaches the first time they sign in.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

insert into public.admin_allowlist (email, note) values
  ('henrypaquin0@gmail.com', 'founder'),
  ('edvardroberts@gmail.com', 'founder')
on conflict (email) do nothing;

alter table public.profiles add column if not exists is_admin boolean not null default false;
-- Connect account for payouts. Phase 1 does not build the onboarding flow; the
-- admin release path reports a missing account rather than guessing.
alter table public.profiles add column if not exists stripe_account_id text;

-- Backfill for any profile that already exists.
update public.profiles p
   set is_admin = true
  from public.admin_allowlist a
 where lower(p.email) = lower(a.email)
   and p.is_admin = false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_allowlisted boolean;
begin
  select exists (
    select 1 from public.admin_allowlist a where lower(a.email) = lower(new.email)
  ) into is_allowlisted;

  insert into public.profiles (id, email, display_name, handle, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'))
      || substr(replace(new.id::text, '-', ''), 1, 4),
    coalesce(is_allowlisted, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

/**
 * Admin check used by RLS policies. security definer so it can read profiles
 * without recursing through profiles' own policies.
 */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Event sourcing
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists status event_status not null default 'pending';
alter table public.events add column if not exists price_source price_source not null default 'user_submitted_unverified';
alter table public.events add column if not exists source_url text;
alter table public.events add column if not exists submitted_by uuid references public.profiles (id) on delete set null;
alter table public.events add column if not exists approved_by uuid references public.profiles (id) on delete set null;
alter table public.events add column if not exists approved_at timestamptz;
alter table public.events add column if not exists review_note text;

create index if not exists events_status_starts_at_idx on public.events (status, starts_at);

-- The events seeded in 0002 were entered by an admin directly in SQL, so
-- 'admin_verified' is the honest price_source and resale_enabled the honest
-- status. Everything created after this migration starts at 'pending' —
-- defaulting new rows to resale_enabled would silently defeat the gate.
update public.events
   set status = 'resale_enabled',
       price_source = 'admin_verified',
       approved_at = coalesce(approved_at, created_at)
 where source_platform is not null
   and submitted_by is null
   and status = 'pending';

-- ---------------------------------------------------------------------------
-- Listings may only exist against resale_enabled events.
--
-- Application code checks this too, but per CLAUDE.md "no path skips this step
-- in v1" — so the database refuses it outright, the same way it refuses an
-- over-cap price.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_resale_enabled_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  current_status event_status;
begin
  select status into current_status from public.events where id = new.event_id;

  if current_status is null then
    raise exception 'LISTING_EVENT_NOT_FOUND: event % does not exist', new.event_id
      using errcode = 'foreign_key_violation';
  end if;

  if current_status <> 'resale_enabled' then
    raise exception
      'EVENT_NOT_RESALE_ENABLED: event % is %, listings require resale_enabled',
      new.event_id, current_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_require_resale_enabled on public.listings;
create trigger listings_require_resale_enabled
  before insert or update of event_id on public.listings
  for each row execute function public.enforce_resale_enabled_event();

-- Moderation fields (reactive, not a pre-approval gate — listings still go live
-- immediately on posting).
alter table public.listings add column if not exists flagged_at timestamptz;
alter table public.listings add column if not exists flagged_reason text;
alter table public.listings add column if not exists removed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Manual escrow
-- ---------------------------------------------------------------------------
alter table public.transactions add column if not exists released_by uuid references public.profiles (id) on delete set null;
alter table public.transactions add column if not exists released_at timestamptz;
alter table public.transactions add column if not exists refunded_at timestamptz;
alter table public.transactions add column if not exists stripe_payment_intent_id text unique;
alter table public.transactions add column if not exists stripe_charge_id text;
alter table public.transactions add column if not exists stripe_transfer_id text;
alter table public.transactions add column if not exists stripe_refund_id text;
alter table public.transactions add column if not exists admin_note text;

create index if not exists transactions_escrow_idx on public.transactions (escrow_status, created_at desc);
create index if not exists transactions_buyer_idx on public.transactions (buyer_id, created_at desc);

-- Stripe webhook events, persisted before any side effect runs
-- (ARCHITECTURE.md § webhooks: verify-then-enqueue, and idempotent retries).
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- AdminAction audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles (id) on delete restrict,
  action_type admin_action_type not null,
  target_type text not null,
  target_id   uuid not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_actions_target_idx on public.admin_actions (target_type, target_id, created_at desc);
create index if not exists admin_actions_admin_idx on public.admin_actions (admin_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_actions   enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.stripe_events   enable row level security;

-- admin_allowlist and stripe_events: RLS on, zero policies. Service role only.

drop policy if exists admin_actions_read_admin on public.admin_actions;
create policy admin_actions_read_admin on public.admin_actions
  for select to authenticated using (public.is_admin());

-- Pending and rejected events must not leak into the public feed. Admins see
-- everything so the approval queue works.
drop policy if exists events_read_all on public.events;
drop policy if exists events_read_public on public.events;
create policy events_read_public on public.events
  for select to anon, authenticated
  using (status in ('discoverable', 'resale_enabled'));

drop policy if exists events_read_admin on public.events;
create policy events_read_admin on public.events
  for select to authenticated using (public.is_admin());

-- A user can always see an event they submitted, whatever its status.
drop policy if exists events_read_own_submission on public.events;
create policy events_read_own_submission on public.events
  for select to authenticated using (submitted_by = (select auth.uid()));

-- Removed listings disappear for everyone but their seller and admins.
drop policy if exists listings_read_authenticated on public.listings;
create policy listings_read_authenticated on public.listings
  for select to authenticated
  using (removed_at is null or seller_id = (select auth.uid()) or public.is_admin());

drop policy if exists listings_read_admin on public.listings;
create policy listings_read_admin on public.listings
  for select to authenticated using (public.is_admin());

drop policy if exists transactions_read_admin on public.transactions;
create policy transactions_read_admin on public.transactions
  for select to authenticated using (public.is_admin());

commit;

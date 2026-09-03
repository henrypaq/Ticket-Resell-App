-- 0001_init.sql — Phase 0 core schema + Phase 1 loop.
-- Spec refs: CLAUDE_1.md (data model, hard constraints), SECURITY.md (RLS/authz),
-- DATA_CAPTURE.md (analytics log + rollups), ARCHITECTURE.md (FKs/constraints at DB level).
--
-- Apply with:  psql "<connection string>" -f supabase/migrations/0001_init.sql
-- or paste into the Supabase dashboard SQL editor.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type source_platform as enum ('eventbrite', 'showpass', 'tixr', 'dice', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_tier as enum ('A', 'B');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('active', 'reserved', 'sold', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type escrow_status as enum ('none', 'held', 'released', 'refunded', 'disputed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles — app-side mirror of auth.users (CLAUDE_1 `User`)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text        not null,
  display_name text,
  handle       text unique,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, handle)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'))
      || substr(replace(new.id::text, '-', ''), 1, 4)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- events — admin-curated only (CLAUDE_1 Phase 1: no user-generated events)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  name               text            not null,
  venue              text            not null,
  city               text            not null default 'Montreal',
  starts_at          timestamptz     not null,
  doors_close_at     timestamptz,
  source_platform    source_platform not null default 'manual',
  -- The face value every resale listing is measured against. This column is
  -- load-bearing for the Bill 10 price ceiling; see enforce_resale_price_cap().
  original_price     numeric(10,2)   not null check (original_price >= 0),
  verification_tier  verification_tier not null default 'B',
  flyer_url          text,
  tags               text[]          not null default '{}',
  is_sold_out        boolean         not null default false,
  created_at         timestamptz     not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_city_starts_at_idx on public.events (city, starts_at);

-- ---------------------------------------------------------------------------
-- event_authorizations — the ONLY mechanism that unlocks above-face pricing.
-- Modeled in Phase 0, admin UI arrives in Phase 4. No client-side access at all.
-- ---------------------------------------------------------------------------
create table if not exists public.event_authorizations (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null unique references public.events (id) on delete cascade,
  producer_contact    text not null,
  agreement_reference text not null,
  max_resale_price    numeric(10,2) not null check (max_resale_price >= 0),
  authorized_at       timestamptz not null default now(),
  authorized_by       uuid references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id) on delete cascade,
  seller_id           uuid not null references public.profiles (id) on delete cascade,
  price               numeric(10,2) not null check (price >= 0),
  status              listing_status not null default 'active',
  -- Exactly what was disclosed at listing time (CLAUDE_1 hard constraint 3).
  disclosure_snapshot jsonb not null,
  -- Phase 1 is manual attestation; the verification engine lands in Phase 2.
  seller_attested_at  timestamptz not null default now(),
  -- Phase 1 "request" step. Payment and escrow are Phase 2, so a request just
  -- reserves the listing for one buyer and pings the seller.
  reserved_by         uuid references public.profiles (id) on delete set null,
  reserved_at         timestamptz,
  created_at          timestamptz not null default now(),
  constraint listings_reserved_consistently check (
    (status <> 'reserved') or (reserved_by is not null and reserved_at is not null)
  )
);

create index if not exists listings_event_status_idx on public.listings (event_id, status);
create index if not exists listings_seller_idx on public.listings (seller_id, created_at desc);
create index if not exists listings_reserved_by_idx on public.listings (reserved_by) where reserved_by is not null;

-- Bill 10 price ceiling, enforced in the database.
--
-- This deliberately is not a CHECK constraint: a CHECK cannot reference
-- events.original_price or event_authorizations.max_resale_price. Application
-- validation (lib/compliance/pricing.ts) is the first line of defense; this
-- trigger is the one that physically refuses the write.
create or replace function public.enforce_resale_price_cap()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  face_value numeric(10,2);
  authorized_max numeric(10,2);
  cap numeric(10,2);
begin
  select original_price into face_value
    from public.events where id = new.event_id;

  if face_value is null then
    raise exception 'LISTING_EVENT_NOT_FOUND: event % does not exist', new.event_id
      using errcode = 'foreign_key_violation';
  end if;

  select max_resale_price into authorized_max
    from public.event_authorizations where event_id = new.event_id;

  cap := coalesce(authorized_max, face_value);

  if new.price > cap then
    raise exception
      'RESALE_PRICE_CAP_EXCEEDED: price %, cap % (face value %, authorization %)',
      new.price, cap, face_value, coalesce(authorized_max::text, 'none')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_price_cap on public.listings;
create trigger listings_enforce_price_cap
  before insert or update of price, event_id on public.listings
  for each row execute function public.enforce_resale_price_cap();

-- ---------------------------------------------------------------------------
-- waitlist_entries
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist_entries (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists waitlist_event_idx on public.waitlist_entries (event_id, created_at);

-- ---------------------------------------------------------------------------
-- transactions — modeled now, exercised in Phase 2 (escrow/Stripe Connect).
-- fee_amount is an itemized flat service fee. Never a "transfer fee"
-- (CLAUDE_1 hard constraint 2).
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references public.listings (id) on delete restrict,
  buyer_id            uuid not null references public.profiles (id) on delete restrict,
  amount              numeric(10,2) not null check (amount >= 0),
  fee_amount          numeric(10,2) not null default 0 check (fee_amount >= 0),
  escrow_status       escrow_status not null default 'none',
  verification_status text not null default 'pending',
  idempotency_key     text unique,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

-- ---------------------------------------------------------------------------
-- notifications — Phase 1 match notifications land here (in-app).
-- Web Push via service worker is deferred; see README.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  event_ref_id    uuid references public.events (id) on delete cascade,
  listing_ref_id  uuid references public.listings (id) on delete cascade,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- analytics_events — append-only raw log (DATA_CAPTURE.md § architecture)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id             uuid primary key default gen_random_uuid(),
  event_type     text not null,
  user_id        uuid references public.profiles (id) on delete set null,
  event_ref_id   uuid references public.events (id) on delete set null,
  listing_ref_id uuid references public.listings (id) on delete set null,
  metadata       jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now()
);

create index if not exists analytics_type_time_idx on public.analytics_events (event_type, occurred_at desc);
create index if not exists analytics_event_ref_idx on public.analytics_events (event_ref_id, occurred_at desc);

-- Rollup tables: created empty and deliberately unpopulated. They exist now so
-- the eventual B2B track is "build a UI on the rollups", not "retrofit
-- anonymization onto a year of raw logs" (DATA_CAPTURE.md).
create table if not exists public.event_demand_summary (
  event_id              uuid primary key references public.events (id) on delete cascade,
  waitlist_joins        integer not null default 0,
  listing_views         integer not null default 0,
  listings_created      integer not null default 0,
  listings_sold         integer not null default 0,
  unmet_demand_estimate integer not null default 0,
  median_sell_through_minutes integer,
  computed_at           timestamptz not null default now()
);

create table if not exists public.event_engagement_summary (
  event_id                uuid primary key references public.events (id) on delete cascade,
  share_count             integer not null default 0,
  attendance_confirmations integer not null default 0,
  unique_viewers          integer not null default 0,
  computed_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — on for every table, from the first migration.
-- ---------------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.events                   enable row level security;
alter table public.event_authorizations     enable row level security;
alter table public.listings                 enable row level security;
alter table public.waitlist_entries         enable row level security;
alter table public.transactions             enable row level security;
alter table public.notifications            enable row level security;
alter table public.analytics_events         enable row level security;
alter table public.event_demand_summary     enable row level security;
alter table public.event_engagement_summary enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Events are public reading material; writes are service-role only (admin-curated).
drop policy if exists events_read_all on public.events;
create policy events_read_all on public.events
  for select to anon, authenticated using (true);

-- event_authorizations: RLS on, zero policies. No client role can read or write
-- it. Only the service role and the security-definer trigger see it.

drop policy if exists listings_read_authenticated on public.listings;
create policy listings_read_authenticated on public.listings
  for select to authenticated using (true);

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings
  for insert to authenticated with check (seller_id = (select auth.uid()));

drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings
  for update to authenticated using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));

-- Note: a buyer reserving a listing is NOT covered by the policy above, and
-- deliberately so — it writes a row the buyer does not own. That path goes
-- through the service role in domains/listings/actions.ts, which re-checks
-- ownership and current status server-side before writing.

drop policy if exists waitlist_rw_own on public.waitlist_entries;
create policy waitlist_rw_own on public.waitlist_entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists transactions_read_party on public.transactions;
create policy transactions_read_party on public.transactions
  for select to authenticated using (
    buyer_id = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = transactions.listing_id and l.seller_id = (select auth.uid())
    )
  );

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Analytics is append-only from the client's perspective: insert your own rows,
-- never read anyone's. Raw log access is team-only via the service role
-- (DATA_CAPTURE.md § privacy framing).
drop policy if exists analytics_insert_own on public.analytics_events;
create policy analytics_insert_own on public.analytics_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Rollups: RLS on, zero policies — service role only.

commit;

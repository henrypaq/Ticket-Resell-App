-- 0021 — Ticket units + offers: exclusive, rank-ordered waitlist matching.
--
-- Before this migration a "match" was a status on a person's lead
-- (beta_go_leads.status = 'matched'). Nothing was consumed, and buy and sell
-- leads had no join between them, so two buyers could both be told about one
-- ticket and both send an e-transfer for it.
--
-- This makes the *ticket* the thing that gets claimed:
--
--   beta_ticket_units  one row per sellable ticket (a sell lead with
--                      quantity 3 becomes 3 units — this is what makes
--                      "more supply → the next buyers take the next ones"
--                      fall out instead of being a special case).
--   beta_offers        one row per (unit, seat) allocation, with its own
--                      response clock and payment clock.
--
-- The load-bearing invariant is `beta_offers_one_live_per_unit`: at most one
-- live offer per unit, enforced by the database, not by ops discipline.
-- Everything else here exists to keep that index honest.

begin;

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
do $$ begin
  -- No 'held' value on purpose. "Held" is derived from the existence of a live
  -- offer; giving it a column too would let the two representations diverge.
  create type ticket_unit_status as enum ('available', 'sold', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offer_status as enum (
    -- live: occupies the unit
    'offered',            -- sent, response clock running
    'accepted',           -- buyer said yes, payment clock running
    'paid',               -- money confirmed by ops; unit is sold
    'needs_review',       -- ambiguous/partial payment — a human decides
    -- terminal: frees the unit
    'declined',           -- explicit pass. Costs the seat nothing.
    'expired_no_response',-- silence at the offer stage
    'expired_unpaid',     -- accepted then ghosted — the expensive failure
    'payment_failed',     -- e-transfer bounced / cancelled / wrong amount
    'withdrawn'           -- seller pulled out; refund path, NOT a requeue
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- beta_ticket_units
-- ---------------------------------------------------------------------------
create table if not exists public.beta_ticket_units (
  id           uuid primary key default gen_random_uuid(),
  sell_lead_id uuid not null references public.beta_go_leads (id) on delete cascade,
  event_slug   text not null,
  -- 1..quantity of the sell lead. Stable, so a unit keeps its identity across
  -- requeues and shows up the same way in ops every time.
  unit_index   integer not null check (unit_index >= 1),
  price_each   numeric(10, 2) not null check (price_each >= 0),
  status       ticket_unit_status not null default 'available',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (sell_lead_id, unit_index)
);

create index if not exists beta_ticket_units_event_status_idx
  on public.beta_ticket_units (event_slug, status, created_at);
create index if not exists beta_ticket_units_sell_lead_idx
  on public.beta_ticket_units (sell_lead_id);

comment on table public.beta_ticket_units is
  'One sellable ticket. The unit — not the lead — is what an offer claims.';

-- Face-value cap, third layer.
--
-- CLAUDE.md § hard constraint 1: never add a code path that lets a price exceed
-- the cap, and never drop a layer because another one covers it. price_each is
-- independently writable, so without this a bad insert or an ops edit would be
-- exactly such a path. beta_go_leads already CHECKs ask_each <= paid_each; this
-- is the same rule projected onto the unit, and it cannot be a CHECK because a
-- CHECK cannot reference another table. Same shape as enforce_resale_price_cap
-- in 0001.
create or replace function public.enforce_unit_price_cap()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  lead_paid  numeric(10, 2);
  lead_ask   numeric(10, 2);
  lead_slug  text;
  lead_intent text;
  lead_qty   integer;
begin
  select paid_each, ask_each, event_slug, intent, quantity
    into lead_paid, lead_ask, lead_slug, lead_intent, lead_qty
    from public.beta_go_leads where id = new.sell_lead_id;

  if lead_slug is null then
    raise exception 'UNIT_SELL_LEAD_NOT_FOUND: lead % does not exist', new.sell_lead_id
      using errcode = 'foreign_key_violation';
  end if;

  if lead_intent <> 'sell' then
    raise exception 'UNIT_LEAD_NOT_SELL: lead % has intent %', new.sell_lead_id, lead_intent
      using errcode = 'check_violation';
  end if;

  if new.event_slug <> lead_slug then
    raise exception 'UNIT_EVENT_MISMATCH: unit slug %, lead slug %', new.event_slug, lead_slug
      using errcode = 'check_violation';
  end if;

  if new.unit_index > lead_qty then
    raise exception 'UNIT_INDEX_EXCEEDS_QUANTITY: index %, lead quantity %', new.unit_index, lead_qty
      using errcode = 'check_violation';
  end if;

  -- paid_each is the face value the seller attests to. ask_each is already
  -- CHECKed <= paid_each on the lead; cap against both so an ask edit can never
  -- be outrun by a stale unit price.
  if lead_paid is not null and new.price_each > lead_paid then
    raise exception 'UNIT_PRICE_CAP_EXCEEDED: price %, face value %', new.price_each, lead_paid
      using errcode = 'check_violation';
  end if;

  if lead_ask is not null and new.price_each > lead_ask then
    raise exception 'UNIT_PRICE_ABOVE_ASK: price %, ask %', new.price_each, lead_ask
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists beta_ticket_units_enforce_price_cap on public.beta_ticket_units;
create trigger beta_ticket_units_enforce_price_cap
  before insert or update of price_each, event_slug, sell_lead_id, unit_index
  on public.beta_ticket_units
  for each row execute function public.enforce_unit_price_cap();

-- ---------------------------------------------------------------------------
-- buy-side price ceiling
--
-- "Alert me at or under $X", captured at join time. The allocator skips a seat
-- whose ceiling is below the unit price, so that buyer never gets the offer,
-- never has to decline, and never stalls the chain. Nullable = no limit.
-- Sell leads leave it null.
-- ---------------------------------------------------------------------------
alter table public.beta_go_leads
  add column if not exists max_price_each numeric(10, 2)
    check (max_price_each is null or max_price_each >= 0);

comment on column public.beta_go_leads.max_price_each is
  'Buy-side ceiling. Seats above it are skipped by the allocator, not offered and declined.';

-- ---------------------------------------------------------------------------
-- beta_queue_seat_state — strikes / dormancy, uniform across both seat sources
-- ---------------------------------------------------------------------------
create table if not exists public.beta_queue_seat_state (
  seat_key      text primary key,
  event_slug    text not null,
  -- Set when consecutive misses cross the threshold. A dormant seat keeps its
  -- rank — it just stops having tickets held for it until it re-confirms.
  dormant_at    timestamptz,
  -- Re-confirm tap. Strikes are counted only from this point forward, which is
  -- what makes dormancy recoverable without deleting history.
  reactivated_at timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists beta_queue_seat_state_event_idx
  on public.beta_queue_seat_state (event_slug);

comment on table public.beta_queue_seat_state is
  'Per-seat dormancy for waitlist matching. Rank never changes; only eligibility does.';

-- ---------------------------------------------------------------------------
-- beta_offers
-- ---------------------------------------------------------------------------
create table if not exists public.beta_offers (
  id                  uuid primary key default gen_random_uuid(),
  -- Siblings allocated together for one seat asking for more than one ticket.
  -- Accept/decline act on the whole group; the uniqueness invariant stays
  -- per-unit, which is what actually prevents a double payment.
  group_id            uuid not null default gen_random_uuid(),
  unit_id             uuid not null references public.beta_ticket_units (id) on delete cascade,
  -- Exactly one of these — real FKs rather than a text key, so a deleted lead
  -- can't leave a dangling offer.
  buy_lead_id         uuid references public.beta_go_leads (id) on delete cascade,
  classic_interest_id uuid references public.beta_member_interests (id) on delete cascade,
  seat_key            text generated always as (
    case
      when buy_lead_id is not null then 'go:' || buy_lead_id::text
      else 'classic:' || classic_interest_id::text
    end
  ) stored,
  event_slug          text not null,
  -- Real 1-based queue rank at offer time (never the padded display number).
  rank                integer not null check (rank >= 1),
  price_each          numeric(10, 2) not null check (price_each >= 0),
  status              offer_status not null default 'offered',
  offered_at          timestamptz not null default now(),
  -- Response clock.
  expires_at          timestamptz not null,
  -- Payment clock. Set when the offer is accepted, not before.
  payment_due_at      timestamptz,
  responded_at        timestamptz,
  decline_reason      text check (decline_reason is null or decline_reason in ('price', 'not_going', 'other')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint beta_offers_exactly_one_seat check (
    (buy_lead_id is not null and classic_interest_id is null)
    or (buy_lead_id is null and classic_interest_id is not null)
  ),
  constraint beta_offers_response_window check (expires_at > offered_at),
  constraint beta_offers_payment_window check (payment_due_at is null or payment_due_at > offered_at),
  -- A payment clock only makes sense once the offer was accepted.
  constraint beta_offers_payment_due_requires_accept check (
    payment_due_at is not null
    or status not in ('accepted', 'paid', 'needs_review', 'expired_unpaid', 'payment_failed')
  )
);

-- THE invariant. At most one live offer per unit — a second buyer physically
-- cannot be allocated a ticket that is already claimed, however many times ops
-- clicks or a sweep re-runs.
--
-- Note this predicate is a static status list, not `now() < expires_at`:
-- Postgres rejects non-immutable functions in a partial index. That is why the
-- allocator must *materialize* an expiry (write the terminal status) before
-- inserting the successor — lazy expiry is a read-side convenience only. See
-- public.allocate_offer below, which does both in one statement.
create unique index if not exists beta_offers_one_live_per_unit
  on public.beta_offers (unit_id)
  where status in ('offered', 'accepted', 'paid', 'needs_review');

create index if not exists beta_offers_seat_live_idx
  on public.beta_offers (seat_key)
  where status in ('offered', 'accepted', 'paid', 'needs_review');

create index if not exists beta_offers_event_status_idx
  on public.beta_offers (event_slug, status, offered_at desc);

create index if not exists beta_offers_group_idx on public.beta_offers (group_id);

create index if not exists beta_offers_expiry_idx
  on public.beta_offers (expires_at)
  where status = 'offered';

create index if not exists beta_offers_payment_due_idx
  on public.beta_offers (payment_due_at)
  where status = 'accepted';

comment on table public.beta_offers is
  'One (unit, seat) allocation with a response clock and a payment clock.';

-- ---------------------------------------------------------------------------
-- Offer guards
-- ---------------------------------------------------------------------------

-- A live offer may only be created against an available unit, for the matching
-- event, for a seat that isn't the seller, and only up to what that seat asked
-- for. The per-unit unique index covers the double-allocation case; this covers
-- everything the index can't express.
create or replace function public.enforce_offer_guards()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  unit_status     ticket_unit_status;
  unit_slug       text;
  unit_sell_lead  uuid;
  seller_contact  uuid;
  seller_member   uuid;
  buyer_contact   uuid;
  buyer_member    uuid;
  buyer_slug      text;
  seat_quantity   integer;
  live_count      integer;
begin
  select status, event_slug, sell_lead_id
    into unit_status, unit_slug, unit_sell_lead
    from public.beta_ticket_units where id = new.unit_id;

  if unit_slug is null then
    raise exception 'OFFER_UNIT_NOT_FOUND: unit % does not exist', new.unit_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.event_slug <> unit_slug then
    raise exception 'OFFER_EVENT_MISMATCH: offer slug %, unit slug %', new.event_slug, unit_slug
      using errcode = 'check_violation';
  end if;

  -- Only gate *becoming* live. Terminal transitions must always be allowed —
  -- otherwise a withdrawn unit could never have its dangling offer closed out.
  if new.status in ('offered', 'accepted', 'paid', 'needs_review') then
    if unit_status <> 'available'
       and not (unit_status = 'sold' and new.status in ('paid', 'needs_review')) then
      raise exception 'OFFER_UNIT_NOT_AVAILABLE: unit % is %', new.unit_id, unit_status
        using errcode = 'check_violation';
    end if;

    -- Seat cap: a seat can hold at most as many live offers as tickets it asked
    -- for. This is what lets a 2-ticket buyer actually obtain 2 while still
    -- bounding how much supply one seat can hold hostage.
    if new.buy_lead_id is not null then
      select quantity, contact_id, member_id, event_slug
        into seat_quantity, buyer_contact, buyer_member, buyer_slug
        from public.beta_go_leads where id = new.buy_lead_id;
    else
      seat_quantity := 1;
      select event_slug into buyer_slug
        from public.beta_member_interests where id = new.classic_interest_id;
    end if;

    if buyer_slug is null then
      raise exception 'OFFER_SEAT_NOT_FOUND: seat % does not exist', new.seat_key
        using errcode = 'foreign_key_violation';
    end if;

    if buyer_slug <> new.event_slug then
      raise exception 'OFFER_SEAT_EVENT_MISMATCH: seat slug %, offer slug %', buyer_slug, new.event_slug
        using errcode = 'check_violation';
    end if;

    select count(*) into live_count
      from public.beta_offers
      where seat_key = new.seat_key
        and status in ('offered', 'accepted', 'paid', 'needs_review')
        and id <> new.id;

    if live_count >= coalesce(seat_quantity, 1) then
      raise exception 'OFFER_SEAT_CAP_EXCEEDED: seat % already holds % live offer(s)', new.seat_key, live_count
        using errcode = 'check_violation';
    end if;

    -- No self-dealing. A contact can hold both a buy and a sell lead for the
    -- same night, so this matches on the person behind the lead, not the lead.
    select contact_id, member_id into seller_contact, seller_member
      from public.beta_go_leads where id = unit_sell_lead;

    if (seller_contact is not null and seller_contact = buyer_contact)
       or (seller_member is not null and seller_member = buyer_member) then
      raise exception 'OFFER_SELF_ALLOCATION: seat % is the seller of unit %', new.seat_key, new.unit_id
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists beta_offers_guards on public.beta_offers;
create trigger beta_offers_guards
  before insert or update on public.beta_offers
  for each row execute function public.enforce_offer_guards();

-- Keep unit status in step with its offer. `sold` follows a paid offer;
-- anything that frees the unit returns it to `available` — except a seller
-- withdrawal, which is a refund, not a requeue, and is set explicitly.
create or replace function public.sync_unit_status_from_offer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'paid' then
    update public.beta_ticket_units
      set status = 'sold', updated_at = now()
      where id = new.unit_id and status <> 'withdrawn';

  elsif new.status in ('declined', 'expired_no_response', 'expired_unpaid', 'payment_failed') then
    -- Reversal of a confirmed payment frees the ticket again; so does any
    -- failure before payment. Never touches a withdrawn unit.
    update public.beta_ticket_units
      set status = 'available', updated_at = now()
      where id = new.unit_id and status = 'sold';

  elsif new.status = 'withdrawn' then
    update public.beta_ticket_units
      set status = 'withdrawn', updated_at = now()
      where id = new.unit_id;
  end if;

  return null;
end;
$$;

drop trigger if exists beta_offers_sync_unit on public.beta_offers;
create trigger beta_offers_sync_unit
  after insert or update of status on public.beta_offers
  for each row execute function public.sync_unit_status_from_offer();

-- ---------------------------------------------------------------------------
-- allocate_offer — expire-then-insert, atomically.
--
-- ADR 0001 records that multi-step writes over supabase-js aren't wrapped in a
-- Postgres transaction. For allocation that isn't acceptable: reconciling a
-- stale offer and inserting its successor in two round-trips leaves a window
-- where a crash strands the unit, and the partial unique index means the
-- insert fails outright if the stale row is still live. One function, one
-- statement, one transaction.
--
-- Returns the new offer id, or null when the unit is genuinely no longer free
-- (someone accepted it, it sold, the seller pulled it) — a normal outcome the
-- allocator skips over, not an error.
-- ---------------------------------------------------------------------------
create or replace function public.allocate_offer(
  p_unit_id             uuid,
  p_buy_lead_id         uuid,
  p_classic_interest_id uuid,
  p_event_slug          text,
  p_rank                integer,
  p_price_each          numeric,
  p_expires_at          timestamptz,
  p_group_id            uuid,
  p_now                 timestamptz default now()
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  -- Serialize allocation attempts for this unit. Two concurrent passes queue
  -- up here instead of racing into the unique index.
  perform 1 from public.beta_ticket_units where id = p_unit_id for update;

  -- Materialize expiries first. A row past its clock is dead, but the index
  -- can't know that, so it has to be written down before the successor exists.
  update public.beta_offers
    set status = case when status = 'offered' then 'expired_no_response'::offer_status
                      else 'expired_unpaid'::offer_status end,
        responded_at = coalesce(responded_at, p_now)
    where unit_id = p_unit_id
      and (
        (status = 'offered' and expires_at <= p_now)
        or (status = 'accepted' and payment_due_at is not null and payment_due_at <= p_now)
      );

  -- Still claimed by a live offer? Then this unit isn't free after all.
  if exists (
    select 1 from public.beta_offers
      where unit_id = p_unit_id
        and status in ('offered', 'accepted', 'paid', 'needs_review')
  ) then
    return null;
  end if;

  if not exists (
    select 1 from public.beta_ticket_units where id = p_unit_id and status = 'available'
  ) then
    return null;
  end if;

  insert into public.beta_offers (
    group_id, unit_id, buy_lead_id, classic_interest_id,
    event_slug, rank, price_each, status, offered_at, expires_at
  ) values (
    coalesce(p_group_id, gen_random_uuid()), p_unit_id, p_buy_lead_id, p_classic_interest_id,
    p_event_slug, p_rank, p_price_each, 'offered', p_now, p_expires_at
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reconcile_expired_offers — the sweep the cron calls.
--
-- Idempotent and safe to re-run: it only rewrites rows whose clock has already
-- run out. Correctness never depends on it firing on time (reads treat an
-- out-of-clock row as dead anyway); it exists so the next person in line gets
-- told promptly.
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_expired_offers(p_now timestamptz default now())
returns table (offer_id uuid, unit_id uuid, event_slug text, seat_key text, new_status offer_status)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  update public.beta_offers o
    set status = case when o.status = 'offered' then 'expired_no_response'::offer_status
                      else 'expired_unpaid'::offer_status end,
        responded_at = coalesce(o.responded_at, p_now)
    where (o.status = 'offered' and o.expires_at <= p_now)
       or (o.status = 'accepted' and o.payment_due_at is not null and o.payment_due_at <= p_now)
    returning o.id, o.unit_id, o.event_slug, o.seat_key, o.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — service-role only, no anon policies (same posture as beta_go_leads in
-- 0013 and beta_queue_config in 0016). All access goes through the ops
-- console's admin client.
-- ---------------------------------------------------------------------------
alter table public.beta_ticket_units enable row level security;
alter table public.beta_offers enable row level security;
alter table public.beta_queue_seat_state enable row level security;

revoke all on function public.allocate_offer(uuid, uuid, uuid, text, integer, numeric, timestamptz, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.reconcile_expired_offers(timestamptz) from public, anon, authenticated;

commit;

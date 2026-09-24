-- 20260923090000 — Data capture, part 1 of 4: the lifecycle event log.
--
-- Spec: CLAUDE_SPECS/DATA_CAPTURE.md § 2 ("History, not just current state",
-- "Timestamps and provenance"). ADR 0006 records the design reasoning.
--
-- What this adds
-- --------------
-- `lifecycle_events` is one append-only, semantically-named row per meaningful
-- state change anywhere in the ticket economy: a unit created, an offer
-- accepted, a payment confirmed, a payout released, a lead deleted. It is
-- written by database triggers, not by application code, so no write path —
-- ops console, cron sweep, a psql session, a future service — can change a
-- ticket without leaving a trace.
--
-- Why not extend `analytics_events` (0001)
-- ----------------------------------------
-- That table is a best-effort behavioural funnel: fire-and-forget from the app
-- (`lib/analytics/log.ts` swallows its own failures by design), no before/after
-- state, no actor. Useful for "how many people opened /buy"; useless for "what
-- did this offer look like before ops touched it". Both are kept: behaviour
-- stays in `analytics_events`, state history lands here.
--
-- Deliberately NO foreign keys
-- ----------------------------
-- `beta_ticket_units.sell_lead_id`, `beta_offers.unit_id` and friends cascade
-- on delete, and `deleteQuickLead` / `removeSellLead` are real code paths. An
-- FK from the log to its subject would mean deleting one lead erases the entire
-- history of every unit and offer beneath it — exactly the history this table
-- exists to keep. Subjects are referenced by (subject_type, subject_id), and
-- DELETE is logged too, with the final snapshot.

begin;

-- ---------------------------------------------------------------------------
-- Vocabulary
--
-- A reference catalog, not a foreign key. If a trigger ever emits a name that
-- isn't listed here the write still succeeds (an audit log that can reject a
-- user's ticket sale is worse than an unfamiliar label), and the
-- `lifecycle_event_unknown_name` integrity check surfaces it afterwards.
-- ---------------------------------------------------------------------------
create table if not exists public.lifecycle_event_types (
  name        text primary key,
  category    text not null check (category in (
                'ticket', 'offer', 'money', 'lead', 'deal', 'contact',
                'listing', 'transaction', 'ops'
              )),
  description text not null,
  created_at  timestamptz not null default now()
);

comment on table public.lifecycle_event_types is
  'Documented vocabulary for lifecycle_events.event_name. Reference only — no FK, so an unknown name can never fail a write.';

insert into public.lifecycle_event_types (name, category, description) values
  ('unit_created',                 'ticket',      'A sellable ticket was materialized from a sell lead.'),
  ('unit_sold',                    'ticket',      'Unit moved to sold (a paid offer claimed it).'),
  ('unit_returned_to_pool',        'ticket',      'Unit became available again after an offer failed or reversed.'),
  ('unit_withdrawn',               'ticket',      'Seller pulled the ticket; refund path, not a requeue.'),
  ('unit_status_changed',          'ticket',      'Unit status changed to something without a more specific name.'),
  ('unit_price_changed',           'ticket',      'Unit price_each was edited.'),
  ('unit_updated',                 'ticket',      'Unit changed in a way with no more specific name.'),
  ('unit_deleted',                 'ticket',      'Unit row was deleted (usually a cascade from its sell lead).'),
  ('offer_created',                'offer',       'A unit was allocated to a waitlist seat; response clock started.'),
  ('offer_accepted',               'offer',       'Buyer accepted; payment clock started.'),
  ('offer_declined',               'offer',       'Buyer explicitly passed.'),
  ('offer_expired_no_response',    'offer',       'Response clock ran out with no answer.'),
  ('offer_expired_unpaid',         'offer',       'Accepted then never paid.'),
  ('offer_payment_failed',         'offer',       'E-transfer bounced, was cancelled, or came in wrong.'),
  ('offer_flagged_for_review',     'offer',       'Ambiguous or partial payment — a human decides.'),
  ('offer_withdrawn',              'offer',       'Seller pulled out from under a live offer.'),
  ('offer_status_changed',         'offer',       'Offer status changed to something without a more specific name.'),
  ('offer_updated',                'offer',       'Offer changed in a way with no more specific name.'),
  ('offer_deleted',                'offer',       'Offer row was deleted.'),
  ('buyer_payment_declared',       'money',       'Buyer tapped "I''ve sent the money".'),
  ('buyer_payment_confirmed',      'money',       'Ops confirmed the buyer''s Interac payment against the offer.'),
  ('ticket_forwarded_to_buyer',    'money',       'Ops forwarded the ticket from platform custody to the buyer.'),
  ('seller_payout_released',       'money',       'Ops sent the Interac payout to the seller.'),
  ('seller_payout_confirmed',      'money',       'Seller acknowledged receiving the payout.'),
  ('seller_declared_ticket_sent',  'ticket',      'Seller says the ticket was transferred into platform custody.'),
  ('ticket_received_by_platform',  'ticket',      'Ops verified the ticket arrived in platform custody.'),
  ('sell_lead_created',            'lead',        'Someone listed one or more tickets for sale.'),
  ('buy_lead_created',             'lead',        'Someone took a waitlist seat.'),
  ('lead_status_changed',          'lead',        'Ops or the app moved a lead through its status.'),
  ('lead_price_changed',           'lead',        'Ask, paid, or buyer ceiling was edited.'),
  ('lead_quantity_changed',        'lead',        'Ticket count on the lead was edited.'),
  ('lead_linked_to_contact',       'lead',        'Lead was attached to a returning contact or member.'),
  ('lead_updated',                 'lead',        'Lead changed in a way with no more specific name.'),
  ('lead_deleted',                 'lead',        'Lead row was deleted.'),
  ('deal_created',                 'deal',        'Operational deal record opened for a unit.'),
  ('deal_stage_changed',           'deal',        'Deal moved between lifecycle stages.'),
  ('deal_deleted',                 'deal',        'Deal row was deleted.'),
  ('contact_created',              'contact',     'A returning-visitor contact profile was created.'),
  ('contact_linked_to_member',     'contact',     'Contact was linked to a full beta member.'),
  ('contact_updated',              'contact',     'Contact details changed (values redacted in the log).'),
  ('contact_deleted',              'contact',     'Contact row was deleted.'),
  ('interest_created',             'lead',        'A classic member took a per-event waitlist seat.'),
  ('interest_deleted',             'lead',        'A classic member''s waitlist seat was removed.'),
  ('listing_created',              'listing',     'Card-payment path: a listing was posted.'),
  ('listing_status_changed',       'listing',     'Card-payment path: listing status changed.'),
  ('listing_removed',              'listing',     'Card-payment path: admin removed a listing.'),
  ('listing_deleted',              'listing',     'Card-payment path: listing row was deleted.'),
  ('transaction_created',          'transaction', 'Card-payment path: a transaction was opened.'),
  ('transaction_escrow_changed',   'transaction', 'Card-payment path: escrow state moved.'),
  ('transaction_buyer_confirmed',  'transaction', 'Card-payment path: buyer confirmed entry.'),
  ('transaction_disputed',         'transaction', 'Card-payment path: a dispute was opened.'),
  ('transaction_deleted',          'transaction', 'Card-payment path: transaction row was deleted.'),
  ('manual_ops_note',              'ops',         'An off-app action ops recorded by hand against a subject.')
on conflict (name) do update set
  category = excluded.category,
  description = excluded.description;

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------
create table if not exists public.lifecycle_events (
  id             bigint generated always as identity primary key,

  -- Semantic name. Pattern-checked rather than list-checked so the trigger can
  -- never fail a business write on an unfamiliar label (see catalog above).
  event_name     text not null check (event_name ~ '^[a-z][a-z0-9_]{2,63}$'),

  subject_type   text not null check (subject_type in (
                   'ticket_unit', 'offer', 'sell_lead', 'buy_lead', 'lead',
                   'contact', 'member', 'deal', 'interest', 'listing',
                   'transaction', 'event'
                 )),
  subject_id     uuid,
  -- For subjects whose primary key is text (event_slug, seat_key).
  subject_key    text,

  -- Denormalized joins. Every one of these is nullable and none is an FK:
  -- they make "everything that happened to this ticket / this offer / this
  -- night" a single indexed scan, and they survive the deletion of the row
  -- they point at.
  event_slug     text,
  unit_id        uuid,
  offer_id       uuid,
  sell_lead_id   uuid,
  buy_lead_id    uuid,
  contact_id     uuid,
  seat_key       text,

  -- Provenance. Set from transaction-local GUCs by the write-path RPCs in
  -- part 2; 'system' when a write arrives outside one of them.
  actor_kind     text not null default 'system' check (actor_kind in (
                   'buyer', 'seller', 'ops', 'admin', 'system', 'cron', 'webhook', 'script'
                 )),
  actor_id       uuid,
  actor_label    text,
  source         text not null default 'db_trigger' check (source in (
                   'app', 'ops_console', 'db_trigger', 'cron', 'webhook',
                   'script', 'backfill', 'manual'
                 )),
  -- One human action can fan out into several rows (an offer status change
  -- syncs the unit row through sync_unit_status_from_offer). Same action, same
  -- correlation_id.
  correlation_id uuid,

  previous_state text,
  new_state      text,
  changed_fields text[] not null default '{}',
  -- Money committed or moved by this event, when the event is about money.
  -- No >= 0 check: a correction or reversal is a legitimate negative.
  amount         numeric(10,2),

  -- Redacted row snapshots — enough to reconstruct prior state, with PII
  -- replaced by "[redacted]" (SECURITY.md § "never log sensitive data"; the
  -- field *names* still show up in changed_fields, so you can see that a phone
  -- number changed without the log holding phone numbers).
  before_data    jsonb,
  after_data     jsonb,

  metadata       jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),

  constraint lifecycle_events_subject_identified
    check (subject_id is not null or subject_key is not null)
);

comment on table public.lifecycle_events is
  'Append-only history of every state change in the ticket economy. Trigger-written; no FKs by design (see migration header).';
comment on column public.lifecycle_events.changed_fields is
  'Column names that actually changed, computed before redaction.';
comment on column public.lifecycle_events.correlation_id is
  'Ties the rows produced by one action together (offer change -> unit sync).';

create index if not exists lifecycle_events_subject_idx
  on public.lifecycle_events (subject_type, subject_id, occurred_at desc);
create index if not exists lifecycle_events_name_time_idx
  on public.lifecycle_events (event_name, occurred_at desc);
create index if not exists lifecycle_events_event_slug_idx
  on public.lifecycle_events (event_slug, occurred_at desc)
  where event_slug is not null;
create index if not exists lifecycle_events_unit_idx
  on public.lifecycle_events (unit_id, occurred_at)
  where unit_id is not null;
create index if not exists lifecycle_events_offer_idx
  on public.lifecycle_events (offer_id, occurred_at)
  where offer_id is not null;
create index if not exists lifecycle_events_sell_lead_idx
  on public.lifecycle_events (sell_lead_id, occurred_at)
  where sell_lead_id is not null;
create index if not exists lifecycle_events_buy_lead_idx
  on public.lifecycle_events (buy_lead_id, occurred_at)
  where buy_lead_id is not null;
create index if not exists lifecycle_events_contact_idx
  on public.lifecycle_events (contact_id, occurred_at)
  where contact_id is not null;
create index if not exists lifecycle_events_correlation_idx
  on public.lifecycle_events (correlation_id)
  where correlation_id is not null;
create index if not exists lifecycle_events_time_idx
  on public.lifecycle_events (occurred_at desc);

-- ---------------------------------------------------------------------------
-- Redaction + diffing helpers
-- ---------------------------------------------------------------------------

-- Columns whose *values* never enter the log. Names still appear in
-- changed_fields, which is what you actually need for forensics.
create or replace function public.lifecycle_redact(p_row jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p_row is null then null
    else (
      select coalesce(jsonb_object_agg(
               key,
               case when key = any (array[
                 'contact_phone', 'contact_instagram',
                 'etransfer_name', 'etransfer_email', 'etransfer_phone',
                 'transfer_first_name', 'transfer_last_name', 'transfer_email',
                 'ticket_share_url', 'ticket_evidence_path',
                 'admin_notes', 'notes', 'decline_note', 'payment_reference',
                 'name', 'email', 'phone', 'details', 'message',
                 'display_name', 'handle', 'interested_other', 'referral_source',
                 'school', 'disclosure_snapshot', 'ticket_barcode_hash',
                 'producer_contact', 'agreement_reference', 'payload'
               ]) then '"[redacted]"'::jsonb
               else value end
             ), '{}'::jsonb)
      from jsonb_each(p_row)
    )
  end;
$$;

comment on function public.lifecycle_redact(jsonb) is
  'Strips PII values from a row snapshot before it lands in lifecycle_events. Keys are kept so diffs stay readable.';

-- Which top-level keys differ, ignoring bookkeeping columns that change on
-- every touch and would otherwise make every row look "changed".
create or replace function public.lifecycle_changed_keys(p_before jsonb, p_after jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(k order by k), '{}')
  from (
    select key as k
    from jsonb_each(coalesce(p_after, '{}'::jsonb))
    where key <> all (array['updated_at', 'last_seen_at'])
      and (p_before is null or (p_before -> key) is distinct from (p_after -> key))
    union
    select key
    from jsonb_each(coalesce(p_before, '{}'::jsonb))
    where key <> all (array['updated_at', 'last_seen_at'])
      and p_after is not null
      and (p_after -> key) is null
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- Actor context
--
-- Read from transaction-local GUCs. Part 2's write-path RPCs set them with
-- set_config(..., is_local => true) inside their own body, so the value is
-- visible to triggers in the same transaction and cannot leak into the next
-- statement on a pooled connection. Anything the caller sets that isn't a
-- known value is normalized away rather than allowed to fail the write.
-- ---------------------------------------------------------------------------
create or replace function public.lifecycle_actor_kind()
returns text
language sql
stable
as $$
  -- Unset, blank, or unrecognised all collapse to 'system'. The log's CHECK
  -- constraint must never be the reason a ticket sale fails.
  select case
    when coalesce(nullif(current_setting('app.actor_kind', true), ''), 'system')
         = any (array['buyer','seller','ops','admin','system','cron','webhook','script'])
    then coalesce(nullif(current_setting('app.actor_kind', true), ''), 'system')
    else 'system'
  end;
$$;

create or replace function public.lifecycle_source()
returns text
language sql
stable
as $$
  select case
    when coalesce(nullif(current_setting('app.source', true), ''), 'db_trigger')
         = any (array['app','ops_console','db_trigger','cron','webhook','script','backfill','manual'])
    then coalesce(nullif(current_setting('app.source', true), ''), 'db_trigger')
    else 'db_trigger'
  end;
$$;

create or replace function public.lifecycle_actor_id()
returns uuid
language plpgsql
stable
as $$
begin
  return nullif(current_setting('app.actor_id', true), '')::uuid;
exception when others then
  return null;
end;
$$;

-- With no explicit correlation set, fall back to a value derived from the
-- transaction and the current client statement. Everything one statement
-- produces — including the unit row that `sync_unit_status_from_offer` touches
-- from inside the offer's own trigger — lands under the same id, because
-- statement_timestamp() only advances for top-level statements.
create or replace function public.lifecycle_correlation_id()
returns uuid
language plpgsql
stable
as $$
begin
  return coalesce(
    nullif(current_setting('app.correlation_id', true), '')::uuid,
    md5(txid_current()::text || statement_timestamp()::text)::uuid
  );
exception when others then
  return md5(txid_current()::text || statement_timestamp()::text)::uuid;
end;
$$;

create or replace function public.set_actor_context(
  p_actor_kind     text default 'system',
  p_actor_id       uuid default null,
  p_actor_label    text default null,
  p_source         text default 'app',
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  corr uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  -- is_local => true: scoped to this transaction, so a pooled connection never
  -- carries one caller's identity into the next request.
  perform set_config('app.actor_kind', coalesce(p_actor_kind, 'system'), true);
  perform set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);
  perform set_config('app.actor_label', coalesce(left(p_actor_label, 200), ''), true);
  perform set_config('app.source', coalesce(p_source, 'app'), true);
  perform set_config('app.correlation_id', corr::text, true);
  return corr;
end;
$$;

comment on function public.set_actor_context(text, uuid, text, text, uuid) is
  'Sets transaction-local provenance read by the lifecycle triggers. Only useful inside another function or an explicit transaction.';

-- ---------------------------------------------------------------------------
-- The single insert point
-- ---------------------------------------------------------------------------
create or replace function public.lifecycle_emit(
  p_event_name     text,
  p_subject_type   text,
  p_subject_id     uuid,
  p_event_slug     text default null,
  p_previous_state text default null,
  p_new_state      text default null,
  p_before         jsonb default null,
  p_after          jsonb default null,
  p_amount         numeric default null,
  p_metadata       jsonb default '{}'::jsonb,
  p_unit_id        uuid default null,
  p_offer_id       uuid default null,
  p_sell_lead_id   uuid default null,
  p_buy_lead_id    uuid default null,
  p_contact_id     uuid default null,
  p_seat_key       text default null,
  p_subject_key    text default null,
  p_occurred_at    timestamptz default null,
  p_source         text default null,
  p_actor_kind     text default null,
  p_actor_label    text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  insert into public.lifecycle_events (
    event_name, subject_type, subject_id, subject_key, event_slug,
    unit_id, offer_id, sell_lead_id, buy_lead_id, contact_id, seat_key,
    actor_kind, actor_id, actor_label, source, correlation_id,
    previous_state, new_state, changed_fields, amount,
    before_data, after_data, metadata, occurred_at
  ) values (
    p_event_name, p_subject_type, p_subject_id, p_subject_key, p_event_slug,
    p_unit_id, p_offer_id, p_sell_lead_id, p_buy_lead_id, p_contact_id, p_seat_key,
    coalesce(p_actor_kind, public.lifecycle_actor_kind()),
    public.lifecycle_actor_id(),
    coalesce(p_actor_label, nullif(current_setting('app.actor_label', true), '')),
    coalesce(p_source, public.lifecycle_source()),
    public.lifecycle_correlation_id(),
    p_previous_state, p_new_state,
    public.lifecycle_changed_keys(p_before, p_after),
    p_amount,
    public.lifecycle_redact(p_before), public.lifecycle_redact(p_after),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access: service role only.
--
-- Both belt (RLS with no policies) and braces (no table grant at all). The
-- grant matters independently: this project has a default-privileges rule that
-- hands anon/authenticated full access to tables created by the dashboard role
-- — the same trap 0009 documents — so a table that only enables RLS while
-- keeping its grant is one forgotten policy away from being readable. The log
-- holds the full change history of every ticket and lead; it is read through
-- the service-role client from the ops console and nowhere else.
-- ---------------------------------------------------------------------------
alter table public.lifecycle_events enable row level security;
alter table public.lifecycle_event_types enable row level security;

revoke all on public.lifecycle_events from anon, authenticated;
revoke all on public.lifecycle_event_types from anon, authenticated;
revoke all on function public.lifecycle_redact(jsonb) from public, anon, authenticated;
revoke all on function public.lifecycle_changed_keys(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.lifecycle_actor_kind() from public, anon, authenticated;
revoke all on function public.lifecycle_source() from public, anon, authenticated;
revoke all on function public.lifecycle_actor_id() from public, anon, authenticated;
revoke all on function public.lifecycle_correlation_id() from public, anon, authenticated;

-- Explicit rather than inherited: Supabase's default privileges grant new
-- objects to service_role only when the migration runs as `postgres`, and this
-- repo has applied migrations both ways (README § Database).
grant select, insert on public.lifecycle_events to service_role;
grant usage, select on sequence public.lifecycle_events_id_seq to service_role;
grant select on public.lifecycle_event_types to service_role;

commit;

-- 20260923090300 — Data capture, part 4 of 6: integrity checks.
--
-- DATA_CAPTURE.md § 2 "Structural integrity" and § 3.6: bad states should be
-- discoverable by query, not by a user complaint. The constraints and triggers
-- from 0001/0021 prevent what can be prevented cheaply (one live offer per
-- unit, price ceilings, seat caps); this is for everything that can still drift
-- — a paid offer nobody paid out, a ticket forwarded without money, a sweep
-- that didn't run, a half-finished ops click.
--
-- `integrity_findings` is a plain view, so it is always current. Running it
-- through `run_integrity_checks()` snapshots the result into
-- `integrity_findings_log` so a finding that appears and disappears still
-- leaves a trace, and so "is this getting better or worse" is answerable.
--
-- Adding a check = adding one UNION ALL block with a new `check_name`. Nothing
-- else needs to change: the runner, the log table and the ops surface are all
-- driven off the view's output.

begin;

create or replace view public.integrity_findings as

-- ── Ticket unit vs offer contradictions ────────────────────────────────────
select
  'unit_sold_without_paid_offer'::text as check_name,
  'critical'::text                    as severity,
  'ticket_unit'::text                 as subject_type,
  u.id                                as subject_id,
  ('unit ' || u.unit_index || ' of lead ' || u.sell_lead_id)::text as subject_label,
  u.event_slug                        as event_slug,
  jsonb_build_object('status', u.status, 'price_each', u.price_each,
                     'sell_lead_id', u.sell_lead_id) as detail
from public.beta_ticket_units u
where u.status = 'sold'
  and not exists (
    select 1 from public.beta_offers o
     where o.unit_id = u.id and o.status = 'paid'
  )

union all
select 'unit_available_with_live_offer', 'critical', 'ticket_unit', u.id,
       ('unit ' || u.unit_index)::text, u.event_slug,
       jsonb_build_object('live_offer_id', o.id, 'offer_status', o.status)
from public.beta_ticket_units u
join public.beta_offers o
  on o.unit_id = u.id and o.status in ('offered', 'accepted', 'paid', 'needs_review')
where u.status = 'available' and o.status in ('paid', 'needs_review')

union all
select 'unit_withdrawn_with_paid_offer', 'critical', 'ticket_unit', u.id,
       ('unit ' || u.unit_index)::text, u.event_slug,
       jsonb_build_object('offer_id', o.id, 'amount', o.payment_amount)
from public.beta_ticket_units u
join public.beta_offers o on o.unit_id = u.id and o.status = 'paid'
where u.status = 'withdrawn'

union all
select 'multiple_live_offers_per_unit', 'critical', 'ticket_unit', o.unit_id,
       null, min(o.event_slug),
       jsonb_build_object('live_offers', count(*), 'offer_ids', jsonb_agg(o.id))
from public.beta_offers o
where o.status in ('offered', 'accepted', 'paid', 'needs_review')
group by o.unit_id
having count(*) > 1

-- ── Money ──────────────────────────────────────────────────────────────────
union all
select 'offer_paid_amount_mismatch', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('price_each', o.price_each, 'payment_amount', o.payment_amount)
from public.beta_offers o
where o.status = 'paid'
  and o.payment_amount is not null
  and o.payment_amount is distinct from o.price_each

union all
select 'offer_paid_without_payment_record', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('payment_recorded_at', o.payment_recorded_at,
                          'payment_amount', o.payment_amount)
from public.beta_offers o
where o.status = 'paid' and (o.payment_recorded_at is null or o.payment_amount is null)

union all
select 'offer_forwarded_without_payment', 'critical', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('status', o.status, 'ticket_transferred_at', o.ticket_transferred_at)
from public.beta_offers o
where o.ticket_transferred_at is not null and o.status <> 'paid'

union all
select 'payout_released_before_ticket_forwarded', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('payout_released_at', o.payout_released_at,
                          'ticket_transferred_at', o.ticket_transferred_at)
from public.beta_offers o
where o.payout_released_at is not null
  and (o.ticket_transferred_at is null or o.payout_released_at < o.ticket_transferred_at)

union all
select 'paid_offer_awaiting_payout', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('paid_at', o.payment_recorded_at,
                          'hours_waiting',
                          round(extract(epoch from now() - o.payment_recorded_at) / 3600))
from public.beta_offers o
where o.status = 'paid'
  and o.payout_released_at is null
  and o.payment_recorded_at < now() - interval '72 hours'

union all
select 'paid_offer_ticket_not_forwarded', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('paid_at', o.payment_recorded_at)
from public.beta_offers o
where o.status = 'paid'
  and o.ticket_transferred_at is null
  and o.payment_recorded_at < now() - interval '24 hours'

union all
select 'buyer_payment_declared_unverified', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('declared_at', o.buyer_declared_sent_at,
                          'hours_waiting',
                          round(extract(epoch from now() - o.buyer_declared_sent_at) / 3600))
from public.beta_offers o
where o.status = 'accepted'
  and o.buyer_declared_sent_at is not null
  and o.buyer_declared_sent_at < now() - interval '24 hours'

-- ── Clocks that should have been swept ─────────────────────────────────────
union all
select 'offer_accepted_past_payment_due', 'warning', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('payment_due_at', o.payment_due_at)
from public.beta_offers o
where o.status = 'accepted' and o.payment_due_at is not null and o.payment_due_at <= now()

union all
select 'offer_offered_past_expiry', 'info', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('expires_at', o.expires_at)
from public.beta_offers o
where o.status = 'offered' and o.expires_at <= now()

-- ── Price ceilings (Bill 10). Triggers refuse these writes; if one ever shows
--    up here, a layer was removed or data arrived around the app. ───────────
union all
select 'unit_price_above_lead_face_value', 'critical', 'ticket_unit', u.id,
       null, u.event_slug,
       jsonb_build_object('price_each', u.price_each, 'paid_each', l.paid_each)
from public.beta_ticket_units u
join public.beta_go_leads l on l.id = u.sell_lead_id
where l.paid_each is not null and u.price_each > l.paid_each

union all
select 'offer_price_above_unit_price', 'critical', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('offer_price', o.price_each, 'unit_price', u.price_each)
from public.beta_offers o
join public.beta_ticket_units u on u.id = o.unit_id
where o.price_each > u.price_each

-- ── Referential / shape drift ──────────────────────────────────────────────
union all
select 'offer_event_slug_mismatch', 'critical', 'offer', o.id,
       null, o.event_slug,
       jsonb_build_object('offer_slug', o.event_slug, 'unit_slug', u.event_slug)
from public.beta_offers o
join public.beta_ticket_units u on u.id = o.unit_id
where o.event_slug is distinct from u.event_slug

union all
select 'offer_without_seat', 'critical', 'offer', o.id, null, o.event_slug,
       jsonb_build_object('status', o.status)
from public.beta_offers o
where o.buy_lead_id is null and o.classic_interest_id is null

union all
select 'unit_on_non_sell_lead', 'critical', 'ticket_unit', u.id, null, u.event_slug,
       jsonb_build_object('lead_intent', l.intent)
from public.beta_ticket_units u
join public.beta_go_leads l on l.id = u.sell_lead_id
where l.intent <> 'sell'

union all
select 'sell_lead_unit_count_mismatch', 'warning', 'sell_lead', l.id, null, l.event_slug,
       jsonb_build_object('quantity', l.quantity, 'units', count(u.id))
from public.beta_go_leads l
left join public.beta_ticket_units u on u.sell_lead_id = l.id
where l.intent = 'sell' and l.status <> 'cancelled'
group by l.id, l.quantity, l.event_slug
having count(u.id) <> l.quantity

-- ── Ticket custody ─────────────────────────────────────────────────────────
union all
select 'seller_declared_ticket_not_received', 'warning', 'sell_lead', l.id, null, l.event_slug,
       jsonb_build_object('declared_at', l.seller_ticket_sent_at)
from public.beta_go_leads l
where l.intent = 'sell'
  and l.status <> 'cancelled'
  and l.seller_ticket_sent_at is not null
  and l.ticket_received_at is null
  and l.seller_ticket_sent_at < now() - interval '24 hours'

union all
select 'ticket_received_without_declaration', 'info', 'sell_lead', l.id, null, l.event_slug,
       jsonb_build_object('received_at', l.ticket_received_at,
                          'received_by', l.ticket_received_by)
from public.beta_go_leads l
where l.intent = 'sell'
  and l.ticket_received_at is not null
  and l.seller_ticket_sent_at is null

-- ── Deals vs offers ────────────────────────────────────────────────────────
union all
select 'deal_stage_conflicts_offer_status', 'warning', 'deal', d.id, null, d.event_slug,
       jsonb_build_object('stage', d.stage, 'offer_status', o.status)
from public.beta_deals d
join public.beta_offers o on o.id = d.offer_id
where (d.stage = 'completed' and o.status <> 'paid')
   or (d.stage not in ('completed', 'cancelled', 'failed', 'refund_required')
       and o.status in ('declined', 'expired_no_response', 'expired_unpaid',
                        'payment_failed', 'withdrawn'))

-- ── People ─────────────────────────────────────────────────────────────────
union all
select 'duplicate_contact_identity', 'warning', 'contact',
       (array_agg(c.id order by c.created_at))[1], null, null,
       jsonb_build_object('identity_kind', 'instagram', 'contacts', count(*))
from public.beta_go_contacts c
where coalesce(trim(c.contact_instagram), '') <> ''
group by lower(trim(c.contact_instagram))
having count(*) > 1

-- ── The card-payment path (dormant during the Interac beta) ────────────────
union all
select 'listing_sold_without_transaction', 'critical', 'listing', li.id, null, null,
       jsonb_build_object('status', li.status, 'price', li.price)
from public.listings li
where li.status = 'sold'
  and not exists (select 1 from public.transactions t where t.listing_id = li.id)

union all
select 'transaction_held_over_7_days', 'warning', 'transaction', t.id, null, null,
       jsonb_build_object('escrow_status', t.escrow_status, 'created_at', t.created_at)
from public.transactions t
where t.escrow_status = 'held' and t.created_at < now() - interval '7 days'

union all
select 'transaction_released_without_sold_listing', 'warning', 'transaction', t.id, null, null,
       jsonb_build_object('escrow_status', t.escrow_status, 'listing_status', li.status)
from public.transactions t
join public.listings li on li.id = t.listing_id
where t.escrow_status = 'released' and li.status <> 'sold'

-- ── The log policing itself ────────────────────────────────────────────────
union all
select 'lifecycle_event_unknown_name', 'info', 'event', null, e.event_name, null,
       jsonb_build_object('event_name', e.event_name, 'occurrences', count(*))
from public.lifecycle_events e
left join public.lifecycle_event_types t on t.name = e.event_name
where t.name is null
group by e.event_name

union all
select 'paid_offer_without_history', 'info', 'offer', o.id, null, o.event_slug,
       jsonb_build_object('paid_at', o.payment_recorded_at)
from public.beta_offers o
where o.status = 'paid'
  and not exists (
    select 1 from public.lifecycle_events e
     where e.offer_id = o.id and e.event_name = 'buyer_payment_confirmed'
  );

comment on view public.integrity_findings is
  'Every bad state we know how to name, as one row each. Service-role only; surfaced in /ops/data and snapshotted by run_integrity_checks().';

-- ---------------------------------------------------------------------------
-- Snapshots, so findings have a history of their own
-- ---------------------------------------------------------------------------
create table if not exists public.integrity_check_runs (
  id             uuid primary key default gen_random_uuid(),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  source         text not null default 'manual'
                   check (source in ('manual', 'cron', 'ops_console', 'script')),
  finding_count  integer not null default 0,
  critical_count integer not null default 0,
  warning_count  integer not null default 0,
  info_count     integer not null default 0
);

create index if not exists integrity_check_runs_time_idx
  on public.integrity_check_runs (started_at desc);

create table if not exists public.integrity_findings_log (
  id            bigint generated always as identity primary key,
  run_id        uuid not null references public.integrity_check_runs (id) on delete cascade,
  check_name    text not null,
  severity      text not null check (severity in ('critical', 'warning', 'info')),
  subject_type  text,
  subject_id    uuid,
  subject_label text,
  event_slug    text,
  detail        jsonb not null default '{}'::jsonb,
  detected_at   timestamptz not null default now()
);

create index if not exists integrity_findings_log_run_idx
  on public.integrity_findings_log (run_id, severity);
create index if not exists integrity_findings_log_check_idx
  on public.integrity_findings_log (check_name, detected_at desc);
create index if not exists integrity_findings_log_subject_idx
  on public.integrity_findings_log (subject_type, subject_id, detected_at desc);

create or replace function public.run_integrity_checks(p_source text default 'manual')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_run_id uuid;
  v_total integer;
  v_crit integer;
  v_warn integer;
  v_info integer;
begin
  insert into public.integrity_check_runs (source)
  values (case when p_source in ('manual','cron','ops_console','script') then p_source else 'manual' end)
  returning id into v_run_id;

  insert into public.integrity_findings_log (
    run_id, check_name, severity, subject_type, subject_id, subject_label, event_slug, detail
  )
  select v_run_id, f.check_name, f.severity, f.subject_type, f.subject_id,
         f.subject_label, f.event_slug, f.detail
  from public.integrity_findings f;

  select count(*),
         count(*) filter (where severity = 'critical'),
         count(*) filter (where severity = 'warning'),
         count(*) filter (where severity = 'info')
    into v_total, v_crit, v_warn, v_info
    from public.integrity_findings_log
   where run_id = v_run_id;

  update public.integrity_check_runs
     set finished_at = now(), finding_count = v_total,
         critical_count = v_crit, warning_count = v_warn, info_count = v_info
   where id = v_run_id;

  return jsonb_build_object(
    'ok', true, 'run_id', v_run_id, 'findings', v_total,
    'critical', v_crit, 'warning', v_warn, 'info', v_info
  );
end;
$$;

comment on function public.run_integrity_checks(text) is
  'Snapshots integrity_findings into integrity_findings_log. Called by the /api/v1/cron/integrity-check route and from /ops/data.';

-- ---------------------------------------------------------------------------
-- Access: service role only.
--
-- Note these are plain views, which in Postgres run with the *owner's* rights —
-- a view over an RLS-protected table hands out everything the owner can see.
-- So none of this is granted to anon or authenticated; the ops console reads it
-- through the service-role client behind its own password gate
-- (domains/beta-ops/auth.ts). See ADR 0006.
-- ---------------------------------------------------------------------------
alter table public.integrity_check_runs enable row level security;
alter table public.integrity_findings_log enable row level security;

revoke all on public.integrity_findings from anon, authenticated;
revoke all on public.integrity_check_runs from anon, authenticated;
revoke all on public.integrity_findings_log from anon, authenticated;
revoke all on function public.run_integrity_checks(text) from public, anon, authenticated;

grant select on public.integrity_findings to service_role;
grant select on public.integrity_check_runs to service_role;
grant select on public.integrity_findings_log to service_role;
grant usage, select on sequence public.integrity_findings_log_id_seq to service_role;
grant execute on function public.run_integrity_checks(text) to service_role;

commit;

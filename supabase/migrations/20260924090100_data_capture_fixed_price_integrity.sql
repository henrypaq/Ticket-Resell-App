-- 20260924090100 — Data capture: integrity checks for the fixed-price path.
--
-- The resale path's checks live in 20260923090300 and are left exactly as they
-- are: rather than copy that view to add branches to it, it is renamed to
-- `integrity_findings_base` and `integrity_findings` becomes the union of it
-- and the new fixed-price checks. A third source later adds a third branch;
-- `run_integrity_checks()`, the cron route and /ops/data all keep reading one
-- view and need no changes.

begin;

do $$ begin
  alter view public.integrity_findings rename to integrity_findings_base;
exception when undefined_table then null; end $$;

create or replace view public.integrity_findings_fixed_price as

-- Money out with no money in. The RPC refuses this, so a row here means a write
-- got around it.
select
  'fixed_price_ticket_forwarded_without_payment'::text as check_name,
  'critical'::text                                     as severity,
  'buy_lead'::text                                     as subject_type,
  l.id                                                 as subject_id,
  null::text                                           as subject_label,
  l.event_slug                                         as event_slug,
  jsonb_build_object('forwarded_at', l.ticket_forwarded_at,
                     'declared_at', l.buyer_declared_sent_at) as detail
from public.beta_go_leads l
where l.intent = 'buy'
  and l.ticket_forwarded_at is not null
  and l.payment_recorded_at is null

union all
-- A buyer who paid at checkout and is still waiting to be believed.
select 'fixed_price_payment_declared_unverified', 'warning', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('declared_at', l.buyer_declared_sent_at,
                          'amount', l.payment_amount,
                          'hours_waiting',
                          round(extract(epoch from now() - l.buyer_declared_sent_at) / 3600))
from public.beta_go_leads l
where l.intent = 'buy'
  and l.buyer_declared_sent_at is not null
  and l.payment_recorded_at is null
  and l.status <> 'cancelled'
  and l.buyer_declared_sent_at < now() - interval '24 hours'

union all
-- Paid, and still holding nothing.
select 'fixed_price_paid_ticket_not_delivered', 'warning', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('paid_at', l.payment_recorded_at,
                          'hours_waiting',
                          round(extract(epoch from now() - l.payment_recorded_at) / 3600))
from public.beta_go_leads l
where l.intent = 'buy'
  and l.payment_recorded_at is not null
  and l.ticket_forwarded_at is null
  and l.payment_recorded_at < now() - interval '24 hours'

union all
-- Charged less than the tickets themselves cost. Checkout adds a service fee on
-- top (lib/compliance/fixed-price.ts), so the ticket component is the floor —
-- anything under it means the buyer was asked for too little, whatever the fee.
select 'fixed_price_amount_below_ticket_price', 'critical', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('declared_amount', l.payment_amount,
                          'tickets_cost', round(c.fixed_price_each * l.quantity, 2),
                          'fixed_price_each', c.fixed_price_each,
                          'quantity', l.quantity)
from public.beta_go_leads l
join public.beta_event_catalog c on c.slug = l.event_slug
where l.intent = 'buy'
  and l.buyer_declared_sent_at is not null
  and c.fixed_price_each is not null
  and l.payment_amount is not null
  and l.payment_amount < round(c.fixed_price_each * l.quantity, 2)

union all
-- Exact check, but only where the event configures its own fee. When
-- service_fee_each is null checkout falls back to the platform default, which
-- lives in TypeScript (SERVICE_FEE_CAD) — duplicating that number here would
-- just create a second source of truth to drift. The floor check above still
-- covers those events.
select 'fixed_price_amount_mismatch', 'warning', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('declared_amount', l.payment_amount,
                          'expected', round((c.fixed_price_each + c.service_fee_each) * l.quantity, 2),
                          'fixed_price_each', c.fixed_price_each,
                          'service_fee_each', c.service_fee_each,
                          'quantity', l.quantity)
from public.beta_go_leads l
join public.beta_event_catalog c on c.slug = l.event_slug
where l.intent = 'buy'
  and l.buyer_declared_sent_at is not null
  and c.fixed_price_each is not null
  and c.service_fee_each is not null
  and l.payment_amount is distinct from
      round((c.fixed_price_each + c.service_fee_each) * l.quantity, 2)

union all
-- Closed out without the money ever being confirmed. Excludes the resale path,
-- where a lead is closed by its paid offer rather than by its own stamps.
select 'fixed_price_lead_done_without_payment', 'critical', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('status', l.status, 'declared_at', l.buyer_declared_sent_at)
from public.beta_go_leads l
where l.intent = 'buy'
  and l.status = 'done'
  and l.buyer_declared_sent_at is not null
  and l.payment_recorded_at is null
  and not exists (
    select 1 from public.beta_offers o where o.buy_lead_id = l.id and o.status = 'paid'
  )

union all
-- Money recorded against a lead that never declared it — usually an ops entry,
-- worth seeing because it means the buyer-side record is incomplete.
select 'fixed_price_payment_without_declaration', 'info', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('paid_at', l.payment_recorded_at,
                          'recorded_by', l.payment_recorded_by)
from public.beta_go_leads l
where l.intent = 'buy'
  and l.payment_recorded_at is not null
  and l.buyer_declared_sent_at is null

union all
-- A sale that never reached the log. Would mean the trigger was bypassed
-- (session_replication_role, or a restore) — the log policing itself, same as
-- paid_offer_without_history does for the resale path.
select 'fixed_price_sale_without_history', 'info', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('paid_at', l.payment_recorded_at)
from public.beta_go_leads l
where l.intent = 'buy'
  and l.payment_recorded_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.buy_lead_id = l.id and e.event_name = 'buyer_payment_confirmed'
  );

create or replace view public.integrity_findings as
select * from public.integrity_findings_base
union all
select * from public.integrity_findings_fixed_price;

comment on view public.integrity_findings is
  'Every named bad state across both money paths. Union of integrity_findings_base (resale) and integrity_findings_fixed_price.';

revoke all on public.integrity_findings, public.integrity_findings_base,
  public.integrity_findings_fixed_price from anon, authenticated;
grant select on public.integrity_findings, public.integrity_findings_base,
  public.integrity_findings_fixed_price to service_role;

commit;

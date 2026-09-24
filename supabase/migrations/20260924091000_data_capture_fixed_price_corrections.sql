-- 20260924091000 — Corrections to 20260924090100 and 20260924090200.
--
-- Those two were applied to the linked project before two facts about the
-- fixed-price path were pinned down, and an applied migration is a historical
-- record — it doesn't get edited, it gets superseded. This file holds the
-- current definitions; 090100 and 090200 are left as they ran.
--
-- What changed, and why
-- ---------------------
-- 1. The amount check was comparing what the buyer was asked to send against
--    `fixed_price_each * quantity`. Checkout charges tickets *plus* a service
--    fee (lib/compliance/fixed-price.ts, and 0032's per-event
--    `service_fee_each`), so that comparison flagged every correctly-priced
--    fixed-price sale. It is now two checks:
--
--      fixed_price_amount_below_ticket_price  critical, and true regardless of
--        the fee — the buyer was asked for less than the tickets alone cost.
--      fixed_price_amount_mismatch            exact, but only for events that
--        configure their own service_fee_each.
--
--    Events on the platform default fee are covered by the first check alone.
--    The default lives in SERVICE_FEE_CAD in lib/compliance/fees.ts and stays
--    there: copying it into SQL would give a fee a second source of truth,
--    which CLAUDE.md § hard constraint 2 exists to prevent.
--
-- 2. The catalog trigger only treated `fixed_price_each` as a price change.
--    0032 added list_price_each, discount_each and service_fee_each, all of
--    which change what a buyer pays, so all four now produce
--    `catalog_price_changed` with the full breakdown in metadata.

begin;

create or replace view public.integrity_findings_fixed_price as

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
-- Correction 1a: the fee-independent floor.
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
-- Correction 1b: exact, only where the event carries its own fee.
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
select 'fixed_price_payment_without_declaration', 'info', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('paid_at', l.payment_recorded_at,
                          'recorded_by', l.payment_recorded_by)
from public.beta_go_leads l
where l.intent = 'buy'
  and l.payment_recorded_at is not null
  and l.buyer_declared_sent_at is null

union all
select 'fixed_price_sale_without_history', 'info', 'buy_lead', l.id, null, l.event_slug,
       jsonb_build_object('paid_at', l.payment_recorded_at)
from public.beta_go_leads l
where l.intent = 'buy'
  and l.payment_recorded_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.buy_lead_id = l.id and e.event_name = 'buyer_payment_confirmed'
  );

-- Correction 2: every column that changes what a buyer pays.
create or replace function public.tg_lifecycle_catalog()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
  emitted  boolean := false;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  if tg_op in ('INSERT', 'DELETE') then
    perform public.lifecycle_emit(
      p_event_name => case when tg_op = 'INSERT' then 'catalog_event_created'
                          else 'catalog_event_deleted' end,
      p_subject_type => 'catalog_event', p_subject_id => null,
      p_subject_key => row_now.slug, p_event_slug => row_now.slug,
      p_before => before_j, p_after => after_j,
      p_amount => (coalesce(after_j, before_j) ->> 'fixed_price_each')::numeric,
      p_actor_kind => 'ops',
      p_actor_label => row_now.created_by,
      p_metadata => jsonb_build_object('supported', row_now.supported)
    );
    return null;
  end if;

  -- The net ticket price (0030) plus the list/discount/fee display columns
  -- (0032). Read through jsonb so a database missing either migration degrades
  -- to "no event" instead of erroring on every catalog edit.
  if (before_j ->> 'fixed_price_each')  is distinct from (after_j ->> 'fixed_price_each')
     or (before_j ->> 'list_price_each')  is distinct from (after_j ->> 'list_price_each')
     or (before_j ->> 'discount_each')    is distinct from (after_j ->> 'discount_each')
     or (before_j ->> 'service_fee_each') is distinct from (after_j ->> 'service_fee_each') then
    perform public.lifecycle_emit(
      p_event_name => 'catalog_price_changed', p_subject_type => 'catalog_event',
      p_subject_id => null, p_subject_key => new.slug, p_event_slug => new.slug,
      p_previous_state => before_j ->> 'fixed_price_each',
      p_new_state => after_j ->> 'fixed_price_each',
      p_before => before_j, p_after => after_j,
      p_amount => (after_j ->> 'fixed_price_each')::numeric,
      p_actor_kind => 'ops',
      p_metadata => jsonb_build_object(
        'list_price_each', after_j ->> 'list_price_each',
        'discount_each', after_j ->> 'discount_each',
        'service_fee_each', after_j ->> 'service_fee_each')
    );
    emitted := true;
  end if;

  if old.supported is distinct from new.supported then
    perform public.lifecycle_emit(
      p_event_name => case when new.supported then 'catalog_event_published'
                          else 'catalog_event_unpublished' end,
      p_subject_type => 'catalog_event', p_subject_id => null,
      p_subject_key => new.slug, p_event_slug => new.slug,
      p_previous_state => old.supported::text, p_new_state => new.supported::text,
      p_before => before_j, p_after => after_j, p_actor_kind => 'ops'
    );
    emitted := true;
  end if;

  if not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'catalog_event_changed', p_subject_type => 'catalog_event',
      p_subject_id => null, p_subject_key => new.slug, p_event_slug => new.slug,
      p_before => before_j, p_after => after_j, p_actor_kind => 'ops'
    );
  end if;

  return null;
end;
$$;

revoke all on public.integrity_findings_fixed_price from anon, authenticated;
grant select on public.integrity_findings_fixed_price to service_role;

commit;

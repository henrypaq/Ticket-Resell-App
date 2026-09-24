-- 20260924090000 — Data capture: the fixed-price money path.
--
-- 0031 introduced a second way to sell a ticket: on a predetermined-price event
-- the buyer pays at checkout and "the lead itself is the transaction row" — no
-- beta_ticket_unit, no beta_offer. That path sat outside everything the
-- 20260923* migrations built:
--
--   * its money stamps logged as a generic `lead_updated` with actor `system`,
--     even though an operator's email was right there on the row;
--   * no integrity check covered it, so a ticket forwarded without payment, or
--     a buyer who declared payment three days ago and was never verified, was
--     invisible;
--   * and because every sales view is built on beta_ticket_units, a
--     fixed-price sale counted as revenue that never happened.
--
-- This closes all three. The shape mirrors the offer path deliberately: same
-- event names, same locking, same check style — a second source of sales, not
-- a second system.

begin;

-- ---------------------------------------------------------------------------
-- 1. Name the money events on a buy lead
--
-- Replaces the branch list in tg_lifecycle_go_leads. The three fixed-price
-- stamps reuse the offer path's vocabulary (buyer_payment_declared,
-- buyer_payment_confirmed, ticket_forwarded_to_buyer) — subject_type tells you
-- which path produced it, and "how much money moved today" shouldn't care.
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_go_leads()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
  is_sell  boolean := row_now.intent = 'sell';
  subj     text := case when row_now.intent = 'sell' then 'sell_lead' else 'buy_lead' end;
  emitted  boolean := false;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  if tg_op in ('INSERT', 'DELETE') then
    perform public.lifecycle_emit(
      p_event_name => case
        when tg_op = 'DELETE' then 'lead_deleted'
        when is_sell then 'sell_lead_created'
        else 'buy_lead_created' end,
      p_subject_type => subj, p_subject_id => row_now.id,
      p_event_slug => row_now.event_slug,
      p_previous_state => case when tg_op = 'DELETE' then old.status else null end,
      p_new_state => case when tg_op = 'DELETE' then null else new.status end,
      p_before => before_j, p_after => after_j,
      p_amount => case when is_sell then row_now.ask_each else row_now.max_price_each end,
      p_metadata => jsonb_build_object(
        'intent', row_now.intent, 'quantity', row_now.quantity,
        'acquisition_channel', row_now.acquisition_channel),
      p_sell_lead_id => case when is_sell then row_now.id else null end,
      p_buy_lead_id  => case when is_sell then null else row_now.id end,
      p_contact_id => row_now.contact_id
    );

    -- A fixed-price buyer declares payment *as they join* — the declaration
    -- arrives on the insert, not a later update, so it needs its own event here
    -- or the sale's first money moment would never be named.
    if tg_op = 'INSERT' and not is_sell
       and (after_j ->> 'buyer_declared_sent_at') is not null then
      perform public.lifecycle_emit(
        p_event_name => 'buyer_payment_declared', p_subject_type => 'buy_lead',
        p_subject_id => new.id, p_event_slug => new.event_slug,
        p_new_state => new.status, p_after => after_j,
        p_amount => (after_j ->> 'payment_amount')::numeric,
        p_actor_kind => 'buyer',
        p_metadata => jsonb_build_object('path', 'fixed_price', 'quantity', new.quantity),
        p_buy_lead_id => new.id, p_contact_id => new.contact_id
      );
    end if;

    return null;
  end if;

  -- UPDATE ------------------------------------------------------------------

  -- Fixed-price money first, so these never fall through to the generic
  -- status-change branch (ops confirming payment also moves new -> contacted).
  if (before_j ->> 'buyer_declared_sent_at') is null
     and (after_j ->> 'buyer_declared_sent_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'buyer_payment_declared', p_subject_type => 'buy_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status, p_new_state => new.status,
      p_before => before_j, p_after => after_j,
      p_amount => (after_j ->> 'payment_amount')::numeric,
      p_actor_kind => 'buyer',
      p_metadata => jsonb_build_object('path', 'fixed_price', 'quantity', new.quantity),
      p_buy_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if (before_j ->> 'payment_recorded_at') is null
     and (after_j ->> 'payment_recorded_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'buyer_payment_confirmed', p_subject_type => 'buy_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status, p_new_state => new.status,
      p_before => before_j, p_after => after_j,
      p_amount => (after_j ->> 'payment_amount')::numeric,
      p_actor_kind => 'ops',
      p_actor_label => after_j ->> 'payment_recorded_by',
      p_metadata => jsonb_build_object('path', 'fixed_price', 'quantity', new.quantity),
      p_buy_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if (before_j ->> 'ticket_forwarded_at') is null
     and (after_j ->> 'ticket_forwarded_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'ticket_forwarded_to_buyer', p_subject_type => 'buy_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status, p_new_state => new.status,
      p_before => before_j, p_after => after_j,
      p_amount => (after_j ->> 'payment_amount')::numeric,
      p_actor_kind => 'ops',
      p_metadata => jsonb_build_object('path', 'fixed_price', 'quantity', new.quantity),
      p_buy_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if old.status is distinct from new.status and not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'lead_status_changed', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status, p_new_state => new.status,
      p_before => before_j, p_after => after_j,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if (before_j ->> 'seller_ticket_sent_at') is null
     and (after_j ->> 'seller_ticket_sent_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'seller_declared_ticket_sent', p_subject_type => 'sell_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_actor_kind => 'seller',
      p_sell_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if (before_j ->> 'ticket_received_at') is null
     and (after_j ->> 'ticket_received_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'ticket_received_by_platform', p_subject_type => 'sell_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_metadata => jsonb_build_object('received_by', after_j ->> 'ticket_received_by'),
      p_sell_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if changed && array['ask_each', 'paid_each', 'max_price_each'] then
    perform public.lifecycle_emit(
      p_event_name => 'lead_price_changed', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_amount => case when is_sell then new.ask_each else new.max_price_each end,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if 'quantity' = any (changed) then
    perform public.lifecycle_emit(
      p_event_name => 'lead_quantity_changed', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_metadata => jsonb_build_object('from', old.quantity, 'to', new.quantity),
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if changed && array['contact_id', 'member_id'] then
    perform public.lifecycle_emit(
      p_event_name => 'lead_linked_to_contact', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'lead_updated', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Locked write paths, same contract as the offer path
--
-- The app previously read the lead, checked it, then wrote — so two operators
-- confirming the same Interac in the same second both wrote, and the operator's
-- name reached the row but never the history.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_fixed_price_payment(
  p_lead_id        uuid,
  p_actor_label    text default 'ops',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
begin
  perform public.set_actor_context('ops', null, p_actor_label, 'ops_console', p_correlation_id);

  select * into l from public.beta_go_leads where id = p_lead_id for update;
  if not found or l.intent <> 'buy' then
    return jsonb_build_object('ok', false, 'error', 'Buy lead not found.');
  end if;
  if l.buyer_declared_sent_at is null then
    return jsonb_build_object('ok', false, 'error', 'Buyer hasn''t declared payment yet.');
  end if;
  if l.payment_recorded_at is not null then
    return jsonb_build_object('ok', true, 'id', p_lead_id, 'already', true);
  end if;

  update public.beta_go_leads
     set payment_recorded_at = now(),
         payment_recorded_by = left(coalesce(p_actor_label, 'ops'), 120),
         status = case when status = 'new' then 'contacted' else status end,
         updated_at = now()
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'id', p_lead_id, 'amount', l.payment_amount);
end;
$$;

create or replace function public.forward_fixed_price_ticket(
  p_lead_id        uuid,
  p_actor_label    text default 'ops',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
begin
  perform public.set_actor_context('ops', null, p_actor_label, 'ops_console', p_correlation_id);

  select * into l from public.beta_go_leads where id = p_lead_id for update;
  if not found or l.intent <> 'buy' then
    return jsonb_build_object('ok', false, 'error', 'Buy lead not found.');
  end if;
  if l.payment_recorded_at is null then
    return jsonb_build_object('ok', false, 'error',
      'Confirm Interac received before marking the ticket sent.');
  end if;
  if l.ticket_forwarded_at is not null then
    return jsonb_build_object('ok', true, 'id', p_lead_id, 'already', true);
  end if;

  update public.beta_go_leads
     set ticket_forwarded_at = now(), status = 'done', updated_at = now()
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'id', p_lead_id);
end;
$$;

-- The buyer's own declaration. Unlike the two above this can legitimately fire
-- on a lead that doesn't exist yet (checkout creates it), so it only covers the
-- update case; the insert path is logged by the trigger above.
create or replace function public.declare_fixed_price_payment_sent(
  p_lead_id        uuid,
  p_amount         numeric default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
begin
  perform public.set_actor_context('buyer', null, null, 'app', p_correlation_id);

  select * into l from public.beta_go_leads where id = p_lead_id for update;
  if not found or l.intent <> 'buy' then
    return jsonb_build_object('ok', false, 'error', 'Buy lead not found.');
  end if;
  if l.buyer_declared_sent_at is not null then
    return jsonb_build_object('ok', true, 'id', p_lead_id, 'already', true);
  end if;

  update public.beta_go_leads
     set buyer_declared_sent_at = now(),
         payment_amount = coalesce(p_amount, payment_amount),
         updated_at = now()
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'id', p_lead_id);
end;
$$;

revoke all on function public.confirm_fixed_price_payment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.forward_fixed_price_ticket(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.declare_fixed_price_payment_sent(uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function public.confirm_fixed_price_payment(uuid, text, uuid) to service_role;
grant execute on function public.forward_fixed_price_ticket(uuid, text, uuid) to service_role;
grant execute on function public.declare_fixed_price_payment_sent(uuid, numeric, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. v_sales — the canonical revenue grain, both paths
--
-- One row per sale. A unit sale is one ticket; a fixed-price lead is `quantity`
-- tickets bought in one go, which is why `tickets` exists and why revenue
-- aggregates sum it rather than counting rows. v_ticket_ledger keeps its
-- one-row-per-physical-ticket meaning and is unchanged.
-- ---------------------------------------------------------------------------
drop view if exists public.v_platform_daily;
drop view if exists public.v_sales_velocity;
drop view if exists public.v_buyer_behaviour;
drop view if exists public.v_event_sales_daily;
drop view if exists public.v_event_sales_summary;
drop view if exists public.v_sales;

create view public.v_sales as
select
  'unit'::text                         as sale_source,
  t.unit_id                            as sale_id,
  t.event_slug,
  t.event_name,
  1                                    as tickets,
  t.sale_amount_cad                    as amount_cad,
  t.sale_amount_cad                    as price_per_ticket_cad,
  t.buyer_key,
  t.buyer_contact_id,
  t.buyer_member_id,
  t.seller_contact_id,
  t.paid_at,
  t.forwarded_to_buyer_at              as delivered_at,
  t.payout_confirmed_at                as settled_at,
  t.unit_id,
  t.winning_offer_id                   as offer_id,
  t.buyer_lead_id                      as lead_id
from public.v_ticket_ledger t
where t.paid_at is not null

union all

-- Fixed-price: no unit, no offer, no seller — the platform holds the stock and
-- the lead is the transaction (0031).
select
  'fixed_price_lead',
  l.id,
  l.event_slug,
  coalesce(c.name, l.event_slug),
  l.quantity,
  l.payment_amount,
  round(l.payment_amount / nullif(l.quantity, 0), 2),
  coalesce(l.contact_id::text, l.member_id::text, l.id::text),
  l.contact_id,
  l.member_id,
  null::uuid,
  l.payment_recorded_at,
  l.ticket_forwarded_at,
  l.ticket_forwarded_at,
  null::uuid,
  null::uuid,
  l.id
from public.beta_go_leads l
left join public.beta_event_catalog c on c.slug = l.event_slug
where l.intent = 'buy'
  and l.payment_recorded_at is not null;

comment on view public.v_sales is
  'Every sale, both paths: one row per unit sale and one per paid fixed-price lead. Revenue views build on this, not on units.';

-- ---------------------------------------------------------------------------
-- 4. Revenue views rebuilt on v_sales
-- ---------------------------------------------------------------------------
create view public.v_event_sales_summary as
with inventory as (
  select
    t.event_slug,
    max(t.event_name)                                   as event_name,
    count(*)                                            as units_listed,
    count(*) filter (where t.unit_status = 'available')  as units_available,
    count(*) filter (where t.unit_status = 'sold')       as units_sold,
    count(*) filter (where t.unit_status = 'withdrawn')  as units_withdrawn,
    count(*) filter (where t.stage = 'offer_live')       as units_on_hold,
    round(avg(t.face_value), 2)                          as avg_face_value_cad,
    count(distinct t.seller_contact_id)                  as distinct_sellers,
    percentile_cont(0.5) within group (order by t.minutes_listed_to_paid)
                                                         as median_minutes_to_sell,
    count(*) filter (where t.paid_at is not null and t.forwarded_to_buyer_at is null)
                                                         as awaiting_delivery,
    count(*) filter (where t.paid_at is not null and t.payout_released_at is null)
                                                         as awaiting_payout
  from public.v_ticket_ledger t
  group by t.event_slug
),
revenue as (
  select
    s.event_slug,
    max(s.event_name)                                             as event_name,
    sum(s.tickets)                                                as tickets_sold,
    sum(s.tickets) filter (where s.sale_source = 'unit')          as tickets_sold_resale,
    sum(s.tickets) filter (where s.sale_source = 'fixed_price_lead') as tickets_sold_fixed_price,
    coalesce(sum(s.amount_cad), 0)::numeric(12,2)                 as gross_sales_cad,
    round(avg(s.price_per_ticket_cad), 2)                         as avg_sale_price_cad,
    count(distinct s.buyer_key)                                   as distinct_buyers,
    min(s.paid_at)                                                as first_sale_at,
    max(s.paid_at)                                                as last_sale_at,
    count(*) filter (where s.delivered_at is null)                as sales_awaiting_delivery
  from public.v_sales s
  group by s.event_slug
)
select
  coalesce(i.event_slug, r.event_slug)                  as event_slug,
  coalesce(i.event_name, r.event_name)                  as event_name,
  coalesce(i.units_listed, 0)                           as units_listed,
  coalesce(i.units_available, 0)                        as units_available,
  coalesce(i.units_sold, 0)                             as units_sold,
  coalesce(i.units_withdrawn, 0)                        as units_withdrawn,
  coalesce(i.units_on_hold, 0)                          as units_on_hold,
  coalesce(r.tickets_sold, 0)                           as tickets_sold,
  coalesce(r.tickets_sold_resale, 0)                    as tickets_sold_resale,
  coalesce(r.tickets_sold_fixed_price, 0)               as tickets_sold_fixed_price,
  coalesce(r.gross_sales_cad, 0)::numeric(12,2)         as gross_sales_cad,
  r.avg_sale_price_cad,
  i.avg_face_value_cad,
  coalesce(r.distinct_buyers, 0)                        as distinct_buyers,
  coalesce(i.distinct_sellers, 0)                       as distinct_sellers,
  r.first_sale_at,
  r.last_sale_at,
  round(100.0 * coalesce(i.units_sold, 0)
        / nullif(coalesce(i.units_listed, 0) - coalesce(i.units_withdrawn, 0), 0), 1)
                                                        as sell_through_pct,
  i.median_minutes_to_sell,
  coalesce(r.sales_awaiting_delivery, 0)                as awaiting_delivery,
  coalesce(i.awaiting_payout, 0)                        as awaiting_payout
from inventory i
full join revenue r on r.event_slug = i.event_slug;

create view public.v_event_sales_daily as
select
  s.event_slug,
  max(s.event_name)                                  as event_name,
  (s.paid_at at time zone 'America/Toronto')::date   as sale_date,
  sum(s.tickets)                                     as tickets_sold,
  sum(s.amount_cad)::numeric(12,2)                   as gross_sales_cad,
  round(avg(s.price_per_ticket_cad), 2)              as avg_sale_price_cad,
  count(distinct s.buyer_key)                        as distinct_buyers,
  count(distinct s.seller_contact_id)                as distinct_sellers,
  sum(s.tickets) filter (where s.sale_source = 'fixed_price_lead')
                                                     as tickets_sold_fixed_price
from public.v_sales s
group by s.event_slug, (s.paid_at at time zone 'America/Toronto')::date;

create view public.v_buyer_behaviour as
with seats as (
  select
    coalesce(l.contact_id::text, l.id::text)            as buyer_key,
    l.contact_id,
    null::uuid                                          as member_id,
    count(*)                                            as seats_taken,
    count(distinct l.event_slug)                        as events_waitlisted,
    min(l.created_at)                                   as first_seat_at,
    max(l.created_at)                                   as last_seat_at
  from public.beta_go_leads l
  where l.intent = 'buy'
  group by coalesce(l.contact_id::text, l.id::text), l.contact_id

  union all

  select
    i.member_id::text, null::uuid, i.member_id, count(*),
    count(distinct i.event_slug), min(i.created_at), max(i.created_at)
  from public.beta_member_interests i
  where i.intent = 'waitlist'
  group by i.member_id
),
seats_rolled as (
  select
    buyer_key,
    (array_agg(contact_id) filter (where contact_id is not null))[1] as contact_id,
    (array_agg(member_id) filter (where member_id is not null))[1]   as member_id,
    sum(seats_taken)::bigint       as seats_taken,
    sum(events_waitlisted)::bigint as events_waitlisted,
    min(first_seat_at)             as first_seat_at,
    max(last_seat_at)              as last_seat_at
  from seats
  group by buyer_key
),
offers as (
  select
    coalesce(bl.contact_id::text, mi.member_id::text, o.seat_key)     as buyer_key,
    count(*)                                                         as offers_received,
    count(*) filter (where o.status in ('accepted','paid','needs_review')) as offers_accepted,
    count(*) filter (where o.status = 'declined')                    as offers_declined,
    count(*) filter (where o.status = 'expired_no_response')          as offers_ignored
  from public.beta_offers o
  left join public.beta_go_leads bl on bl.id = o.buy_lead_id
  left join public.beta_member_interests mi on mi.id = o.classic_interest_id
  group by coalesce(bl.contact_id::text, mi.member_id::text, o.seat_key)
),
purchases as (
  select
    s.buyer_key,
    sum(s.tickets)                                     as tickets_bought,
    sum(s.amount_cad)::numeric(12,2)                   as total_spend_cad,
    count(distinct s.event_slug)                       as events_attended,
    min(s.paid_at)                                     as first_purchase_at,
    max(s.paid_at)                                     as last_purchase_at,
    sum(s.tickets) filter (where s.sale_source = 'fixed_price_lead')
                                                       as tickets_bought_fixed_price
  from public.v_sales s
  group by s.buyer_key
)
select
  coalesce(s.buyer_key, o.buyer_key, p.buyer_key)      as buyer_key,
  s.contact_id                                         as buyer_contact_id,
  s.member_id                                          as buyer_member_id,
  coalesce(s.seats_taken, 0)                           as seats_taken,
  coalesce(s.events_waitlisted, 0)                     as events_waitlisted,
  coalesce(o.offers_received, 0)                       as offers_received,
  coalesce(o.offers_accepted, 0)                       as offers_accepted,
  coalesce(o.offers_declined, 0)                       as offers_declined,
  coalesce(o.offers_ignored, 0)                        as offers_ignored,
  coalesce(p.tickets_bought, 0)                        as tickets_bought,
  coalesce(p.tickets_bought_fixed_price, 0)            as tickets_bought_fixed_price,
  coalesce(p.total_spend_cad, 0)::numeric(12,2)        as total_spend_cad,
  coalesce(p.events_attended, 0)                       as events_attended,
  coalesce(p.tickets_bought, 0) > 1                    as is_repeat_buyer,
  s.first_seat_at,
  s.last_seat_at,
  p.first_purchase_at,
  p.last_purchase_at
from seats_rolled s
full join offers o on o.buyer_key = s.buyer_key
full join purchases p on p.buyer_key = coalesce(s.buyer_key, o.buyer_key);

create view public.v_sales_velocity as
select
  t.event_slug,
  max(t.event_name)                                                     as event_name,
  (select coalesce(sum(s.tickets), 0) from public.v_sales s
    where s.event_slug = t.event_slug)                                  as tickets_sold,
  percentile_cont(0.5) within group (order by t.minutes_listed_to_paid) as p50_minutes_listed_to_paid,
  percentile_cont(0.9) within group (order by t.minutes_listed_to_paid) as p90_minutes_listed_to_paid,
  percentile_cont(0.5) within group (order by t.minutes_offer_to_accept) as p50_minutes_offer_to_accept,
  percentile_cont(0.5) within group (order by t.minutes_accept_to_paid)  as p50_minutes_accept_to_paid,
  percentile_cont(0.5) within group (order by t.minutes_paid_to_delivered) as p50_minutes_paid_to_delivered,
  percentile_cont(0.5) within group (order by t.minutes_paid_to_payout)   as p50_minutes_paid_to_payout,
  min(t.listed_at)                                                      as first_listed_at,
  (select max(s.paid_at) from public.v_sales s where s.event_slug = t.event_slug) as last_sale_at
from public.v_ticket_ledger t
group by t.event_slug;

create view public.v_platform_daily as
with days as (
  select d::date as day from (
    select generate_series(
      least(
        coalesce((select min(created_at) from public.beta_go_leads), now()),
        coalesce((select min(created_at) from public.beta_go_contacts), now())
      ) at time zone 'America/Toronto',
      now() at time zone 'America/Toronto',
      interval '1 day'
    ) as d
  ) s
),
leads as (
  select (created_at at time zone 'America/Toronto')::date as day,
         count(*) filter (where intent = 'buy')  as buy_leads,
         count(*) filter (where intent = 'sell') as sell_leads
  from public.beta_go_leads group by 1
),
units as (
  select (created_at at time zone 'America/Toronto')::date as day, count(*) as units_listed
  from public.beta_ticket_units group by 1
),
sales as (
  select (paid_at at time zone 'America/Toronto')::date as day,
         sum(tickets) as tickets_sold,
         sum(amount_cad)::numeric(12,2) as gross_sales_cad,
         sum(tickets) filter (where sale_source = 'fixed_price_lead') as tickets_sold_fixed_price
  from public.v_sales group by 1
),
contacts as (
  select (created_at at time zone 'America/Toronto')::date as day, count(*) as new_contacts
  from public.beta_go_contacts group by 1
)
select
  d.day,
  coalesce(l.buy_leads, 0)        as buy_leads,
  coalesce(l.sell_leads, 0)       as sell_leads,
  coalesce(u.units_listed, 0)     as units_listed,
  coalesce(s.tickets_sold, 0)     as tickets_sold,
  coalesce(s.tickets_sold_fixed_price, 0) as tickets_sold_fixed_price,
  coalesce(s.gross_sales_cad, 0)::numeric(12,2) as gross_sales_cad,
  coalesce(c.new_contacts, 0)     as new_contacts
from days d
left join leads l on l.day = d.day
left join units u on u.day = d.day
left join sales s on s.day = d.day
left join contacts c on c.day = d.day;

revoke all on public.v_sales, public.v_event_sales_summary, public.v_event_sales_daily,
  public.v_buyer_behaviour, public.v_sales_velocity, public.v_platform_daily
  from anon, authenticated;
grant select on public.v_sales, public.v_event_sales_summary, public.v_event_sales_daily,
  public.v_buyer_behaviour, public.v_sales_velocity, public.v_platform_daily
  to service_role;

commit;

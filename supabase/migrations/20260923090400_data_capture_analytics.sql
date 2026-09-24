-- 20260923090400 — Data capture, part 5 of 6: the analytics surface.
--
-- DATA_CAPTURE.md § 2 "Analytics surface": the organizer data product isn't
-- being built yet, but the questions it will ask are known — tickets sold vs
-- available, revenue over time, sales velocity, seller performance, repeat
-- buyers. These views answer them off the live tables so the product can be
-- built later without a schema redesign.
--
-- Plain views, not materialized: the whole dataset is currently in the low
-- hundreds of rows and freshness matters more than milliseconds. When an event
-- night starts producing tens of thousands of offers, `v_event_sales_daily`
-- and `v_sales_velocity` are the two to materialize first (they are the only
-- ones that aggregate across all history rather than a single event).
--
-- All of them are service-role only — see the grant note at the bottom.
--
-- Dates roll up in America/Toronto, because "how did Thursday go" means the
-- Montreal Thursday, not a UTC one.

begin;

-- `create or replace view` refuses a changed column list, so re-running this
-- migration (or amending a view later) needs the dependents gone first. Dropped
-- in reverse dependency order — everything below is rebuilt in this same
-- transaction.
drop view if exists public.v_platform_daily;
drop view if exists public.v_sales_velocity;
drop view if exists public.v_buyer_behaviour;
drop view if exists public.v_seller_performance;
drop view if exists public.v_event_demand;
drop view if exists public.v_offer_funnel;
drop view if exists public.v_event_sales_daily;
drop view if exists public.v_event_sales_summary;
drop view if exists public.v_ticket_ledger;
drop view if exists public.v_lifecycle_timeline;

-- ---------------------------------------------------------------------------
-- v_ticket_ledger — one row per ticket, its whole life flattened.
--
-- This is the workhorse: "what happened to this ticket", "how long did it take
-- to sell", "who bought it", "was the seller paid" — without joining five
-- tables by hand every time.
-- ---------------------------------------------------------------------------
create or replace view public.v_ticket_ledger as
with paid_offer as (
  select distinct on (o.unit_id)
    o.unit_id, o.id as offer_id, o.buy_lead_id, o.classic_interest_id, o.seat_key,
    o.price_each, o.payment_amount, o.payment_recorded_at, o.payment_recorded_by,
    o.buyer_declared_sent_at, o.responded_at, o.offered_at,
    o.ticket_transferred_at, o.payout_released_at, o.seller_payout_confirmed_at
  from public.beta_offers o
  where o.status = 'paid'
  order by o.unit_id, o.payment_recorded_at desc nulls last
),
offer_stats as (
  select
    o.unit_id,
    count(*)                                                        as offers_total,
    min(o.offered_at)                                               as first_offered_at,
    count(*) filter (where o.status = 'declined')                   as offers_declined,
    count(*) filter (where o.status in ('expired_no_response','expired_unpaid')) as offers_expired,
    count(*) filter (where o.status = 'payment_failed')             as offers_payment_failed
  from public.beta_offers o
  group by o.unit_id
)
select
  u.id                          as unit_id,
  u.event_slug,
  coalesce(c.name, u.event_slug) as event_name,
  u.unit_index,
  u.status                      as unit_status,
  u.price_each,
  sl.paid_each                  as face_value,
  sl.ask_each                   as ask_price,
  u.created_at                  as listed_at,

  sl.id                         as sell_lead_id,
  sl.contact_id                 as seller_contact_id,
  sl.member_id                  as seller_member_id,
  sl.seller_ticket_sent_at      as seller_declared_transfer_at,
  sl.ticket_received_at         as platform_received_ticket_at,

  os.offers_total,
  os.first_offered_at,
  os.offers_declined,
  os.offers_expired,
  os.offers_payment_failed,

  po.offer_id                   as winning_offer_id,
  po.seat_key                   as buyer_seat_key,
  case when po.classic_interest_id is not null then 'classic'
       when po.buy_lead_id is not null then 'go' end as buyer_seat_kind,
  po.buy_lead_id                as buyer_lead_id,
  bl.contact_id                 as buyer_contact_id,
  coalesce(bl.member_id, mi.member_id) as buyer_member_id,
  -- A seat is either a /go buy lead or a classic member interest (0021's
  -- beta_offers_exactly_one_seat). Keying on the go contact alone would collapse
  -- every classic buyer into one null-keyed row, so fall back to the member and
  -- then to the seat itself — never to null.
  coalesce(bl.contact_id::text, mi.member_id::text, po.seat_key) as buyer_key,
  po.offered_at                 as won_offer_sent_at,
  po.responded_at               as accepted_at,
  po.buyer_declared_sent_at,
  po.payment_recorded_at        as paid_at,
  po.payment_recorded_by        as payment_recorded_by,
  coalesce(po.payment_amount, po.price_each) as sale_amount_cad,
  po.ticket_transferred_at      as forwarded_to_buyer_at,
  po.payout_released_at         as payout_released_at,
  po.seller_payout_confirmed_at as payout_confirmed_at,

  -- Where this ticket actually is, in one word.
  case
    when u.status = 'withdrawn' then 'withdrawn'
    when po.seller_payout_confirmed_at is not null then 'settled'
    when po.payout_released_at is not null then 'payout_released'
    when po.ticket_transferred_at is not null then 'delivered'
    when po.payment_recorded_at is not null then 'paid'
    when exists (select 1 from public.beta_offers o2
                  where o2.unit_id = u.id and o2.status in ('offered','accepted','needs_review'))
      then 'offer_live'
    when u.status = 'sold' then 'sold'
    else 'available'
  end                           as stage,

  round(extract(epoch from po.payment_recorded_at - u.created_at) / 60)::int
                                as minutes_listed_to_paid,
  round(extract(epoch from po.responded_at - po.offered_at) / 60)::int
                                as minutes_offer_to_accept,
  round(extract(epoch from po.payment_recorded_at - po.responded_at) / 60)::int
                                as minutes_accept_to_paid,
  round(extract(epoch from po.ticket_transferred_at - po.payment_recorded_at) / 60)::int
                                as minutes_paid_to_delivered,
  round(extract(epoch from po.payout_released_at - po.payment_recorded_at) / 60)::int
                                as minutes_paid_to_payout
from public.beta_ticket_units u
join public.beta_go_leads sl on sl.id = u.sell_lead_id
left join public.beta_event_catalog c on c.slug = u.event_slug
left join offer_stats os on os.unit_id = u.id
left join paid_offer po on po.unit_id = u.id
left join public.beta_go_leads bl on bl.id = po.buy_lead_id
left join public.beta_member_interests mi on mi.id = po.classic_interest_id;

comment on view public.v_ticket_ledger is
  'One row per ticket with its full lifecycle flattened — the default starting point for both debugging and organizer analytics.';

-- ---------------------------------------------------------------------------
-- v_event_sales_summary — the headline numbers per event
-- ---------------------------------------------------------------------------
create or replace view public.v_event_sales_summary as
select
  t.event_slug,
  max(t.event_name)                                              as event_name,
  count(*)                                                       as units_listed,
  count(*) filter (where t.unit_status = 'available')            as units_available,
  count(*) filter (where t.unit_status = 'sold')                 as units_sold,
  count(*) filter (where t.unit_status = 'withdrawn')            as units_withdrawn,
  count(*) filter (where t.stage = 'offer_live')                 as units_on_hold,
  coalesce(sum(t.sale_amount_cad) filter (where t.paid_at is not null), 0)::numeric(12,2)
                                                                 as gross_sales_cad,
  round(avg(t.sale_amount_cad) filter (where t.paid_at is not null), 2)
                                                                 as avg_sale_price_cad,
  round(avg(t.face_value), 2)                                    as avg_face_value_cad,
  count(distinct t.buyer_key) filter (where t.paid_at is not null)
                                                                 as distinct_buyers,
  count(distinct t.seller_contact_id)                            as distinct_sellers,
  min(t.paid_at)                                                 as first_sale_at,
  max(t.paid_at)                                                 as last_sale_at,
  round(
    100.0 * count(*) filter (where t.unit_status = 'sold')
    / nullif(count(*) filter (where t.unit_status <> 'withdrawn'), 0), 1
  )                                                              as sell_through_pct,
  percentile_cont(0.5) within group (order by t.minutes_listed_to_paid)
                                                                 as median_minutes_to_sell,
  count(*) filter (where t.paid_at is not null and t.forwarded_to_buyer_at is null)
                                                                 as awaiting_delivery,
  count(*) filter (where t.paid_at is not null and t.payout_released_at is null)
                                                                 as awaiting_payout
from public.v_ticket_ledger t
group by t.event_slug;

-- ---------------------------------------------------------------------------
-- v_event_sales_daily — revenue over time (Montreal days)
-- ---------------------------------------------------------------------------
create or replace view public.v_event_sales_daily as
select
  t.event_slug,
  max(t.event_name)                                as event_name,
  (t.paid_at at time zone 'America/Toronto')::date as sale_date,
  count(*)                                         as tickets_sold,
  sum(t.sale_amount_cad)::numeric(12,2)            as gross_sales_cad,
  round(avg(t.sale_amount_cad), 2)                 as avg_sale_price_cad,
  count(distinct t.buyer_contact_id)               as distinct_buyers,
  count(distinct t.seller_contact_id)              as distinct_sellers
from public.v_ticket_ledger t
where t.paid_at is not null
group by t.event_slug, (t.paid_at at time zone 'America/Toronto')::date;

-- ---------------------------------------------------------------------------
-- v_event_demand — the waitlist side, including seats that never got an offer
-- ---------------------------------------------------------------------------
create or replace view public.v_event_demand as
with go_seats as (
  select
    l.event_slug,
    count(*)                                              as buy_seats,
    sum(l.quantity)                                       as tickets_wanted,
    count(*) filter (where l.max_price_each is not null)  as seats_with_price_ceiling,
    count(*) filter (where l.status = 'done')             as seats_fulfilled,
    count(*) filter (where l.status = 'cancelled')        as seats_cancelled,
    min(l.created_at)                                     as first_seat_at,
    max(l.created_at)                                     as last_seat_at
  from public.beta_go_leads l
  where l.intent = 'buy'
  group by l.event_slug
),
classic_seats as (
  select i.event_slug, count(*) as classic_seats
  from public.beta_member_interests i
  where i.intent = 'waitlist'
  group by i.event_slug
),
dormant as (
  select s.event_slug, count(*) as dormant_seats
  from public.beta_queue_seat_state s
  where s.dormant_at is not null
    and (s.reactivated_at is null or s.reactivated_at < s.dormant_at)
  group by s.event_slug
),
supply as (
  select
    u.event_slug,
    count(*)                                        as units_listed,
    count(*) filter (where u.status = 'available')  as units_available,
    count(*) filter (where u.status = 'sold')       as units_sold
  from public.beta_ticket_units u
  group by u.event_slug
)
select
  coalesce(g.event_slug, s.event_slug, cs.event_slug)          as event_slug,
  coalesce(cat.name, coalesce(g.event_slug, s.event_slug, cs.event_slug)) as event_name,
  coalesce(g.buy_seats, 0)                                     as buy_seats,
  coalesce(cs.classic_seats, 0)                                as classic_seats,
  coalesce(g.tickets_wanted, 0) + coalesce(cs.classic_seats, 0) as tickets_wanted,
  coalesce(g.seats_with_price_ceiling, 0)                      as seats_with_price_ceiling,
  coalesce(g.seats_fulfilled, 0)                               as seats_fulfilled,
  coalesce(g.seats_cancelled, 0)                               as seats_cancelled,
  coalesce(d.dormant_seats, 0)                                 as dormant_seats,
  coalesce(s.units_listed, 0)                                  as units_listed,
  coalesce(s.units_available, 0)                               as units_available,
  coalesce(s.units_sold, 0)                                    as units_sold,
  -- Demand we could not serve: tickets people asked for, minus tickets sold.
  greatest(coalesce(g.tickets_wanted, 0) + coalesce(cs.classic_seats, 0)
           - coalesce(s.units_sold, 0), 0)                     as unmet_demand,
  round(
    100.0 * coalesce(s.units_sold, 0)
    / nullif(coalesce(g.tickets_wanted, 0) + coalesce(cs.classic_seats, 0), 0), 1
  )                                                            as demand_filled_pct,
  g.first_seat_at,
  g.last_seat_at
from go_seats g
full join supply s on s.event_slug = g.event_slug
full join classic_seats cs on cs.event_slug = coalesce(g.event_slug, s.event_slug)
left join dormant d on d.event_slug = coalesce(g.event_slug, s.event_slug, cs.event_slug)
left join public.beta_event_catalog cat on cat.slug = coalesce(g.event_slug, s.event_slug, cs.event_slug);

-- ---------------------------------------------------------------------------
-- v_offer_funnel — where allocations die
-- ---------------------------------------------------------------------------
create or replace view public.v_offer_funnel as
select
  o.event_slug,
  coalesce(c.name, o.event_slug)                                        as event_name,
  count(*)                                                              as offers_sent,
  count(*) filter (where o.status = 'offered')                          as offers_live,
  count(*) filter (where o.responded_at is not null
                     and o.status not in ('expired_no_response'))       as offers_answered,
  count(*) filter (where o.status in ('accepted','paid','needs_review')) as offers_accepted,
  count(*) filter (where o.status = 'paid')                             as offers_paid,
  count(*) filter (where o.status = 'declined')                         as offers_declined,
  count(*) filter (where o.status = 'expired_no_response')              as offers_expired_silent,
  count(*) filter (where o.status = 'expired_unpaid')                   as offers_expired_unpaid,
  count(*) filter (where o.status = 'payment_failed')                   as offers_payment_failed,
  count(*) filter (where o.status = 'withdrawn')                        as offers_withdrawn,
  count(*) filter (where o.decline_reason = 'price')                    as declined_on_price,
  count(*) filter (where o.decline_reason = 'not_going')                as declined_not_going,
  count(*) filter (where o.decline_reason = 'other')                    as declined_other,
  round(100.0 * count(*) filter (where o.status in ('accepted','paid','needs_review'))
        / nullif(count(*), 0), 1)                                       as acceptance_pct,
  round(100.0 * count(*) filter (where o.status = 'paid')
        / nullif(count(*), 0), 1)                                       as paid_pct,
  percentile_cont(0.5) within group (
    order by extract(epoch from o.responded_at - o.offered_at) / 60
  )                                                                     as median_minutes_to_respond,
  percentile_cont(0.5) within group (
    order by extract(epoch from o.payment_recorded_at - o.responded_at) / 60
  )                                                                     as median_minutes_to_pay,
  round(avg(o.rank), 1)                                                 as avg_rank_offered
from public.beta_offers o
left join public.beta_event_catalog c on c.slug = o.event_slug
group by o.event_slug, c.name;

-- ---------------------------------------------------------------------------
-- v_seller_performance — per person, not per listing
-- ---------------------------------------------------------------------------
create or replace view public.v_seller_performance as
select
  coalesce(t.seller_contact_id, t.sell_lead_id)                  as seller_key,
  t.seller_contact_id,
  t.seller_member_id,
  count(distinct t.event_slug)                                   as events,
  count(*)                                                       as units_listed,
  count(*) filter (where t.unit_status = 'sold')                 as units_sold,
  count(*) filter (where t.unit_status = 'withdrawn')            as units_withdrawn,
  coalesce(sum(t.sale_amount_cad) filter (where t.paid_at is not null), 0)::numeric(12,2)
                                                                 as gross_sales_cad,
  round(100.0 * count(*) filter (where t.unit_status = 'sold')
        / nullif(count(*), 0), 1)                                as sell_through_pct,
  min(t.listed_at)                                               as first_listed_at,
  max(t.listed_at)                                               as last_listed_at,
  count(*) filter (where t.platform_received_ticket_at is not null) as units_in_custody,
  percentile_cont(0.5) within group (
    order by extract(epoch from t.platform_received_ticket_at - t.seller_declared_transfer_at) / 3600
  )                                                              as median_hours_declared_to_received,
  count(*) filter (where t.payout_released_at is not null)       as payouts_released,
  count(*) filter (where t.payout_confirmed_at is not null)      as payouts_confirmed
from public.v_ticket_ledger t
group by coalesce(t.seller_contact_id, t.sell_lead_id), t.seller_contact_id, t.seller_member_id;

-- ---------------------------------------------------------------------------
-- v_buyer_behaviour — repeat attendance is the metric organizers ask for
-- ---------------------------------------------------------------------------
create or replace view public.v_buyer_behaviour as
with seats as (
  -- Both halves of one queue: /go buy leads and classic member interests
  -- (README § One waitlist mechanism). Keyed the same way v_ticket_ledger keys
  -- its buyer, so purchases join back onto the right person.
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
    i.member_id::text,
    null::uuid,
    i.member_id,
    count(*),
    count(distinct i.event_slug),
    min(i.created_at),
    max(i.created_at)
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
    t.buyer_key,
    count(*)                                           as tickets_bought,
    sum(t.sale_amount_cad)::numeric(12,2)              as total_spend_cad,
    count(distinct t.event_slug)                       as events_attended,
    min(t.paid_at)                                     as first_purchase_at,
    max(t.paid_at)                                     as last_purchase_at
  from public.v_ticket_ledger t
  where t.paid_at is not null
  group by t.buyer_key
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

-- ---------------------------------------------------------------------------
-- v_sales_velocity — how fast a night actually moves
-- ---------------------------------------------------------------------------
create or replace view public.v_sales_velocity as
select
  t.event_slug,
  max(t.event_name)                                                     as event_name,
  count(*) filter (where t.paid_at is not null)                         as tickets_sold,
  percentile_cont(0.5) within group (order by t.minutes_listed_to_paid) as p50_minutes_listed_to_paid,
  percentile_cont(0.9) within group (order by t.minutes_listed_to_paid) as p90_minutes_listed_to_paid,
  percentile_cont(0.5) within group (order by t.minutes_offer_to_accept) as p50_minutes_offer_to_accept,
  percentile_cont(0.5) within group (order by t.minutes_accept_to_paid)  as p50_minutes_accept_to_paid,
  percentile_cont(0.5) within group (order by t.minutes_paid_to_delivered) as p50_minutes_paid_to_delivered,
  percentile_cont(0.5) within group (order by t.minutes_paid_to_payout)   as p50_minutes_paid_to_payout,
  min(t.listed_at)                                                      as first_listed_at,
  max(t.paid_at)                                                        as last_sale_at
from public.v_ticket_ledger t
group by t.event_slug;

-- ---------------------------------------------------------------------------
-- v_platform_daily — one line a day for the whole platform
-- ---------------------------------------------------------------------------
create or replace view public.v_platform_daily as
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
         count(*) as tickets_sold,
         sum(sale_amount_cad)::numeric(12,2) as gross_sales_cad
  from public.v_ticket_ledger where paid_at is not null group by 1
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
  coalesce(s.gross_sales_cad, 0)::numeric(12,2) as gross_sales_cad,
  coalesce(c.new_contacts, 0)     as new_contacts
from days d
left join leads l on l.day = d.day
left join units u on u.day = d.day
left join sales s on s.day = d.day
left join contacts c on c.day = d.day;

-- ---------------------------------------------------------------------------
-- v_lifecycle_timeline — the log, joined to its vocabulary, newest first.
-- What you read when you need to explain one ticket or one night to a human.
-- ---------------------------------------------------------------------------
create or replace view public.v_lifecycle_timeline as
select
  e.id,
  e.occurred_at,
  e.event_name,
  t.category                     as event_category,
  t.description                  as event_description,
  e.subject_type,
  e.subject_id,
  e.event_slug,
  e.unit_id,
  e.offer_id,
  e.sell_lead_id,
  e.buy_lead_id,
  e.contact_id,
  e.seat_key,
  e.previous_state,
  e.new_state,
  e.amount,
  e.actor_kind,
  e.actor_label,
  e.source,
  e.correlation_id,
  e.changed_fields,
  e.metadata
from public.lifecycle_events e
left join public.lifecycle_event_types t on t.name = e.event_name;

-- ---------------------------------------------------------------------------
-- Access
--
-- Views in Postgres execute with their owner's privileges, so a view over an
-- RLS-protected table would hand a browser role everything the owner can see.
-- Nothing here is granted to anon or authenticated: the analytics surface is
-- read through the service-role client, behind the ops console's own auth
-- (domains/beta-ops/auth.ts) — consistent with every beta_* table since 0013.
-- ---------------------------------------------------------------------------
revoke all on public.v_ticket_ledger        from anon, authenticated;
revoke all on public.v_event_sales_summary  from anon, authenticated;
revoke all on public.v_event_sales_daily    from anon, authenticated;
revoke all on public.v_event_demand         from anon, authenticated;
revoke all on public.v_offer_funnel         from anon, authenticated;
revoke all on public.v_seller_performance   from anon, authenticated;
revoke all on public.v_buyer_behaviour      from anon, authenticated;
revoke all on public.v_sales_velocity       from anon, authenticated;
revoke all on public.v_platform_daily       from anon, authenticated;
revoke all on public.v_lifecycle_timeline   from anon, authenticated;

grant select on public.v_ticket_ledger, public.v_event_sales_summary,
  public.v_event_sales_daily, public.v_event_demand, public.v_offer_funnel,
  public.v_seller_performance, public.v_buyer_behaviour, public.v_sales_velocity,
  public.v_platform_daily, public.v_lifecycle_timeline to service_role;

commit;

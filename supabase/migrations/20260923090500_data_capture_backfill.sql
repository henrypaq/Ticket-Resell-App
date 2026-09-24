-- 20260923090500 — Data capture, part 6 of 6: backfill history for existing rows.
--
-- The triggers in part 2 only see changes made from now on. Everything already
-- in the database — the beta's real tickets, offers and payouts — would start
-- with an empty history, which makes the first weeks of the platform the one
-- period you can't reconstruct.
--
-- So: reconstruct what the timestamp columns already record. Each event is
-- stamped source='backfill' and metadata.backfilled=true, because these are
-- inferred from the current row, not observed as they happened — an event
-- that was overwritten before this migration ran is gone and stays gone.
--
-- Idempotent: every insert is guarded on (event_name, subject_id), so
-- re-running adds nothing.

begin;

-- Contacts ------------------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, contact_id, actor_kind, source,
  metadata, occurred_at
)
select 'contact_created', 'contact', c.id, c.id, 'system', 'backfill',
       jsonb_build_object('backfilled', true), c.created_at
from public.beta_go_contacts c
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'contact_created' and e.subject_id = c.id
);

-- Leads ---------------------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, sell_lead_id, buy_lead_id,
  contact_id, new_state, amount, actor_kind, source, metadata, occurred_at
)
select
  case when l.intent = 'sell' then 'sell_lead_created' else 'buy_lead_created' end,
  case when l.intent = 'sell' then 'sell_lead' else 'buy_lead' end,
  l.id, l.event_slug,
  case when l.intent = 'sell' then l.id end,
  case when l.intent = 'buy' then l.id end,
  l.contact_id, l.status,
  case when l.intent = 'sell' then l.ask_each else l.max_price_each end,
  case when l.intent = 'sell' then 'seller' else 'buyer' end,
  'backfill',
  jsonb_build_object('backfilled', true, 'quantity', l.quantity,
                     'acquisition_channel', l.acquisition_channel),
  l.created_at
from public.beta_go_leads l
where not exists (
  select 1 from public.lifecycle_events e
   where e.subject_id = l.id
     and e.event_name in ('sell_lead_created', 'buy_lead_created')
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, sell_lead_id, contact_id,
  new_state, actor_kind, source, metadata, occurred_at
)
select 'seller_declared_ticket_sent', 'sell_lead', l.id, l.event_slug, l.id,
       l.contact_id, l.status, 'seller', 'backfill',
       jsonb_build_object('backfilled', true), l.seller_ticket_sent_at
from public.beta_go_leads l
where l.seller_ticket_sent_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'seller_declared_ticket_sent' and e.subject_id = l.id
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, sell_lead_id, contact_id,
  new_state, actor_kind, actor_label, source, metadata, occurred_at
)
select 'ticket_received_by_platform', 'sell_lead', l.id, l.event_slug, l.id,
       l.contact_id, l.status, 'ops', l.ticket_received_by, 'backfill',
       jsonb_build_object('backfilled', true), l.ticket_received_at
from public.beta_go_leads l
where l.ticket_received_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'ticket_received_by_platform' and e.subject_id = l.id
  );

-- Units ---------------------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, sell_lead_id,
  new_state, amount, actor_kind, source, metadata, occurred_at
)
select 'unit_created', 'ticket_unit', u.id, u.event_slug, u.id, u.sell_lead_id,
       'available', u.price_each, 'system', 'backfill',
       jsonb_build_object('backfilled', true, 'unit_index', u.unit_index),
       u.created_at
from public.beta_ticket_units u
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'unit_created' and e.subject_id = u.id
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, sell_lead_id,
  previous_state, new_state, amount, actor_kind, source, metadata, occurred_at
)
select
  case u.status when 'sold' then 'unit_sold' else 'unit_withdrawn' end,
  'ticket_unit', u.id, u.event_slug, u.id, u.sell_lead_id,
  'available', u.status::text, u.price_each, 'system', 'backfill',
  jsonb_build_object('backfilled', true), u.updated_at
from public.beta_ticket_units u
where u.status in ('sold', 'withdrawn')
  and not exists (
    select 1 from public.lifecycle_events e
     where e.subject_id = u.id and e.event_name in ('unit_sold', 'unit_withdrawn')
  );

-- Offers --------------------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, new_state, amount, actor_kind, source, metadata, occurred_at
)
select 'offer_created', 'offer', o.id, o.event_slug, o.unit_id, o.id,
       o.buy_lead_id, o.seat_key, 'offered', o.price_each, 'system', 'backfill',
       jsonb_build_object('backfilled', true, 'rank', o.rank), o.offered_at
from public.beta_offers o
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'offer_created' and e.subject_id = o.id
);

-- Accepted: only recoverable for offers that got at least as far as accepted.
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, previous_state, new_state, amount, actor_kind,
  source, metadata, occurred_at
)
select 'offer_accepted', 'offer', o.id, o.event_slug, o.unit_id, o.id,
       o.buy_lead_id, o.seat_key, 'offered', 'accepted', o.price_each, 'buyer',
       'backfill', jsonb_build_object('backfilled', true),
       coalesce(o.responded_at, o.offered_at)
from public.beta_offers o
where o.status in ('accepted', 'paid', 'needs_review', 'expired_unpaid', 'payment_failed')
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'offer_accepted' and e.subject_id = o.id
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, new_state, amount, actor_kind, source, metadata, occurred_at
)
select 'buyer_payment_declared', 'offer', o.id, o.event_slug, o.unit_id, o.id,
       o.buy_lead_id, o.seat_key, o.status::text, o.price_each, 'buyer', 'backfill',
       jsonb_build_object('backfilled', true), o.buyer_declared_sent_at
from public.beta_offers o
where o.buyer_declared_sent_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'buyer_payment_declared' and e.subject_id = o.id
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, previous_state, new_state, amount, actor_kind,
  actor_label, source, metadata, occurred_at
)
select 'buyer_payment_confirmed', 'offer', o.id, o.event_slug, o.unit_id, o.id,
       o.buy_lead_id, o.seat_key, 'accepted', 'paid',
       coalesce(o.payment_amount, o.price_each), 'ops', o.payment_recorded_by,
       'backfill', jsonb_build_object('backfilled', true),
       coalesce(o.payment_recorded_at, o.responded_at, o.offered_at)
from public.beta_offers o
where o.status = 'paid'
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'buyer_payment_confirmed' and e.subject_id = o.id
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, new_state, actor_kind, source, metadata, occurred_at
)
select 'ticket_forwarded_to_buyer', 'offer', o.id, o.event_slug, o.unit_id, o.id,
       o.buy_lead_id, o.seat_key, o.status::text, 'ops', 'backfill',
       jsonb_build_object('backfilled', true), o.ticket_transferred_at
from public.beta_offers o
where o.ticket_transferred_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'ticket_forwarded_to_buyer' and e.subject_id = o.id
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, new_state, amount, actor_kind, source, metadata, occurred_at
)
select 'seller_payout_released', 'offer', o.id, o.event_slug, o.unit_id, o.id,
       o.buy_lead_id, o.seat_key, o.status::text,
       coalesce(o.payment_amount, o.price_each), 'ops', 'backfill',
       jsonb_build_object('backfilled', true), o.payout_released_at
from public.beta_offers o
where o.payout_released_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'seller_payout_released' and e.subject_id = o.id
  );

-- Terminal, non-paid outcomes.
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  buy_lead_id, seat_key, new_state, amount, actor_kind, source, metadata, occurred_at
)
select
  case o.status
    when 'declined' then 'offer_declined'
    when 'expired_no_response' then 'offer_expired_no_response'
    when 'expired_unpaid' then 'offer_expired_unpaid'
    when 'payment_failed' then 'offer_payment_failed'
    when 'withdrawn' then 'offer_withdrawn'
    when 'needs_review' then 'offer_flagged_for_review'
  end,
  'offer', o.id, o.event_slug, o.unit_id, o.id, o.buy_lead_id, o.seat_key,
  o.status::text, o.price_each,
  case when o.status = 'declined' then 'buyer' else 'system' end,
  'backfill',
  jsonb_build_object('backfilled', true, 'decline_reason', o.decline_reason),
  coalesce(o.responded_at, o.updated_at, o.offered_at)
from public.beta_offers o
where o.status in ('declined', 'expired_no_response', 'expired_unpaid',
                   'payment_failed', 'withdrawn', 'needs_review')
  and not exists (
    select 1 from public.lifecycle_events e
     where e.subject_id = o.id
       and e.event_name in ('offer_declined', 'offer_expired_no_response',
                            'offer_expired_unpaid', 'offer_payment_failed',
                            'offer_withdrawn', 'offer_flagged_for_review')
  );

-- Deals ---------------------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, unit_id, offer_id,
  sell_lead_id, buy_lead_id, new_state, actor_kind, source, metadata, occurred_at
)
select 'deal_created', 'deal', d.id, d.event_slug, d.unit_id, d.offer_id,
       d.sell_lead_id, d.buy_lead_id, d.stage::text, 'system', 'backfill',
       jsonb_build_object('backfilled', true), d.created_at
from public.beta_deals d
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'deal_created' and e.subject_id = d.id
);

-- Card-payment path (dormant, but the rows exist) ---------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, new_state, amount, actor_kind,
  source, metadata, occurred_at
)
select 'listing_created', 'listing', li.id, li.status::text, li.price, 'seller',
       'backfill', jsonb_build_object('backfilled', true), li.created_at
from public.listings li
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'listing_created' and e.subject_id = li.id
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, new_state, amount, actor_kind,
  source, metadata, occurred_at
)
select 'transaction_created', 'transaction', t.id, t.escrow_status::text, t.amount,
       'buyer', 'backfill',
       jsonb_build_object('backfilled', true, 'listing_id', t.listing_id),
       t.created_at
from public.transactions t
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'transaction_created' and e.subject_id = t.id
);

commit;

-- 0022 — Offer payment audit fields + backfill ticket units for existing sells.
--
-- Marking an offer paid previously only flipped status. These columns tie the
-- e-transfer confirmation to the offer so a second payment has a place to land
-- and ops has an audit trail. Also materializes units for sell leads that
-- predate 0021's create-on-insert path.
--
-- Backfill price is least(ask, paid) so rows that somehow stored ask above face
-- still produce units under the 0021 unit price-cap trigger.

begin;

alter table public.beta_offers
  add column if not exists payment_amount numeric(10, 2)
    check (payment_amount is null or payment_amount >= 0),
  add column if not exists payment_reference text,
  add column if not exists payment_recorded_at timestamptz,
  add column if not exists payment_recorded_by text;

comment on column public.beta_offers.payment_amount is
  'E-transfer amount ops confirmed against this offer. Null until paid/needs_review.';
comment on column public.beta_offers.payment_reference is
  'Ops free-text reference (Interac memo, screenshot note, etc.).';
comment on column public.beta_offers.payment_recorded_at is
  'When ops recorded the payment against this offer.';

-- Backfill: one available unit per index for open sell leads that have none.
insert into public.beta_ticket_units (sell_lead_id, event_slug, unit_index, price_each, status)
select
  l.id,
  l.event_slug,
  gs.i,
  case
    when l.paid_each is not null then least(l.ask_each, l.paid_each)
    else l.ask_each
  end,
  'available'
from public.beta_go_leads l
cross join lateral generate_series(1, greatest(1, coalesce(l.quantity, 1))) as gs(i)
where l.intent = 'sell'
  and l.status is distinct from 'cancelled'
  and l.ask_each is not null
  and l.ask_each >= 0
  and (l.paid_each is null or l.paid_each >= 0)
  and not exists (
    select 1 from public.beta_ticket_units u
      where u.sell_lead_id = l.id and u.unit_index = gs.i
  );

commit;

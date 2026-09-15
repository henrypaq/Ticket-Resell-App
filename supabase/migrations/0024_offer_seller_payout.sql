-- 0024 — Seller payout / ticket-transfer timestamps on offers.
--
-- After buyer payment is confirmed (status=paid), ops marks the ticket
-- transferred and releases the seller payout. These columns power the seller
-- “payment released” notice without inventing a second money rail yet.

begin;

alter table public.beta_offers
  add column if not exists ticket_transferred_at timestamptz,
  add column if not exists payout_released_at timestamptz;

comment on column public.beta_offers.ticket_transferred_at is
  'When ops confirmed the ticket was transferred to the buyer.';
comment on column public.beta_offers.payout_released_at is
  'When ops released (or recorded) the Interac payout to the seller.';

commit;

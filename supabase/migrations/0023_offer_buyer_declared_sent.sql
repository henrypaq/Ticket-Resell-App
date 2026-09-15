-- 0023 — Buyer-declared e-transfer sent timestamp on offers.
--
-- After accept, the buyer sees platform Interac details. Tapping
-- "I've sent the money" stamps this column so we can show a payment-held
-- screen while ops confirms. Does not change live-offer exclusivity.

begin;

alter table public.beta_offers
  add column if not exists buyer_declared_sent_at timestamptz;

comment on column public.beta_offers.buyer_declared_sent_at is
  'When the buyer tapped “I’ve sent the money” on the claim screen. Null until then.';

commit;

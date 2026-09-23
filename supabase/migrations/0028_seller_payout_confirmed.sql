-- 0028 — Seller confirms they received the Interac payout (user-facing ack).

begin;

alter table public.beta_offers
  add column if not exists seller_payout_confirmed_at timestamptz;

comment on column public.beta_offers.seller_payout_confirmed_at is
  'Seller tapped “I received the money” after ops released Interac payout.';

create index if not exists beta_offers_payout_confirm_idx
  on public.beta_offers (status, payout_released_at, seller_payout_confirmed_at)
  where payout_released_at is not null;

commit;

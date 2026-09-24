-- 0030 — Predetermined (fixed) ticket price on beta event catalog.
-- When set, buyers skip naming their own max and see a fixed price breakdown.

begin;

alter table public.beta_event_catalog
  add column if not exists fixed_price_each numeric(10, 2)
    check (fixed_price_each is null or fixed_price_each >= 0);

comment on column public.beta_event_catalog.fixed_price_each is
  'When set, the event uses a predetermined CAD ticket price (buyer-focused). Buyers cannot set a max; they see an itemized breakdown at that price.';

commit;

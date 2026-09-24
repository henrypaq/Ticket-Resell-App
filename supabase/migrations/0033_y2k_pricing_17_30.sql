-- Y2K predetermined pricing: list before 15% off + $1.50 fee → total $17.30.
-- 18.59 × 0.85 = 15.8015 → net ticket $15.80; + $1.50 fee = $17.30.

begin;

update public.beta_event_catalog
set
  list_price_each = 18.59,
  discount_each = 2.79,
  discount_label = '15% off',
  fixed_price_each = 15.80,
  service_fee_each = 1.50,
  updated_at = now()
where
  fixed_price_each is not null
  and (
    lower(name) like '%y2k%'
    or lower(slug) like '%y2k%'
    or lower(name) like '%apt200%'
    or lower(slug) like '%apt200%'
  );

commit;

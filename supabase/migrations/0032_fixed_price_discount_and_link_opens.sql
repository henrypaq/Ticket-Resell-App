-- Fixed-price display pricing (list / discount / fee override) + campaign link opens.

begin;

alter table public.beta_event_catalog
  add column if not exists list_price_each numeric(10, 2)
    check (list_price_each is null or list_price_each >= 0),
  add column if not exists discount_each numeric(10, 2)
    check (discount_each is null or discount_each >= 0),
  add column if not exists discount_label text,
  add column if not exists service_fee_each numeric(10, 2)
    check (service_fee_each is null or service_fee_each >= 0);

comment on column public.beta_event_catalog.list_price_each is
  'Optional face/list ticket price before discount (shown on fixed-price checkout).';
comment on column public.beta_event_catalog.discount_each is
  'Optional per-ticket discount amount in CAD (shown as a negative line).';
comment on column public.beta_event_catalog.discount_label is
  'Optional discount label, e.g. “15% off”.';
comment on column public.beta_event_catalog.service_fee_each is
  'Optional per-ticket service fee override for fixed-price events; null = platform default.';

-- Y2K Party: list $15, 15% off ($2.25), our fee $1.50 → net ticket $12.75, total $14.25.
update public.beta_event_catalog
set
  list_price_each = 15,
  discount_each = 2.25,
  discount_label = '15% off',
  fixed_price_each = 12.75,
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

create table if not exists public.beta_campaign_link_opens (
  id uuid primary key default gen_random_uuid(),
  src text not null,
  opened_at timestamptz not null default now(),
  path text,
  user_agent text,
  contact_id uuid references public.beta_go_contacts (id) on delete set null,
  member_id uuid,
  ip_hash text
);

create index if not exists beta_campaign_link_opens_src_opened_idx
  on public.beta_campaign_link_opens (src, opened_at desc);

comment on table public.beta_campaign_link_opens is
  'One row per attributed open of an ops campaign link (?src=).';

commit;

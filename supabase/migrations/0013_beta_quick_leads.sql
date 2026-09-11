-- 0013 — Quick beta buy/sell leads (`/go` flow).
-- Separate from the long questionnaire (`beta_signups`). Manual facilitation:
-- we contact buyers/sellers; no listings/payments here.

begin;

create table if not exists public.beta_quick_leads (
  id                   uuid primary key default gen_random_uuid(),
  intent               text not null check (intent in ('buy', 'sell')),
  event_slug           text not null,
  quantity             int not null check (quantity >= 1 and quantity <= 20),
  contact_phone        text,
  contact_instagram    text,
  -- Sell-only pricing (CAD). ask_each must never exceed paid_each (face-value cap).
  paid_each            numeric(10, 2),
  ask_each             numeric(10, 2),
  ticket_share_url     text,
  ticket_evidence_path text,
  etransfer_name       text,
  etransfer_email      text,
  etransfer_phone      text,
  seller_terms_accepted_at timestamptz,
  acquisition_channel  text,
  created_at           timestamptz not null default now(),
  constraint beta_quick_leads_contact_check check (
    coalesce(nullif(trim(contact_phone), ''), nullif(trim(contact_instagram), '')) is not null
  ),
  constraint beta_quick_leads_sell_fields_check check (
    intent = 'buy'
    or (
      paid_each is not null
      and ask_each is not null
      and ask_each >= 0
      and paid_each >= 0
      and ask_each <= paid_each
      and etransfer_name is not null
      and length(trim(etransfer_name)) > 0
      and (
        coalesce(nullif(trim(etransfer_email), ''), nullif(trim(etransfer_phone), '')) is not null
      )
      and (
        coalesce(nullif(trim(ticket_share_url), ''), nullif(trim(ticket_evidence_path), '')) is not null
      )
      and seller_terms_accepted_at is not null
    )
  )
);

create index if not exists beta_quick_leads_created_idx
  on public.beta_quick_leads (created_at desc);

create index if not exists beta_quick_leads_intent_event_idx
  on public.beta_quick_leads (intent, event_slug);

alter table public.beta_quick_leads enable row level security;
-- No anon policies: all writes go through the service-role client.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'beta-quick-tickets',
  'beta-quick-tickets',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

commit;

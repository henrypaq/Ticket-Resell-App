-- 20260918123254 — beta_deals: operational transaction lifecycle for one ticket unit.
-- Recovered verbatim from supabase_migrations.schema_migrations on the linked remote,
-- which already has this version applied. Body is byte-identical to what was executed.

do $$ begin
  create type beta_deal_stage as enum (
    'awaiting_seller_confirmation',
    'awaiting_seller_transfer',
    'awaiting_ticket_receipt',
    'awaiting_buyer',
    'awaiting_payment_verification',
    'awaiting_ticket_delivery',
    'awaiting_seller_payout',
    'completed',
    'cancelled',
    'failed',
    'refund_required'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.beta_deals (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.beta_offers (id) on delete restrict,
  unit_id uuid not null references public.beta_ticket_units (id) on delete restrict,
  buy_lead_id uuid references public.beta_go_leads (id) on delete set null,
  sell_lead_id uuid references public.beta_go_leads (id) on delete set null,
  event_slug text not null,
  event_date date not null,
  stage beta_deal_stage not null default 'awaiting_seller_confirmation',
  seller_confirmation_requested_at timestamptz,
  seller_confirmation_expires_at timestamptz,
  seller_confirmed_at timestamptz,
  seller_unavailable_at timestamptz,
  seller_declared_transferred_at timestamptz,
  ticket_received_at timestamptz,
  buyer_payment_opened_at timestamptz,
  ticket_delivered_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.beta_deals is
  'Operational transaction for one ticket unit. Matching still lives on beta_offers; this is the human-facing lifecycle.';

comment on column public.beta_deals.ticket_received_at is
  'Ops confirmed the platform received the seller ticket. Buyer payment must not open before this.';

create unique index if not exists beta_deals_one_live_per_unit
  on public.beta_deals (unit_id)
  where stage not in ('completed', 'cancelled', 'failed', 'refund_required');

create index if not exists beta_deals_stage_idx
  on public.beta_deals (stage, created_at desc);

create index if not exists beta_deals_seller_confirm_expiry_idx
  on public.beta_deals (seller_confirmation_expires_at)
  where stage = 'awaiting_seller_confirmation';

create index if not exists beta_deals_event_date_idx
  on public.beta_deals (event_date, stage);

create index if not exists beta_deals_sell_lead_idx
  on public.beta_deals (sell_lead_id);

create index if not exists beta_deals_buy_lead_idx
  on public.beta_deals (buy_lead_id);

create or replace function public.touch_beta_deals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists beta_deals_touch on public.beta_deals;
create trigger beta_deals_touch
  before update on public.beta_deals
  for each row execute function public.touch_beta_deals();

alter table public.beta_deals enable row level security;

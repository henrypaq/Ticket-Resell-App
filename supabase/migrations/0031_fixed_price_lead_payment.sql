-- Fixed-price (predetermined) buy leads: buyer Interac declare + ops payment/ticket stamps.
-- These buys never create beta_offers; the lead itself is the transaction row.

begin;

alter table public.beta_go_leads
  add column if not exists buyer_declared_sent_at timestamptz,
  add column if not exists payment_amount numeric(10, 2),
  add column if not exists payment_recorded_at timestamptz,
  add column if not exists payment_recorded_by text,
  add column if not exists ticket_forwarded_at timestamptz;

comment on column public.beta_go_leads.buyer_declared_sent_at is
  'Buyer tapped “I’ve sent the money” on a fixed-price checkout before joining the queue.';
comment on column public.beta_go_leads.payment_amount is
  'Expected Interac amount (CAD) declared at fixed-price checkout.';
comment on column public.beta_go_leads.payment_recorded_at is
  'Ops confirmed the fixed-price Interac landed.';
comment on column public.beta_go_leads.payment_recorded_by is
  'Ops operator who confirmed fixed-price payment (email or “ops”).';
comment on column public.beta_go_leads.ticket_forwarded_at is
  'Ops confirmed the ticket was emailed/transferred to the fixed-price buyer.';

create index if not exists beta_go_leads_fixed_price_payment_idx
  on public.beta_go_leads (intent, buyer_declared_sent_at, payment_recorded_at, ticket_forwarded_at)
  where intent = 'buy' and buyer_declared_sent_at is not null;

commit;

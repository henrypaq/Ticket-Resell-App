-- 0026 — Ops transaction checkpoints: seller→platform custody + split forward stamps.
--
-- Buyer Interac declare already lives on beta_offers.buyer_declared_sent_at (0023).
-- Café Campus sellers transfer tickets to the platform before/when listing; we need
-- parallel stamps on the sell lead so ops can verify custody independently of the
-- matched offer. Ticket→buyer and payout→seller stay on the offer but are set by
-- separate ops actions (no longer one combined click).

begin;

-- Sell lead: seller declared transfer to platform + ops verified receipt.
alter table public.beta_go_leads
  add column if not exists seller_ticket_sent_at timestamptz,
  add column if not exists ticket_received_at timestamptz,
  add column if not exists ticket_received_by text;

comment on column public.beta_go_leads.seller_ticket_sent_at is
  'Seller tapped “I’ve transferred the ticket” to the platform custody inbox.';
comment on column public.beta_go_leads.ticket_received_at is
  'Ops verified the ticket arrived in platform custody (Café email/profile).';
comment on column public.beta_go_leads.ticket_received_by is
  'Ops operator who confirmed custody (email or “ops”).';

-- Offer: clarify existing ticket_transferred_at is platform→buyer only.
comment on column public.beta_offers.ticket_transferred_at is
  'When ops confirmed the ticket was forwarded from platform custody to the buyer.';

create index if not exists beta_go_leads_ticket_custody_idx
  on public.beta_go_leads (intent, seller_ticket_sent_at, ticket_received_at)
  where intent = 'sell';

create index if not exists beta_offers_buyer_declared_sent_idx
  on public.beta_offers (status, buyer_declared_sent_at)
  where buyer_declared_sent_at is not null;

create index if not exists beta_offers_forward_queue_idx
  on public.beta_offers (status, ticket_transferred_at, payout_released_at)
  where status = 'paid';

commit;

-- Fixed-price buyers can tell us the transferred ticket actually arrived.
--
-- Home keeps a "ticket transferred" card for every forwarded lead until the
-- buyer taps "I got my ticket". The stamp is the buyer's own word, so it's a
-- separate column from ops' ticket_forwarded_at rather than a status change —
-- the lead is already `done`, and cancelling it would drop a real sale.
-- The existing tg_lifecycle_go_leads trigger logs the change as lead_updated
-- with before/after, so the confirmation lands in lifecycle history as-is.

begin;

alter table public.beta_go_leads
  add column if not exists buyer_confirmed_received_at timestamptz;

comment on column public.beta_go_leads.buyer_confirmed_received_at is
  'Buyer confirmed the transferred ticket arrived (dismisses the home card).';

commit;

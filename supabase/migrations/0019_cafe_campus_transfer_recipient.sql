-- 0019 — Café Campus ticket-transfer recipient on /go buy leads.
-- Official ticket handoff needs the buyer's legal name + email.

begin;

alter table public.beta_go_leads
  add column if not exists transfer_first_name text,
  add column if not exists transfer_last_name text,
  add column if not exists transfer_email text;

comment on column public.beta_go_leads.transfer_first_name is
  'Buyer first name for venue ticket transfer (e.g. Café Campus).';
comment on column public.beta_go_leads.transfer_last_name is
  'Buyer last name for venue ticket transfer (e.g. Café Campus).';
comment on column public.beta_go_leads.transfer_email is
  'Buyer email for venue ticket transfer (e.g. Café Campus).';

commit;

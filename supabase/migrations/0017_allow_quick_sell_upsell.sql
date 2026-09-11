-- 0017 — Allow ask_each > paid_each on beta quick sell leads (upsell OK for now).

begin;

alter table public.beta_quick_leads
  drop constraint if exists beta_quick_leads_sell_fields_check;

alter table public.beta_quick_leads
  add constraint beta_quick_leads_sell_fields_check check (
    intent = 'buy'
    or (
      paid_each is not null
      and ask_each is not null
      and ask_each >= 0
      and paid_each >= 0
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
  );

comment on column public.beta_quick_leads.ask_each is
  'Seller ask price per ticket (CAD). Upsell above paid_each is allowed during beta.';

commit;

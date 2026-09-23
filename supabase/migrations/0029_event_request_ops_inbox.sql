-- 0029 — Event request ops inbox: track which requests ops has opened.

begin;

alter table public.beta_member_event_requests
  add column if not exists seen_at timestamptz,
  add column if not exists resolved_at timestamptz;

comment on column public.beta_member_event_requests.seen_at is
  'When an ops user first opened / marked this request as seen (badge clear).';
comment on column public.beta_member_event_requests.resolved_at is
  'When ops marked the request handled (archived from open inbox).';

create index if not exists beta_member_event_requests_unseen_idx
  on public.beta_member_event_requests (created_at desc)
  where seen_at is null and resolved_at is null;

commit;

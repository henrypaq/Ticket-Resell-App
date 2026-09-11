-- 0016 — Per-event fake waitlist front padding (ops-tunable social proof).

begin;

create table if not exists public.beta_event_queue_config (
  event_slug text primary key,
  fake_front integer not null default 0
    check (fake_front >= 0 and fake_front <= 500),
  updated_at timestamptz not null default now()
);

comment on table public.beta_event_queue_config is
  'Ops-tunable artificial spots ahead of real waitlist joiners per event_slug.';

comment on column public.beta_event_queue_config.fake_front is
  'Added to real 1-based queue position so early users see # (real + fake_front).';

alter table public.beta_event_queue_config enable row level security;

-- Service-role only; no public policies (same pattern as beta_signups PII tables).

insert into public.beta_event_queue_config (event_slug, fake_front) values
  ('cafe-campus', 6),
  ('montreal-frosh-muzique', 2),
  ('niska-bell-center', 2),
  ('piknik-electronik', 2),
  ('stereo', 2),
  ('new-city-gas', 2),
  ('montreal-frosh-week', 2)
on conflict (event_slug) do update
  set fake_front = excluded.fake_front,
      updated_at = now();

commit;

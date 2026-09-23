-- 0027 — Ops-managed beta event catalog + public flyer storage.
--
-- Live buy/sell board reads from this table (merged over the static seed in
-- src/lib/beta-events.ts). Admins create/publish rows from /ops/events.

begin;

create table if not exists public.beta_event_catalog (
  slug            text primary key
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  name            text not null check (char_length(trim(name)) between 1 and 160),
  venue           text not null check (char_length(trim(venue)) between 1 and 160),
  city            text not null default 'Montreal'
    check (char_length(trim(city)) between 1 and 80),
  blurb           text not null default ''
    check (char_length(blurb) <= 500),
  flyer_url       text not null
    check (char_length(trim(flyer_url)) between 1 and 500),
  flyer_path      text,
  days            text[] not null default '{}'::text[],
  extra_date_keys text[] not null default '{}'::text[],
  supported       boolean not null default false,
  entry_note      text check (entry_note is null or char_length(entry_note) <= 200),
  doors_hour      smallint check (doors_hour is null or (doors_hour >= 0 and doors_hour <= 23)),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text,
  constraint beta_event_catalog_schedule_check check (
    cardinality(days) > 0 or cardinality(extra_date_keys) > 0 or supported = false
  )
);

comment on table public.beta_event_catalog is
  'Ops-curated nightlife events for the beta board. Merged over static seeds at runtime.';
comment on column public.beta_event_catalog.days is
  'Recurring weekdays (Monday…Sunday). Empty for one-offs.';
comment on column public.beta_event_catalog.extra_date_keys is
  'One-off Montreal nightlife dates YYYY-MM-DD.';
comment on column public.beta_event_catalog.supported is
  'When true, appears on home / upcoming / buy / sell if scheduled for a night.';
comment on column public.beta_event_catalog.flyer_path is
  'Storage path inside beta-event-flyers bucket when uploaded via ops.';

create index if not exists beta_event_catalog_supported_idx
  on public.beta_event_catalog (supported, updated_at desc);

alter table public.beta_event_catalog enable row level security;
-- Service-role only (ops writes via admin client).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'beta-event-flyers',
  'beta-event-flyers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read for flyer URLs used in <img src>.
drop policy if exists "beta_event_flyers_public_read" on storage.objects;
create policy "beta_event_flyers_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'beta-event-flyers');

commit;

-- 0010 — beta post-signup preferences, event interest, and support inbox.
--
-- Extends the pre-auth `beta_signups` lead table (0009) so the Events / Notis /
-- Help shell can persist communication prefs and per-event intent (waitlist vs
-- sell) before real accounts and automated SMS/email exist. Payment stays
-- manual for the beta; this is preference + demand capture only.
--
-- Same PII posture as 0009: no SELECT/UPDATE/DELETE for anon or authenticated.
-- All reads and updates go through the service-role client in
-- `domains/beta-signup/service.ts`, gated by the signup-id cookie set at
-- join time.

begin;

-- Channel prefs for when queue/ticket alerts are wired. Defaults favour email
-- (already collected + verified-ish via the address they typed); SMS starts
-- off unless they opted in on the questionnaire (`notify_opt_in`).
alter table public.beta_signups
  add column if not exists notify_queue_email   boolean not null default true,
  add column if not exists notify_queue_sms     boolean not null default false,
  add column if not exists notify_tickets_email boolean not null default true,
  add column if not exists notify_tickets_sms   boolean not null default false;

-- Per-event intent for supported beta venues. Distinct from `waitlist_entries`
-- (signed-in, real Event rows) and from `interested_events` on the signup row
-- (questionnaire multi-select of venues they care about in general).
create table if not exists public.beta_event_interests (
  id          uuid primary key default gen_random_uuid(),
  signup_id   uuid not null references public.beta_signups(id) on delete cascade,
  event_slug  text not null,
  intent      text not null check (intent in ('waitlist', 'sell')),
  created_at  timestamptz not null default now(),
  unique (signup_id, event_slug, intent)
);

create index if not exists beta_event_interests_signup_idx
  on public.beta_event_interests (signup_id);

-- Crowdsourced "please support this event" requests from the Events tab.
create table if not exists public.beta_event_requests (
  id          uuid primary key default gen_random_uuid(),
  signup_id   uuid references public.beta_signups(id) on delete set null,
  name        text not null,
  details     text,
  created_at  timestamptz not null default now()
);

create index if not exists beta_event_requests_signup_idx
  on public.beta_event_requests (signup_id);

-- Help-tab support inbox. Delivery to the contact mailbox is a follow-on
-- (Resend / inbox alert on insert); persisting here is the beta source of truth.
create table if not exists public.beta_support_messages (
  id          uuid primary key default gen_random_uuid(),
  signup_id   uuid references public.beta_signups(id) on delete set null,
  email       text not null,
  category    text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists beta_support_messages_created_idx
  on public.beta_support_messages (created_at desc);

alter table public.beta_event_interests enable row level security;
alter table public.beta_event_requests enable row level security;
alter table public.beta_support_messages enable row level security;

-- No client-role policies: service role only. Keep grants off for anon /
-- authenticated so a missing RLS policy can't accidentally open PII.

commit;

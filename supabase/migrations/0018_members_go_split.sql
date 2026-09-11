-- 0018 — Members vs /go split: rename tables, thin contacts, link go leads → members.

begin;

-- ─── Rename classic member tables ───────────────────────────────────────────
alter table if exists public.beta_signups rename to beta_members;
alter table if exists public.beta_event_interests rename to beta_member_interests;
alter table if exists public.beta_event_requests rename to beta_member_event_requests;
alter table if exists public.beta_support_messages rename to beta_member_support_messages;

-- Column renames for clarity
do $$ begin
  alter table public.beta_member_interests rename column signup_id to member_id;
exception when undefined_column then null; when undefined_table then null; end $$;

do $$ begin
  alter table public.beta_member_event_requests rename column signup_id to member_id;
exception when undefined_column then null; when undefined_table then null; end $$;

do $$ begin
  alter table public.beta_member_support_messages rename column signup_id to member_id;
exception when undefined_column then null; when undefined_table then null; end $$;

-- ─── Rename /go leads ───────────────────────────────────────────────────────
alter table if exists public.beta_quick_leads rename to beta_go_leads;

alter table if exists public.beta_event_queue_config rename to beta_queue_config;

-- ─── Thin contact profiles for returning /go users ──────────────────────────
create table if not exists public.beta_go_contacts (
  id                   uuid primary key default gen_random_uuid(),
  contact_phone        text,
  contact_instagram    text,
  etransfer_name       text,
  etransfer_email      text,
  etransfer_phone      text,
  member_id            uuid references public.beta_members(id) on delete set null,
  last_seen_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  constraint beta_go_contacts_identity_check check (
    coalesce(nullif(trim(contact_phone), ''), nullif(trim(contact_instagram), '')) is not null
  )
);

create unique index if not exists beta_go_contacts_phone_uidx
  on public.beta_go_contacts (contact_phone)
  where contact_phone is not null and length(trim(contact_phone)) > 0;

create unique index if not exists beta_go_contacts_ig_uidx
  on public.beta_go_contacts (lower(contact_instagram))
  where contact_instagram is not null and length(trim(contact_instagram)) > 0;

create index if not exists beta_go_contacts_member_idx
  on public.beta_go_contacts (member_id);

alter table public.beta_go_contacts enable row level security;

-- Link go leads to contacts + optional beta members
alter table public.beta_go_leads
  add column if not exists contact_id uuid references public.beta_go_contacts(id) on delete set null,
  add column if not exists member_id uuid references public.beta_members(id) on delete set null;

create index if not exists beta_go_leads_contact_idx on public.beta_go_leads (contact_id);
create index if not exists beta_go_leads_member_idx on public.beta_go_leads (member_id);

comment on table public.beta_members is
  'Full beta members — questionnaire onboarding, alerts, multi-event management.';
comment on table public.beta_go_leads is
  'Low-friction /go buy & sell leads. May link to beta_go_contacts and beta_members.';
comment on table public.beta_go_contacts is
  'Thin returning-visitor profiles for /go (phone and/or Instagram), optional link to beta_members.';

commit;

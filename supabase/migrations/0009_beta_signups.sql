-- 0009 — beta waitlist signup intake (pre-auth landing page).
--
-- This is deliberately NOT the `waitlist_entries` table (0001) — that's a
-- signed-in user joining the per-event ticket waitlist. `beta_signups` is the
-- top-of-funnel lead capture on the anonymous landing page: name/email/phone
-- plus a short questionnaire, collected before anyone has an account.
--
-- PII, so the read side stays locked down: no select policy for anon or
-- authenticated at all (RLS default-denies) — only the service role reads
-- this table, same posture as event_authorizations in 0001.

begin;

create table if not exists public.beta_signups (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  email              text not null,
  phone              text not null,
  intent             text not null check (intent in ('buy', 'sell', 'both')),
  interested_events  text[] not null default '{}',
  interested_other   text,
  priority           text not null check (priority in ('speed', 'profit', 'both')),
  school             text,
  referral_source    text,
  notify_opt_in      boolean not null default false,
  created_at         timestamptz not null default now()
);

-- Dedupe: re-submitting the form with the same email is a no-op
-- (`on conflict do nothing` in the service, matched on this column) rather
-- than a second row. The service lower-cases `email` before every write, so a
-- plain column constraint is sufficient — PostgREST's upsert `onConflict`
-- needs a real unique constraint/index on the literal column(s) named, which
-- an expression index like `lower(email)` would not satisfy.
-- Deliberately NOT an update-on-conflict: an anon `update` policy would have
-- to be `using (true)` (no auth.uid() to scope it to), which would let anyone
-- overwrite any other row just by knowing their email — a griefing vector for
-- no real benefit here.
do $$ begin
  alter table public.beta_signups add constraint beta_signups_email_key unique (email);
exception when duplicate_object then null; end $$;

alter table public.beta_signups enable row level security;

drop policy if exists beta_signups_insert_public on public.beta_signups;
create policy beta_signups_insert_public on public.beta_signups
  for insert to anon, authenticated
  with check (true);

-- RLS policies alone don't grant access — Postgres checks the table-level
-- GRANT first. Other tables in this project picked up anon/authenticated
-- grants automatically via a default-privileges rule tied to whichever role
-- created them (the dashboard's SQL editor, historically); a table created
-- through `supabase db push` doesn't inherit that, so it's explicit here.
-- Only INSERT — no select/update/delete for these roles, matching the RLS
-- policy above and the "PII, write-only from the client" posture.
grant insert on public.beta_signups to anon, authenticated;

commit;

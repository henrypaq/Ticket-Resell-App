-- 0008 — Phase 3: social layer (follows + attendance confirmations).
-- Spec refs: CLAUDE.md § Phase 3 (Friend/follow system, Attendance
-- confirmation "I'm going" visible to friends), data model sketch (`Follow`,
-- `AttendanceConfirmation`).

begin;

-- ---------------------------------------------------------------------------
-- follows — one-directional, no request/approval step (matches the data
-- model sketch exactly: follower_id, followee_id, nothing else). "Friends" in
-- this app means "people I follow", the same simple model most social feeds
-- use for a v1.
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  -- Physically enforced, not just checked in application code — the same
  -- "don't trust a client-side-only rule" posture as the price cap.
  constraint follows_no_self_follow check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

-- ---------------------------------------------------------------------------
-- attendance_confirmations — the "I'm going" signal.
--
-- 'followers' (not 'public'): visible to people who follow this user, not to
-- everyone — named for exactly what the RLS policy below checks, so reading
-- the enum doesn't require reading the policy to know what it means.
-- ---------------------------------------------------------------------------
do $$ begin
  create type attendance_visibility as enum ('followers', 'private');
exception when duplicate_object then null; end $$;

create table if not exists public.attendance_confirmations (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  visibility attendance_visibility not null default 'followers',
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists attendance_event_idx on public.attendance_confirmations (event_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.follows                 enable row level security;
alter table public.attendance_confirmations enable row level security;

-- The follow graph itself isn't sensitive — same openness as profiles
-- (profiles_read_authenticated in 0001). Writes are the follower's alone.
drop policy if exists follows_read_authenticated on public.follows;
create policy follows_read_authenticated on public.follows
  for select to authenticated using (true);

drop policy if exists follows_manage_own on public.follows;
create policy follows_manage_own on public.follows
  for all to authenticated
  using (follower_id = (select auth.uid()))
  with check (follower_id = (select auth.uid()));

-- A viewer always sees their own attendance rows regardless of visibility;
-- otherwise only 'followers'-visibility rows from someone they follow. This
-- is the query "see what events friends are attending" (CLAUDE.md § Phase 3
-- done-when) runs against directly — the friends-going list on an event page
-- and a followed profile's "going" list both read through this policy rather
-- than a service-role bypass.
drop policy if exists attendance_read on public.attendance_confirmations;
create policy attendance_read on public.attendance_confirmations
  for select to authenticated using (
    user_id = (select auth.uid())
    or (
      visibility = 'followers'
      and exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid())
          and f.followee_id = attendance_confirmations.user_id
      )
    )
  );

drop policy if exists attendance_manage_own on public.attendance_confirmations;
create policy attendance_manage_own on public.attendance_confirmations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;

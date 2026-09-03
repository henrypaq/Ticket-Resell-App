-- 0004 — Content needed for the fuller event detail page: DJ lineup,
-- organizer, and a description. Organizers are a lightweight, separate entity
-- from `profiles` (producers aren't authenticated app users yet) so that a
-- future follow system can attach to them without a rework — see CLAUDE.md's
-- Phase 3 social layer, which this deliberately does not build a follow
-- button for yet.

begin;

create table if not exists public.organizers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  handle     text unique,
  avatar_url text,
  bio        text,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists organizer_id uuid references public.organizers (id) on delete set null,
  add column if not exists description text,
  -- Array of { name, role? }. jsonb rather than a join table — a lineup is
  -- small, ordered, and has no independent identity worth a foreign key yet.
  add column if not exists lineup jsonb not null default '[]'::jsonb;

alter table public.organizers enable row level security;

drop policy if exists organizers_read_all on public.organizers;
create policy organizers_read_all on public.organizers
  for select to anon, authenticated using (true);

commit;

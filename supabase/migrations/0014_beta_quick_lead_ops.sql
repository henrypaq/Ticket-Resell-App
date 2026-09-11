-- 0014 — Ops status/notes on quick leads for the beta console (`/ops`).

begin;

alter table public.beta_quick_leads
  add column if not exists status text not null default 'new',
  add column if not exists admin_notes text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.beta_quick_leads
    add constraint beta_quick_leads_status_check
    check (status in ('new', 'contacted', 'matched', 'done', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

create index if not exists beta_quick_leads_status_idx
  on public.beta_quick_leads (status, created_at desc);

commit;

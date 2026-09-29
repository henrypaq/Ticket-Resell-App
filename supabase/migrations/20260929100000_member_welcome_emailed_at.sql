-- Welcome email goes out once, when someone finishes account setup.
--
-- It used to fire on the first beta_members insert. That row is created before
-- setup is done — a Google sign-in makes it the moment /setup renders — so the
-- welcome landed before the person had finished anything. The send now happens
-- at setup completion, and this stamp is the claim that keeps it to one email
-- no matter how many times setup is re-submitted.
--
-- Existing members already got a welcome under the old rule, so they're marked
-- as sent. Adding the column with a default fills them without firing the row
-- lifecycle trigger for every member; dropping the default right after means
-- new rows start unclaimed. The tg_lifecycle_members trigger records each later
-- claim as member_updated with before/after.

begin;

alter table public.beta_members
  add column if not exists welcome_emailed_at timestamptz default now();

alter table public.beta_members
  alter column welcome_emailed_at drop default;

comment on column public.beta_members.welcome_emailed_at is
  'When the welcome email was claimed for sending (set once, at account-setup completion).';

commit;

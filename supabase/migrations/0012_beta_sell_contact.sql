-- 0012 — sell-side contact fields on beta event interests.
--
-- When a beta lead says they have an extra ticket, we need a way to reach them
-- (WhatsApp phone and/or Instagram) before real accounts exist. Stored on the
-- interest row so each event can have its own contact preference.

begin;

alter table public.beta_event_interests
  add column if not exists contact_phone text,
  add column if not exists contact_instagram text;

comment on column public.beta_event_interests.contact_phone is
  'WhatsApp-ready phone for sell intent; optional if contact_instagram is set.';
comment on column public.beta_event_interests.contact_instagram is
  'Instagram handle (no @) for sell intent; alternative to phone.';

commit;

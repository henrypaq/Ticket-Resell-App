-- 0011 — beta signup acquisition channel (QR / bio attribution).
--
-- Distinct from `referral_source` (0009), which is the free-text / preset answer
-- to the questionnaire "how did you hear about us?" step. `acquisition_channel`
-- is first-touch attribution set by the app before the form is submitted — not
-- something the user types.
--
-- Entry-point convention (Instagram bio stays a clean URL):
--   https://mcgilltickets.party/?src=qr_share  — branded /qr share screen
--   https://mcgilltickets.party/?src=qr_print  — plain printable QR
--   https://mcgilltickets.party                 — Instagram link in bio
--
-- Bare apex visits (no `?src=`) are stored as `ig_bio`. That means typed-in /
-- organic hits without a param are counted in the same bucket — acceptable for
-- beta while the bio is the only intentional clean-URL surface. QR payloads
-- always carry `?src=` so they never collide with that default.
--
-- Resume-by-email / email-conflict must NOT overwrite an existing non-null
-- channel (first touch wins).

begin;

alter table public.beta_signups
  add column if not exists acquisition_channel text;

do $$ begin
  alter table public.beta_signups
    add constraint beta_signups_acquisition_channel_check
    check (
      acquisition_channel is null
      or acquisition_channel in ('qr_share', 'qr_print', 'ig_bio')
    );
exception when duplicate_object then null; end $$;

create index if not exists beta_signups_acquisition_channel_idx
  on public.beta_signups (acquisition_channel)
  where acquisition_channel is not null;

comment on column public.beta_signups.acquisition_channel is
  'First-touch entry: qr_share | qr_print | ig_bio (bare URL / Instagram bio). '
  'Separate from referral_source (questionnaire self-report).';

commit;

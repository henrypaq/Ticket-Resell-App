-- 0015 — Expand acquisition channels for ops-added members / broader attribution.

begin;

alter table public.beta_signups
  drop constraint if exists beta_signups_acquisition_channel_check;

alter table public.beta_signups
  add constraint beta_signups_acquisition_channel_check
  check (
    acquisition_channel is null
    or acquisition_channel in (
      'qr_share',
      'qr_print',
      'ig_bio',
      'manual',
      'friend',
      'campus',
      'other'
    )
  );

comment on column public.beta_signups.acquisition_channel is
  'First-touch entry: qr_share | qr_print | ig_bio | manual | friend | campus | other.';

commit;

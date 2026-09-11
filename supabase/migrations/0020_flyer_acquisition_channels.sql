-- 0020 — Flyer QR acquisition channels (Café Campus creatives).

begin;

-- Table was renamed beta_signups → beta_members in 0018; constraint name may vary.
alter table public.beta_members
  drop constraint if exists beta_signups_acquisition_channel_check;

alter table public.beta_members
  drop constraint if exists beta_members_acquisition_channel_check;

alter table public.beta_members
  add constraint beta_members_acquisition_channel_check
  check (
    acquisition_channel is null
    or acquisition_channel in (
      'qr_share',
      'qr_print',
      'ig_bio',
      'manual',
      'friend',
      'campus',
      'other',
      'cafe_soldout',
      'cafe_extra',
      'cafe_hungover',
      'cafe_funnybuyer'
    )
  );

comment on column public.beta_members.acquisition_channel is
  'First-touch entry: qr_share | qr_print | ig_bio | flyer codes (cafe_*) | ops (manual/friend/campus/other).';

commit;

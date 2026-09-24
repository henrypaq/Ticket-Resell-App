-- 20260924090200 — Data capture: the rest of what changes without a trace.
--
-- The 20260923* migrations logged tickets, offers, leads, deals, contacts and
-- the card-payment tables. This adds the settings and permissions that decide
-- what those flows are allowed to do — the things where "who changed this, and
-- when" matters most precisely because they are changed rarely and by hand:
--
--   event_authorizations   the only mechanism that unlocks above-face pricing
--                          (CLAUDE.md § hard constraint 1). Nothing was
--                          recording who created one.
--   profiles.is_admin      who can see and do everything.
--   admin_allowlist        who becomes an admin on their next sign-in.
--   beta_event_catalog     fixed_price_each is what a buyer is charged, and
--                          `supported` is whether an event exists publicly.
--   beta_queue_config      fake_front changes the queue position people see.
--   beta_queue_seat_state  dormancy decides who gets offered tickets.
--   beta_members           profile and notification preferences.
--
-- Same redaction rules apply: emails, names and phone numbers are stripped from
-- the snapshots. The one deliberate exception is admin_allowlist's key, which is
-- a staff address recorded as the subject of the grant — the same operational
-- identity already stored in actor_label, and the whole point of the record.

begin;

-- ---------------------------------------------------------------------------
-- Room for the new subjects
-- ---------------------------------------------------------------------------
alter table public.lifecycle_events drop constraint if exists lifecycle_events_subject_type_check;
alter table public.lifecycle_events add constraint lifecycle_events_subject_type_check
  check (subject_type in (
    'ticket_unit', 'offer', 'sell_lead', 'buy_lead', 'lead', 'contact', 'member',
    'deal', 'interest', 'listing', 'transaction', 'event',
    'event_authorization', 'profile', 'admin_allowlist', 'catalog_event',
    'queue_config', 'seat'
  ));

insert into public.lifecycle_event_types (name, category, description) values
  ('event_authorization_created', 'ops', 'A producer agreement was recorded, unlocking above-face pricing for one event.'),
  ('event_authorization_changed', 'ops', 'An existing above-face authorization was edited.'),
  ('event_authorization_revoked', 'ops', 'An above-face authorization was deleted.'),
  ('admin_granted',               'ops', 'A profile gained admin rights.'),
  ('admin_revoked',               'ops', 'A profile lost admin rights.'),
  ('payout_account_changed',      'ops', 'A profile''s Stripe payout account changed.'),
  ('admin_allowlisted',           'ops', 'An email was added to the admin allowlist.'),
  ('admin_allowlist_removed',     'ops', 'An email was removed from the admin allowlist.'),
  ('catalog_event_created',       'ops', 'An event was added to the beta catalog.'),
  ('catalog_price_changed',       'money', 'An event''s predetermined ticket price changed.'),
  ('catalog_event_published',     'ops', 'An event became visible on the public board.'),
  ('catalog_event_unpublished',   'ops', 'An event was pulled from the public board.'),
  ('catalog_event_changed',       'ops', 'An event''s catalog details changed.'),
  ('catalog_event_deleted',       'ops', 'An event was removed from the catalog.'),
  ('queue_padding_changed',       'ops', 'The artificial queue front for an event was changed.'),
  ('seat_went_dormant',           'lead', 'A seat stopped being offered tickets after repeated misses.'),
  ('seat_reactivated',            'lead', 'A seat re-confirmed and is eligible for offers again.'),
  ('member_created',              'contact', 'Someone completed the full beta member signup.'),
  ('member_preferences_changed',  'contact', 'A member changed notification preferences.'),
  ('member_updated',              'contact', 'A member record changed (values redacted in the log).'),
  ('member_deleted',              'contact', 'A member record was deleted.')
on conflict (name) do update set
  category = excluded.category, description = excluded.description;

-- ---------------------------------------------------------------------------
-- event_authorizations — the price-ceiling override
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_event_authorizations()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_now  record := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE'
     and cardinality(public.lifecycle_changed_keys(before_j, after_j)) = 0 then
    return null;
  end if;

  perform public.lifecycle_emit(
    p_event_name => case tg_op
      when 'INSERT' then 'event_authorization_created'
      when 'DELETE' then 'event_authorization_revoked'
      else 'event_authorization_changed' end,
    p_subject_type => 'event_authorization', p_subject_id => row_now.id,
    p_before => before_j, p_after => after_j,
    p_amount => row_now.max_resale_price,
    p_actor_kind => 'admin',
    p_metadata => jsonb_build_object('event_id', row_now.event_id,
                                     'max_resale_price', row_now.max_resale_price)
  );
  return null;
end;
$$;

drop trigger if exists event_authorizations_lifecycle on public.event_authorizations;
create trigger event_authorizations_lifecycle
  after insert or update or delete on public.event_authorizations
  for each row execute function public.tg_lifecycle_event_authorizations();

-- ---------------------------------------------------------------------------
-- profiles — admin rights and payout destination only.
--
-- Not every profile edit: a display-name change is noise, and the snapshot
-- would carry a redacted copy of it for nothing.
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_profiles()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := to_jsonb(old);
  after_j  jsonb := to_jsonb(new);
begin
  if old.is_admin is distinct from new.is_admin then
    perform public.lifecycle_emit(
      p_event_name => case when new.is_admin then 'admin_granted' else 'admin_revoked' end,
      p_subject_type => 'profile', p_subject_id => new.id,
      p_previous_state => old.is_admin::text, p_new_state => new.is_admin::text,
      p_before => before_j, p_after => after_j, p_actor_kind => 'admin'
    );
  end if;

  if (before_j ->> 'stripe_account_id') is distinct from (after_j ->> 'stripe_account_id') then
    perform public.lifecycle_emit(
      p_event_name => 'payout_account_changed',
      p_subject_type => 'profile', p_subject_id => new.id,
      p_before => before_j, p_after => after_j,
      p_metadata => jsonb_build_object(
        'had_account', (before_j ->> 'stripe_account_id') is not null,
        'has_account', (after_j ->> 'stripe_account_id') is not null)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists profiles_lifecycle on public.profiles;
create trigger profiles_lifecycle
  after update of is_admin, stripe_account_id on public.profiles
  for each row execute function public.tg_lifecycle_profiles();

-- ---------------------------------------------------------------------------
-- admin_allowlist
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_admin_allowlist()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  row_now record := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' then return null; end if;

  perform public.lifecycle_emit(
    p_event_name => case when tg_op = 'INSERT' then 'admin_allowlisted'
                        else 'admin_allowlist_removed' end,
    p_subject_type => 'admin_allowlist',
    p_subject_id => null,
    -- Deliberately not redacted: this is a staff identity and the subject of
    -- the record. See the header.
    p_subject_key => row_now.email,
    p_actor_kind => 'admin',
    p_metadata => jsonb_build_object('note', row_now.note)
  );
  return null;
end;
$$;

drop trigger if exists admin_allowlist_lifecycle on public.admin_allowlist;
create trigger admin_allowlist_lifecycle
  after insert or delete on public.admin_allowlist
  for each row execute function public.tg_lifecycle_admin_allowlist();

-- ---------------------------------------------------------------------------
-- beta_event_catalog — price and visibility
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_catalog()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
  emitted  boolean := false;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  if tg_op in ('INSERT', 'DELETE') then
    perform public.lifecycle_emit(
      p_event_name => case when tg_op = 'INSERT' then 'catalog_event_created'
                          else 'catalog_event_deleted' end,
      p_subject_type => 'catalog_event', p_subject_id => null,
      p_subject_key => row_now.slug, p_event_slug => row_now.slug,
      p_before => before_j, p_after => after_j,
      p_amount => (coalesce(after_j, before_j) ->> 'fixed_price_each')::numeric,
      p_actor_kind => 'ops',
      p_actor_label => row_now.created_by,
      p_metadata => jsonb_build_object('supported', row_now.supported)
    );
    return null;
  end if;

  -- Column arrives in 0030; read through jsonb so this still works on a
  -- database that hasn't applied it.
  if (before_j ->> 'fixed_price_each') is distinct from (after_j ->> 'fixed_price_each') then
    perform public.lifecycle_emit(
      p_event_name => 'catalog_price_changed', p_subject_type => 'catalog_event',
      p_subject_id => null, p_subject_key => new.slug, p_event_slug => new.slug,
      p_previous_state => before_j ->> 'fixed_price_each',
      p_new_state => after_j ->> 'fixed_price_each',
      p_before => before_j, p_after => after_j,
      p_amount => (after_j ->> 'fixed_price_each')::numeric,
      p_actor_kind => 'ops'
    );
    emitted := true;
  end if;

  if old.supported is distinct from new.supported then
    perform public.lifecycle_emit(
      p_event_name => case when new.supported then 'catalog_event_published'
                          else 'catalog_event_unpublished' end,
      p_subject_type => 'catalog_event', p_subject_id => null,
      p_subject_key => new.slug, p_event_slug => new.slug,
      p_previous_state => old.supported::text, p_new_state => new.supported::text,
      p_before => before_j, p_after => after_j, p_actor_kind => 'ops'
    );
    emitted := true;
  end if;

  if not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'catalog_event_changed', p_subject_type => 'catalog_event',
      p_subject_id => null, p_subject_key => new.slug, p_event_slug => new.slug,
      p_before => before_j, p_after => after_j, p_actor_kind => 'ops'
    );
  end if;

  return null;
end;
$$;

drop trigger if exists beta_event_catalog_lifecycle on public.beta_event_catalog;
create trigger beta_event_catalog_lifecycle
  after insert or update or delete on public.beta_event_catalog
  for each row execute function public.tg_lifecycle_catalog();

-- ---------------------------------------------------------------------------
-- beta_queue_config — the padding people see as their position
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_queue_config()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  row_now record := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and old.fake_front is not distinct from new.fake_front then
    return null;
  end if;

  perform public.lifecycle_emit(
    p_event_name => 'queue_padding_changed', p_subject_type => 'queue_config',
    p_subject_id => null, p_subject_key => row_now.event_slug,
    p_event_slug => row_now.event_slug,
    p_previous_state => case when tg_op = 'INSERT' then null else old.fake_front::text end,
    p_new_state => case when tg_op = 'DELETE' then null else new.fake_front::text end,
    p_before => case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    p_after => case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    p_actor_kind => 'ops'
  );
  return null;
end;
$$;

drop trigger if exists beta_queue_config_lifecycle on public.beta_queue_config;
create trigger beta_queue_config_lifecycle
  after insert or update or delete on public.beta_queue_config
  for each row execute function public.tg_lifecycle_queue_config();

-- ---------------------------------------------------------------------------
-- beta_queue_seat_state — who is eligible for an offer
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_seat_state()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := to_jsonb(new);
begin
  if (before_j ->> 'dormant_at') is null and (after_j ->> 'dormant_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'seat_went_dormant', p_subject_type => 'seat',
      p_subject_id => null, p_subject_key => new.seat_key,
      p_event_slug => new.event_slug, p_seat_key => new.seat_key,
      p_before => before_j, p_after => after_j
    );
  end if;

  if (before_j ->> 'reactivated_at') is distinct from (after_j ->> 'reactivated_at')
     and (after_j ->> 'reactivated_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'seat_reactivated', p_subject_type => 'seat',
      p_subject_id => null, p_subject_key => new.seat_key,
      p_event_slug => new.event_slug, p_seat_key => new.seat_key,
      p_before => before_j, p_after => after_j, p_actor_kind => 'buyer'
    );
  end if;

  return null;
end;
$$;

drop trigger if exists beta_queue_seat_state_lifecycle on public.beta_queue_seat_state;
create trigger beta_queue_seat_state_lifecycle
  after insert or update on public.beta_queue_seat_state
  for each row execute function public.tg_lifecycle_seat_state();

-- ---------------------------------------------------------------------------
-- beta_members — the full-signup side of the audience
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_members()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  perform public.lifecycle_emit(
    p_event_name => case
      when tg_op = 'INSERT' then 'member_created'
      when tg_op = 'DELETE' then 'member_deleted'
      when changed && array['notify_queue_email', 'notify_queue_sms',
                            'notify_tickets_email', 'notify_tickets_sms', 'notify_opt_in']
        then 'member_preferences_changed'
      else 'member_updated' end,
    p_subject_type => 'member', p_subject_id => row_now.id,
    p_before => before_j, p_after => after_j,
    p_metadata => jsonb_build_object('intent', row_now.intent,
                                     'acquisition_channel', row_now.acquisition_channel)
  );
  return null;
end;
$$;

drop trigger if exists beta_members_lifecycle on public.beta_members;
create trigger beta_members_lifecycle
  after insert or update or delete on public.beta_members
  for each row execute function public.tg_lifecycle_members();

commit;

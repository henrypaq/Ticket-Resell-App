-- 20260923090100 — Data capture, part 2 of 6: lifecycle triggers.
--
-- One trigger per table that holds ticket, money, or party state. They are the
-- only writers of `lifecycle_events`, which is what makes the log complete:
-- the ops console, the cron sweeps, a server action and a hand-typed psql
-- UPDATE all produce the same history.
--
-- Conventions used throughout:
--   * AFTER triggers, so the row is already committed to its table's own rules
--     (the price-cap and offer-guard triggers from 0001/0021 are BEFORE, and
--     still reject bad writes before anything is logged).
--   * An UPDATE that changes nothing but `updated_at` / `last_seen_at` logs
--     nothing — `lifecycle_changed_keys` ignores those two columns.
--   * Optional/newer columns are read through the row's jsonb form rather than
--     `new.<column>`, so a database where a later migration hasn't landed yet
--     degrades to "no event" instead of erroring on every write.
--   * One UPDATE can legitimately produce several events (accept + payment
--     declared in the same statement); they share a correlation_id.

begin;

-- ---------------------------------------------------------------------------
-- beta_ticket_units
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_ticket_units()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
  ev_name  text;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  if tg_op = 'INSERT' then
    ev_name := 'unit_created';
  elsif tg_op = 'DELETE' then
    ev_name := 'unit_deleted';
  elsif old.status is distinct from new.status then
    ev_name := case new.status
      when 'sold' then 'unit_sold'
      when 'withdrawn' then 'unit_withdrawn'
      when 'available' then 'unit_returned_to_pool'
      else 'unit_status_changed' end;
  elsif 'price_each' = any (changed) then
    ev_name := 'unit_price_changed';
  else
    ev_name := 'unit_updated';
  end if;

  perform public.lifecycle_emit(
    p_event_name     => ev_name,
    p_subject_type   => 'ticket_unit',
    p_subject_id     => row_now.id,
    p_event_slug     => row_now.event_slug,
    p_previous_state => case when tg_op = 'INSERT' then null else old.status::text end,
    p_new_state      => case when tg_op = 'DELETE' then null else new.status::text end,
    p_before         => before_j,
    p_after          => after_j,
    p_amount         => row_now.price_each,
    p_metadata       => jsonb_build_object('unit_index', row_now.unit_index),
    p_unit_id        => row_now.id,
    p_sell_lead_id   => row_now.sell_lead_id
  );

  return null;
end;
$$;

drop trigger if exists beta_ticket_units_lifecycle on public.beta_ticket_units;
create trigger beta_ticket_units_lifecycle
  after insert or update or delete on public.beta_ticket_units
  for each row execute function public.tg_lifecycle_ticket_units();

-- ---------------------------------------------------------------------------
-- beta_offers — the money path, so the most granular of the lot
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_offers()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
  buyer_contact uuid;
  seller_lead   uuid;
  emitted  boolean := false;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  select contact_id into buyer_contact
    from public.beta_go_leads where id = row_now.buy_lead_id;
  select sell_lead_id into seller_lead
    from public.beta_ticket_units where id = row_now.unit_id;

  if tg_op = 'INSERT' then
    perform public.lifecycle_emit(
      p_event_name => 'offer_created', p_subject_type => 'offer',
      p_subject_id => row_now.id, p_event_slug => row_now.event_slug,
      p_new_state => new.status::text, p_before => null, p_after => after_j,
      p_amount => row_now.price_each,
      p_metadata => jsonb_build_object('rank', row_now.rank, 'group_id', row_now.group_id,
                                       'expires_at', row_now.expires_at),
      p_unit_id => row_now.unit_id, p_offer_id => row_now.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => row_now.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => row_now.seat_key
    );
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.lifecycle_emit(
      p_event_name => 'offer_deleted', p_subject_type => 'offer',
      p_subject_id => row_now.id, p_event_slug => row_now.event_slug,
      p_previous_state => old.status::text, p_before => before_j, p_after => null,
      p_amount => row_now.price_each,
      p_unit_id => row_now.unit_id, p_offer_id => row_now.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => row_now.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => row_now.seat_key
    );
    return null;
  end if;

  -- UPDATE ------------------------------------------------------------------
  if old.status is distinct from new.status then
    perform public.lifecycle_emit(
      p_event_name => case new.status
        when 'accepted' then 'offer_accepted'
        when 'paid' then 'buyer_payment_confirmed'
        when 'declined' then 'offer_declined'
        when 'expired_no_response' then 'offer_expired_no_response'
        when 'expired_unpaid' then 'offer_expired_unpaid'
        when 'payment_failed' then 'offer_payment_failed'
        when 'needs_review' then 'offer_flagged_for_review'
        when 'withdrawn' then 'offer_withdrawn'
        else 'offer_status_changed' end,
      p_subject_type => 'offer', p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status::text, p_new_state => new.status::text,
      p_before => before_j, p_after => after_j,
      p_amount => case when new.status = 'paid'
                       then coalesce((after_j ->> 'payment_amount')::numeric, new.price_each)
                       else new.price_each end,
      p_metadata => jsonb_build_object(
        'decline_reason', new.decline_reason,
        'payment_reference_present', (after_j ->> 'payment_reference') is not null,
        'recorded_by', after_j ->> 'payment_recorded_by'
      ),
      p_unit_id => new.unit_id, p_offer_id => new.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => new.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => new.seat_key
    );
    emitted := true;
  end if;

  if (before_j ->> 'buyer_declared_sent_at') is null
     and (after_j ->> 'buyer_declared_sent_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'buyer_payment_declared', p_subject_type => 'offer',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status::text, p_new_state => new.status::text,
      p_before => before_j, p_after => after_j, p_amount => new.price_each,
      p_unit_id => new.unit_id, p_offer_id => new.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => new.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => new.seat_key
    );
    emitted := true;
  end if;

  if (before_j ->> 'ticket_transferred_at') is null
     and (after_j ->> 'ticket_transferred_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'ticket_forwarded_to_buyer', p_subject_type => 'offer',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status::text, p_before => before_j, p_after => after_j,
      p_unit_id => new.unit_id, p_offer_id => new.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => new.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => new.seat_key
    );
    emitted := true;
  end if;

  if (before_j ->> 'payout_released_at') is null
     and (after_j ->> 'payout_released_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'seller_payout_released', p_subject_type => 'offer',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status::text, p_before => before_j, p_after => after_j,
      p_amount => new.price_each,
      p_unit_id => new.unit_id, p_offer_id => new.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => new.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => new.seat_key
    );
    emitted := true;
  end if;

  -- Column arrives in 0028; read through jsonb so an environment that hasn't
  -- applied it yet simply never matches instead of erroring.
  if (before_j ->> 'seller_payout_confirmed_at') is null
     and (after_j ->> 'seller_payout_confirmed_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'seller_payout_confirmed', p_subject_type => 'offer',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status::text, p_before => before_j, p_after => after_j,
      p_amount => new.price_each, p_actor_kind => 'seller',
      p_unit_id => new.unit_id, p_offer_id => new.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => new.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => new.seat_key
    );
    emitted := true;
  end if;

  if not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'offer_updated', p_subject_type => 'offer',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status::text, p_new_state => new.status::text,
      p_before => before_j, p_after => after_j,
      p_unit_id => new.unit_id, p_offer_id => new.id,
      p_sell_lead_id => seller_lead, p_buy_lead_id => new.buy_lead_id,
      p_contact_id => buyer_contact, p_seat_key => new.seat_key
    );
  end if;

  return null;
end;
$$;

drop trigger if exists beta_offers_lifecycle on public.beta_offers;
create trigger beta_offers_lifecycle
  after insert or update or delete on public.beta_offers
  for each row execute function public.tg_lifecycle_offers();

-- ---------------------------------------------------------------------------
-- beta_go_leads — supply and demand, plus seller-side ticket custody
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_go_leads()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  before_j jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_j  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed  text[] := public.lifecycle_changed_keys(before_j, after_j);
  row_now  record := case when tg_op = 'DELETE' then old else new end;
  is_sell  boolean := row_now.intent = 'sell';
  subj     text := case when row_now.intent = 'sell' then 'sell_lead' else 'buy_lead' end;
  emitted  boolean := false;
begin
  if tg_op = 'UPDATE' and cardinality(changed) = 0 then
    return null;
  end if;

  if tg_op in ('INSERT', 'DELETE') then
    perform public.lifecycle_emit(
      p_event_name => case
        when tg_op = 'DELETE' then 'lead_deleted'
        when is_sell then 'sell_lead_created'
        else 'buy_lead_created' end,
      p_subject_type => subj, p_subject_id => row_now.id,
      p_event_slug => row_now.event_slug,
      p_previous_state => case when tg_op = 'DELETE' then old.status else null end,
      p_new_state => case when tg_op = 'DELETE' then null else new.status end,
      p_before => before_j, p_after => after_j,
      p_amount => case when is_sell then row_now.ask_each else row_now.max_price_each end,
      p_metadata => jsonb_build_object(
        'intent', row_now.intent, 'quantity', row_now.quantity,
        'acquisition_channel', row_now.acquisition_channel),
      p_sell_lead_id => case when is_sell then row_now.id else null end,
      p_buy_lead_id  => case when is_sell then null else row_now.id end,
      p_contact_id => row_now.contact_id
    );
    return null;
  end if;

  -- UPDATE ------------------------------------------------------------------
  if old.status is distinct from new.status then
    perform public.lifecycle_emit(
      p_event_name => 'lead_status_changed', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_previous_state => old.status, p_new_state => new.status,
      p_before => before_j, p_after => after_j,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if (before_j ->> 'seller_ticket_sent_at') is null
     and (after_j ->> 'seller_ticket_sent_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'seller_declared_ticket_sent', p_subject_type => 'sell_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_actor_kind => 'seller',
      p_sell_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if (before_j ->> 'ticket_received_at') is null
     and (after_j ->> 'ticket_received_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'ticket_received_by_platform', p_subject_type => 'sell_lead',
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_metadata => jsonb_build_object('received_by', after_j ->> 'ticket_received_by'),
      p_sell_lead_id => new.id, p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if changed && array['ask_each', 'paid_each', 'max_price_each'] then
    perform public.lifecycle_emit(
      p_event_name => 'lead_price_changed', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_amount => case when is_sell then new.ask_each else new.max_price_each end,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if 'quantity' = any (changed) then
    perform public.lifecycle_emit(
      p_event_name => 'lead_quantity_changed', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_metadata => jsonb_build_object('from', old.quantity, 'to', new.quantity),
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if changed && array['contact_id', 'member_id'] then
    perform public.lifecycle_emit(
      p_event_name => 'lead_linked_to_contact', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
    emitted := true;
  end if;

  if not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'lead_updated', p_subject_type => subj,
      p_subject_id => new.id, p_event_slug => new.event_slug,
      p_new_state => new.status, p_before => before_j, p_after => after_j,
      p_sell_lead_id => case when is_sell then new.id else null end,
      p_buy_lead_id  => case when is_sell then null else new.id end,
      p_contact_id => new.contact_id
    );
  end if;

  return null;
end;
$$;

drop trigger if exists beta_go_leads_lifecycle on public.beta_go_leads;
create trigger beta_go_leads_lifecycle
  after insert or update or delete on public.beta_go_leads
  for each row execute function public.tg_lifecycle_go_leads();

-- ---------------------------------------------------------------------------
-- beta_deals — the human-facing operational lifecycle for one unit
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_deals()
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
      when tg_op = 'INSERT' then 'deal_created'
      when tg_op = 'DELETE' then 'deal_deleted'
      else 'deal_stage_changed' end,
    p_subject_type => 'deal', p_subject_id => row_now.id,
    p_event_slug => row_now.event_slug,
    p_previous_state => case when tg_op = 'INSERT' then null else old.stage::text end,
    p_new_state => case when tg_op = 'DELETE' then null else new.stage::text end,
    p_before => before_j, p_after => after_j,
    p_metadata => jsonb_build_object('event_date', row_now.event_date,
                                     'failure_reason', row_now.failure_reason),
    p_unit_id => row_now.unit_id, p_offer_id => row_now.offer_id,
    p_sell_lead_id => row_now.sell_lead_id, p_buy_lead_id => row_now.buy_lead_id
  );

  return null;
end;
$$;

drop trigger if exists beta_deals_lifecycle on public.beta_deals;
create trigger beta_deals_lifecycle
  after insert or update or delete on public.beta_deals
  for each row execute function public.tg_lifecycle_deals();

-- ---------------------------------------------------------------------------
-- beta_go_contacts — the people behind the leads
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_contacts()
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
      when tg_op = 'INSERT' then 'contact_created'
      when tg_op = 'DELETE' then 'contact_deleted'
      when 'member_id' = any (changed) then 'contact_linked_to_member'
      else 'contact_updated' end,
    p_subject_type => 'contact', p_subject_id => row_now.id,
    p_before => before_j, p_after => after_j,
    p_contact_id => row_now.id
  );

  return null;
end;
$$;

drop trigger if exists beta_go_contacts_lifecycle on public.beta_go_contacts;
create trigger beta_go_contacts_lifecycle
  after insert or update or delete on public.beta_go_contacts
  for each row execute function public.tg_lifecycle_contacts();

-- ---------------------------------------------------------------------------
-- beta_member_interests — the classic-member half of the waitlist
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_interests()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  row_now record := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' then
    return null;
  end if;

  perform public.lifecycle_emit(
    p_event_name => case when tg_op = 'INSERT' then 'interest_created' else 'interest_deleted' end,
    p_subject_type => 'interest', p_subject_id => row_now.id,
    p_event_slug => row_now.event_slug,
    p_before => case when tg_op = 'DELETE' then to_jsonb(old) else null end,
    p_after => case when tg_op = 'INSERT' then to_jsonb(new) else null end,
    p_metadata => jsonb_build_object('intent', row_now.intent),
    p_seat_key => 'classic:' || row_now.id::text
  );

  return null;
end;
$$;

drop trigger if exists beta_member_interests_lifecycle on public.beta_member_interests;
create trigger beta_member_interests_lifecycle
  after insert or delete on public.beta_member_interests
  for each row execute function public.tg_lifecycle_interests();

-- ---------------------------------------------------------------------------
-- listings / transactions — the card-payment path from Phase 1.
--
-- Dormant while the beta runs on Interac, but it is the schema the platform
-- goes back to once Stripe is live, and "every transaction" in DATA_CAPTURE.md
-- § 2 means this one too.
-- ---------------------------------------------------------------------------
create or replace function public.tg_lifecycle_listings()
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
      when tg_op = 'INSERT' then 'listing_created'
      when tg_op = 'DELETE' then 'listing_deleted'
      when (before_j ->> 'removed_at') is null and (after_j ->> 'removed_at') is not null
        then 'listing_removed'
      else 'listing_status_changed' end,
    p_subject_type => 'listing', p_subject_id => row_now.id,
    p_previous_state => case when tg_op = 'INSERT' then null else old.status::text end,
    p_new_state => case when tg_op = 'DELETE' then null else new.status::text end,
    p_before => before_j, p_after => after_j,
    p_amount => row_now.price,
    p_metadata => jsonb_build_object('event_id', row_now.event_id, 'seller_id', row_now.seller_id)
  );

  return null;
end;
$$;

drop trigger if exists listings_lifecycle on public.listings;
create trigger listings_lifecycle
  after insert or update or delete on public.listings
  for each row execute function public.tg_lifecycle_listings();

create or replace function public.tg_lifecycle_transactions()
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
      p_event_name => case when tg_op = 'INSERT' then 'transaction_created'
                          else 'transaction_deleted' end,
      p_subject_type => 'transaction', p_subject_id => row_now.id,
      p_previous_state => case when tg_op = 'DELETE' then old.escrow_status::text else null end,
      p_new_state => case when tg_op = 'DELETE' then null else new.escrow_status::text end,
      p_before => before_j, p_after => after_j, p_amount => row_now.amount,
      p_metadata => jsonb_build_object('listing_id', row_now.listing_id,
                                       'fee_amount', row_now.fee_amount)
    );
    return null;
  end if;

  if old.escrow_status is distinct from new.escrow_status then
    perform public.lifecycle_emit(
      p_event_name => 'transaction_escrow_changed', p_subject_type => 'transaction',
      p_subject_id => new.id,
      p_previous_state => old.escrow_status::text, p_new_state => new.escrow_status::text,
      p_before => before_j, p_after => after_j, p_amount => new.amount,
      p_metadata => jsonb_build_object('released_by', after_j ->> 'released_by')
    );
    emitted := true;
  end if;

  if (before_j ->> 'buyer_confirmed_at') is null
     and (after_j ->> 'buyer_confirmed_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'transaction_buyer_confirmed', p_subject_type => 'transaction',
      p_subject_id => new.id, p_new_state => new.escrow_status::text,
      p_before => before_j, p_after => after_j, p_amount => new.amount,
      p_actor_kind => 'buyer'
    );
    emitted := true;
  end if;

  if (before_j ->> 'dispute_opened_at') is null
     and (after_j ->> 'dispute_opened_at') is not null then
    perform public.lifecycle_emit(
      p_event_name => 'transaction_disputed', p_subject_type => 'transaction',
      p_subject_id => new.id, p_new_state => new.escrow_status::text,
      p_before => before_j, p_after => after_j, p_amount => new.amount
    );
    emitted := true;
  end if;

  if not emitted then
    perform public.lifecycle_emit(
      p_event_name => 'transaction_escrow_changed', p_subject_type => 'transaction',
      p_subject_id => new.id,
      p_previous_state => old.escrow_status::text, p_new_state => new.escrow_status::text,
      p_before => before_j, p_after => after_j, p_amount => new.amount
    );
  end if;

  return null;
end;
$$;

drop trigger if exists transactions_lifecycle on public.transactions;
create trigger transactions_lifecycle
  after insert or update or delete on public.transactions
  for each row execute function public.tg_lifecycle_transactions();

commit;

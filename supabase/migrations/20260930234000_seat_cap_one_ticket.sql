-- A 2-ticket listing allocates each unit on its own. Two of those inserts can
-- run before either commits, and both then read "this seat holds 0 live
-- offers." The seat cap has to wait its turn so a buyer who asked for one
-- ticket cannot be handed both.

create or replace function public.enforce_offer_guards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_status     ticket_unit_status;
  unit_slug       text;
  unit_sell_lead  uuid;
  seller_contact  uuid;
  seller_member   uuid;
  buyer_contact   uuid;
  buyer_member    uuid;
  buyer_slug      text;
  seat_quantity   integer;
  live_count      integer;
begin
  select status, event_slug, sell_lead_id
    into unit_status, unit_slug, unit_sell_lead
    from public.beta_ticket_units where id = new.unit_id;

  if unit_slug is null then
    raise exception 'OFFER_UNIT_NOT_FOUND: unit % does not exist', new.unit_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.event_slug <> unit_slug then
    raise exception 'OFFER_EVENT_MISMATCH: offer slug %, unit slug %', new.event_slug, unit_slug
      using errcode = 'check_violation';
  end if;

  if new.status in ('offered', 'accepted', 'paid', 'needs_review') then
    if unit_status <> 'available'
       and not (unit_status = 'sold' and new.status in ('paid', 'needs_review')) then
      raise exception 'OFFER_UNIT_NOT_AVAILABLE: unit % is %', new.unit_id, unit_status
        using errcode = 'check_violation';
    end if;

    if new.buy_lead_id is not null then
      select quantity, contact_id, member_id, event_slug
        into seat_quantity, buyer_contact, buyer_member, buyer_slug
        from public.beta_go_leads where id = new.buy_lead_id;
    else
      seat_quantity := 1;
      select event_slug into buyer_slug
        from public.beta_member_interests where id = new.classic_interest_id;
    end if;

    if buyer_slug is null then
      raise exception 'OFFER_SEAT_NOT_FOUND: seat % does not exist', new.seat_key
        using errcode = 'foreign_key_violation';
    end if;

    if buyer_slug <> new.event_slug then
      raise exception 'OFFER_SEAT_EVENT_MISMATCH: seat slug %, offer slug %', buyer_slug, new.event_slug
        using errcode = 'check_violation';
    end if;

    -- Serialize live-offer inserts for this seat. The second unit of a pair
    -- then sees the first and stops at the buyer's quantity.
    perform pg_advisory_xact_lock(hashtextextended(new.seat_key, 0));

    select count(*) into live_count
      from public.beta_offers
      where seat_key = new.seat_key
        and status in ('offered', 'accepted', 'paid', 'needs_review')
        and id <> new.id;

    if live_count >= coalesce(seat_quantity, 1) then
      raise exception 'OFFER_SEAT_CAP_EXCEEDED: seat % already holds % live offer(s)', new.seat_key, live_count
        using errcode = 'check_violation';
    end if;

    select contact_id, member_id into seller_contact, seller_member
      from public.beta_go_leads where id = unit_sell_lead;

    if (seller_contact is not null and seller_contact = buyer_contact)
       or (seller_member is not null and seller_member = buyer_member) then
      raise exception 'OFFER_SELF_ALLOCATION: seat % is the seller of unit %', new.seat_key, new.unit_id
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- 20260923090200 — Data capture, part 3 of 6: controlled write paths.
--
-- DATA_CAPTURE.md § 2 "Appropriate access control": anything that changes money
-- or ticket ownership should go through a server function with proper locking,
-- not a client-shaped update — so two buyers can't both win the same ticket,
-- and so every such change carries a real actor instead of "something changed".
--
-- Each function below:
--   1. stamps transaction-local provenance with set_actor_context(), which the
--      part-2 triggers read. `set_config(..., is_local => true)` means the
--      identity lives exactly as long as the transaction, so a pooled
--      connection never carries one caller's identity into the next request —
--      the reason an app-side "set the actor, then update" pair does not work
--      over PostgREST;
--   2. takes `for update` on the row it is about to change, so concurrent ops
--      clicks and cron sweeps serialize instead of interleaving;
--   3. re-checks the state guard *after* taking the lock;
--   4. performs an ordinary UPDATE against the same table the app writes, so
--      every existing BEFORE trigger still fires. `enforce_unit_price_cap`,
--      `enforce_offer_guards` and the Bill 10 price ceiling from 0001/0021 are
--      not bypassed here — an RPC that skipped them would be exactly the extra
--      uncapped write path CLAUDE.md § hard constraints forbids.
--
-- Return shape is uniform: jsonb {ok, id, status, already?, error?}. Guard
-- failures return ok=false rather than raising, because callers surface the
-- message to a human; nothing has been written at that point.

begin;

-- ---------------------------------------------------------------------------
-- Buyer declares the Interac transfer is on its way
-- ---------------------------------------------------------------------------
create or replace function public.declare_offer_payment_sent(
  p_offer_id       uuid,
  p_actor_label    text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  perform public.set_actor_context('buyer', null, p_actor_label, 'app', p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if o.status <> 'accepted' then
    return jsonb_build_object('ok', false, 'error',
      format('Offer is %s, not awaiting payment.', o.status));
  end if;
  if o.buyer_declared_sent_at is not null then
    return jsonb_build_object('ok', true, 'id', p_offer_id, 'already', true,
      'status', o.status);
  end if;

  update public.beta_offers
     set buyer_declared_sent_at = now()
   where id = p_offer_id and status = 'accepted';

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'accepted');
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer claims the offer
--
-- The response clock is enforced here rather than read-then-written by the
-- caller: without the lock, a buyer tapping "claim" at the same moment the
-- reconcile sweep expires the offer could both win — one of them writing over
-- the other. Expiry is materialized in the same transaction that refuses the
-- claim, so the unit is immediately free for the next seat.
--
-- The payment deadline is computed by the caller (policy.ts owns the near-doors
-- rules); this function only stores what it is given.
-- ---------------------------------------------------------------------------
create or replace function public.claim_offer(
  p_offer_id       uuid,
  p_payment_due_at timestamptz default null,
  p_actor_kind     text default 'buyer',
  p_actor_label    text default null,
  p_source         text default 'app',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  perform public.set_actor_context(p_actor_kind, null, p_actor_label, p_source, p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;

  if o.status = 'offered' and o.expires_at <= now() then
    update public.beta_offers
       set status = 'expired_no_response', responded_at = coalesce(responded_at, now())
     where id = p_offer_id;
    return jsonb_build_object('ok', false, 'expired', true, 'error', 'Offer already expired.');
  end if;

  if o.status <> 'offered' then
    return jsonb_build_object('ok', false, 'error', format('Offer is %s.', o.status));
  end if;

  update public.beta_offers
     set status = 'accepted',
         responded_at = now(),
         payment_due_at = p_payment_due_at
   where id = p_offer_id and status = 'offered';

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'accepted');
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer (or ops on their behalf) passes on the offer
--
-- Carries the two lead-side consequences with it, so a decline can't half-apply:
--   price     -> remember the ceiling, so the allocator stops offering above it
--   not_going -> the seat leaves the queue entirely
-- Requeueing the freed unit stays with the caller (allocate_offer takes its own
-- lock and would deadlock against this one).
-- ---------------------------------------------------------------------------
create or replace function public.decline_offer_claim(
  p_offer_id       uuid,
  p_reason         text,
  p_actor_kind     text default 'buyer',
  p_actor_label    text default null,
  p_source         text default 'app',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  if p_reason is null or p_reason not in ('price', 'not_going', 'other') then
    return jsonb_build_object('ok', false, 'error', 'Unknown decline reason.');
  end if;

  perform public.set_actor_context(p_actor_kind, null, p_actor_label, p_source, p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if o.status not in ('offered', 'accepted') then
    return jsonb_build_object('ok', false, 'error', format('Offer is %s.', o.status));
  end if;

  update public.beta_offers
     set status = 'declined', decline_reason = p_reason, responded_at = now()
   where id = p_offer_id and status in ('offered', 'accepted');

  if o.buy_lead_id is not null then
    if p_reason = 'price' then
      update public.beta_go_leads
         set max_price_each = greatest(o.price_each - 0.01, 0), updated_at = now()
       where id = o.buy_lead_id and max_price_each is null;
    elsif p_reason = 'not_going' then
      update public.beta_go_leads
         set status = 'cancelled', updated_at = now()
       where id = o.buy_lead_id and status <> 'cancelled';
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'declined',
                            'unit_id', o.unit_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ops confirms the buyer's money landed
--
-- Also closes the buy lead, which used to be a second round-trip from the app:
-- one transaction now, so a crash between the two can't leave a paid offer
-- attached to an open waitlist seat.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_offer_payment(
  p_offer_id       uuid,
  p_amount         numeric default null,
  p_reference      text default null,
  p_actor_label    text default 'ops',
  p_actor_kind     text default 'ops',
  p_source         text default 'ops_console',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  perform public.set_actor_context(p_actor_kind, null, p_actor_label, p_source, p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if o.status not in ('offered', 'accepted', 'needs_review') then
    return jsonb_build_object('ok', false, 'error', format('Offer is %s.', o.status));
  end if;

  update public.beta_offers
     set status = 'paid',
         responded_at = coalesce(responded_at, now()),
         -- Near doors the buyer pays without ever "accepting" (policy.ts sends
         -- ops straight to mark-paid), so the offer can still be `offered` with
         -- no payment clock. 0021 CHECKs that a paid offer has one, so stamp it
         -- at the moment the money is confirmed; without this the whole
         -- near-doors path dies on beta_offers_payment_due_requires_accept.
         payment_due_at = coalesce(payment_due_at, now()),
         payment_amount = coalesce(p_amount, o.price_each),
         payment_reference = p_reference,
         payment_recorded_at = now(),
         payment_recorded_by = coalesce(p_actor_label, 'ops')
   where id = p_offer_id;

  if o.buy_lead_id is not null then
    update public.beta_go_leads
       set status = 'done', updated_at = now()
     where id = o.buy_lead_id and status <> 'done';
  end if;

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'paid',
                            'amount', coalesce(p_amount, o.price_each));
end;
$$;

-- ---------------------------------------------------------------------------
-- Ops forwards the ticket out of platform custody to the buyer
-- ---------------------------------------------------------------------------
create or replace function public.forward_offer_ticket(
  p_offer_id       uuid,
  p_actor_label    text default 'ops',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  perform public.set_actor_context('ops', null, p_actor_label, 'ops_console', p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if o.status <> 'paid' then
    return jsonb_build_object('ok', false, 'error',
      format('Offer is %s, not paid.', o.status));
  end if;
  if o.ticket_transferred_at is not null then
    return jsonb_build_object('ok', true, 'id', p_offer_id, 'already', true, 'status', o.status);
  end if;

  update public.beta_offers
     set ticket_transferred_at = now()
   where id = p_offer_id and status = 'paid';

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'paid');
end;
$$;

-- ---------------------------------------------------------------------------
-- Ops releases the seller's payout
--
-- Closes the sell lead once every unit under it is off the market, matching
-- what the app did in three round-trips.
-- ---------------------------------------------------------------------------
create or replace function public.release_offer_payout(
  p_offer_id       uuid,
  p_actor_label    text default 'ops',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
  v_sell_lead uuid;
  v_open_units integer;
begin
  perform public.set_actor_context('ops', null, p_actor_label, 'ops_console', p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if o.status <> 'paid' then
    return jsonb_build_object('ok', false, 'error',
      format('Offer is %s, not paid.', o.status));
  end if;
  if o.payout_released_at is not null then
    return jsonb_build_object('ok', true, 'id', p_offer_id, 'already', true, 'status', o.status);
  end if;

  update public.beta_offers
     set payout_released_at = now()
   where id = p_offer_id and status = 'paid';

  select sell_lead_id into v_sell_lead
    from public.beta_ticket_units where id = o.unit_id;

  if v_sell_lead is not null then
    select count(*) into v_open_units
      from public.beta_ticket_units
     where sell_lead_id = v_sell_lead
       and status not in ('sold', 'withdrawn');

    if v_open_units = 0 then
      update public.beta_go_leads
         set status = 'done', updated_at = now()
       where id = v_sell_lead and status <> 'done';
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'paid',
                            'sell_lead_id', v_sell_lead);
end;
$$;

-- ---------------------------------------------------------------------------
-- Seller acknowledges the payout arrived
-- ---------------------------------------------------------------------------
create or replace function public.confirm_offer_payout_received(
  p_offer_id       uuid,
  p_actor_label    text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  o record;
begin
  perform public.set_actor_context('seller', null, p_actor_label, 'app', p_correlation_id);

  select * into o from public.beta_offers where id = p_offer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if o.status <> 'paid' then
    return jsonb_build_object('ok', false, 'error',
      format('Offer is %s, not paid.', o.status));
  end if;
  if o.payout_released_at is null then
    return jsonb_build_object('ok', false, 'error', 'Payout hasn''t been released yet.');
  end if;
  if o.seller_payout_confirmed_at is not null then
    return jsonb_build_object('ok', true, 'id', p_offer_id, 'already', true, 'status', o.status);
  end if;

  update public.beta_offers
     set seller_payout_confirmed_at = now()
   where id = p_offer_id and status = 'paid' and payout_released_at is not null;

  return jsonb_build_object('ok', true, 'id', p_offer_id, 'status', 'paid');
end;
$$;

-- ---------------------------------------------------------------------------
-- Ticket custody, seller -> platform
-- ---------------------------------------------------------------------------
create or replace function public.declare_seller_ticket_sent(
  p_sell_lead_id   uuid,
  p_actor_label    text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
begin
  perform public.set_actor_context('seller', null, p_actor_label, 'app', p_correlation_id);

  select * into l from public.beta_go_leads where id = p_sell_lead_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Listing not found.');
  end if;
  if l.intent <> 'sell' then
    return jsonb_build_object('ok', false, 'error', 'Not a sell listing.');
  end if;
  if l.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'Listing was removed.');
  end if;
  if l.seller_ticket_sent_at is not null then
    return jsonb_build_object('ok', true, 'id', p_sell_lead_id, 'already', true);
  end if;

  update public.beta_go_leads
     set seller_ticket_sent_at = now(), updated_at = now()
   where id = p_sell_lead_id and intent = 'sell';

  return jsonb_build_object('ok', true, 'id', p_sell_lead_id);
end;
$$;

create or replace function public.confirm_ticket_received(
  p_sell_lead_id   uuid,
  p_actor_label    text default 'ops',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
begin
  perform public.set_actor_context('ops', null, p_actor_label, 'ops_console', p_correlation_id);

  select * into l from public.beta_go_leads where id = p_sell_lead_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Listing not found.');
  end if;
  if l.intent <> 'sell' then
    return jsonb_build_object('ok', false, 'error', 'Not a sell listing.');
  end if;
  if l.ticket_received_at is not null then
    return jsonb_build_object('ok', true, 'id', p_sell_lead_id, 'already', true);
  end if;
  if l.seller_ticket_sent_at is null then
    return jsonb_build_object('ok', false, 'error', 'Seller hasn''t confirmed the transfer yet.');
  end if;

  update public.beta_go_leads
     set ticket_received_at = now(),
         ticket_received_by = coalesce(p_actor_label, 'ops'),
         updated_at = now()
   where id = p_sell_lead_id;

  return jsonb_build_object('ok', true, 'id', p_sell_lead_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Off-app records
--
-- The beta is deliberately half-manual: some things happen in a DM, at a door,
-- or over the phone. DATA_CAPTURE.md § 2 asks that those be representable
-- rather than invisible, so ops can attach a first-class lifecycle event to any
-- subject without inventing a status the tables don't have.
-- ---------------------------------------------------------------------------
create or replace function public.record_manual_event(
  p_subject_type   text,
  p_subject_id     uuid,
  p_note           text,
  p_actor_label    text default 'ops',
  p_event_name     text default 'manual_ops_note',
  p_event_slug     text default null,
  p_amount         numeric default null,
  p_metadata       jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_subject_type not in ('ticket_unit','offer','sell_lead','buy_lead','lead','contact',
                            'member','deal','interest','listing','transaction','event') then
    return jsonb_build_object('ok', false, 'error', 'Unknown subject type.');
  end if;
  if coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'A note is required.');
  end if;

  perform public.set_actor_context('ops', null, p_actor_label, 'manual', p_correlation_id);

  v_id := public.lifecycle_emit(
    p_event_name   => p_event_name,
    p_subject_type => p_subject_type,
    p_subject_id   => p_subject_id,
    p_event_slug   => p_event_slug,
    p_amount       => p_amount,
    p_metadata     => coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('note', p_note),
    p_unit_id      => case when p_subject_type = 'ticket_unit' then p_subject_id end,
    p_offer_id     => case when p_subject_type = 'offer' then p_subject_id end,
    p_sell_lead_id => case when p_subject_type = 'sell_lead' then p_subject_id end,
    p_buy_lead_id  => case when p_subject_type = 'buy_lead' then p_subject_id end,
    p_contact_id   => case when p_subject_type = 'contact' then p_subject_id end
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Service role only — same posture as allocate_offer / reconcile_expired_offers
-- in 0021. These functions move money and ticket ownership; no browser role
-- gets to call them directly.
-- ---------------------------------------------------------------------------
revoke all on function public.set_actor_context(text, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.lifecycle_emit(text, text, uuid, text, text, text, jsonb, jsonb, numeric, jsonb, uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.declare_offer_payment_sent(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_offer(uuid, timestamptz, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.decline_offer_claim(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.confirm_offer_payment(uuid, numeric, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.forward_offer_ticket(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_offer_payout(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.confirm_offer_payout_received(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.declare_seller_ticket_sent(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.confirm_ticket_received(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.record_manual_event(text, uuid, text, text, text, text, numeric, jsonb, uuid) from public, anon, authenticated;

-- The service-role client is the only caller (server actions and cron routes).
grant execute on function public.set_actor_context(text, uuid, text, text, uuid) to service_role;
grant execute on function public.lifecycle_emit(text, text, uuid, text, text, text, jsonb, jsonb, numeric, jsonb, uuid, uuid, uuid, uuid, uuid, text, text, timestamptz, text, text, text) to service_role;
grant execute on function public.declare_offer_payment_sent(uuid, text, uuid) to service_role;
grant execute on function public.claim_offer(uuid, timestamptz, text, text, text, uuid) to service_role;
grant execute on function public.decline_offer_claim(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.confirm_offer_payment(uuid, numeric, text, text, text, text, uuid) to service_role;
grant execute on function public.forward_offer_ticket(uuid, text, uuid) to service_role;
grant execute on function public.release_offer_payout(uuid, text, uuid) to service_role;
grant execute on function public.confirm_offer_payout_received(uuid, text, uuid) to service_role;
grant execute on function public.declare_seller_ticket_sent(uuid, text, uuid) to service_role;
grant execute on function public.confirm_ticket_received(uuid, text, uuid) to service_role;
grant execute on function public.record_manual_event(text, uuid, text, text, text, text, numeric, jsonb, uuid) to service_role;

commit;

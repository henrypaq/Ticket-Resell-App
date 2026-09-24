-- 20260924090300 — Data capture: backfill for the paths added above.
--
-- Same rules as 20260923090500: reconstructed from the columns that survive,
-- stamped source='backfill', and guarded so re-running adds nothing.

begin;

-- Fixed-price money -------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, buy_lead_id, contact_id,
  new_state, amount, actor_kind, source, metadata, occurred_at
)
select 'buyer_payment_declared', 'buy_lead', l.id, l.event_slug, l.id, l.contact_id,
       l.status, l.payment_amount, 'buyer', 'backfill',
       jsonb_build_object('backfilled', true, 'path', 'fixed_price', 'quantity', l.quantity),
       l.buyer_declared_sent_at
from public.beta_go_leads l
where l.intent = 'buy'
  and l.buyer_declared_sent_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.buy_lead_id = l.id and e.event_name = 'buyer_payment_declared'
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, buy_lead_id, contact_id,
  new_state, amount, actor_kind, actor_label, source, metadata, occurred_at
)
select 'buyer_payment_confirmed', 'buy_lead', l.id, l.event_slug, l.id, l.contact_id,
       l.status, l.payment_amount, 'ops', l.payment_recorded_by, 'backfill',
       jsonb_build_object('backfilled', true, 'path', 'fixed_price', 'quantity', l.quantity),
       l.payment_recorded_at
from public.beta_go_leads l
where l.intent = 'buy'
  and l.payment_recorded_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.buy_lead_id = l.id and e.event_name = 'buyer_payment_confirmed'
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, event_slug, buy_lead_id, contact_id,
  new_state, amount, actor_kind, source, metadata, occurred_at
)
select 'ticket_forwarded_to_buyer', 'buy_lead', l.id, l.event_slug, l.id, l.contact_id,
       l.status, l.payment_amount, 'ops', 'backfill',
       jsonb_build_object('backfilled', true, 'path', 'fixed_price'),
       l.ticket_forwarded_at
from public.beta_go_leads l
where l.intent = 'buy'
  and l.ticket_forwarded_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.buy_lead_id = l.id and e.event_name = 'ticket_forwarded_to_buyer'
  );

-- Governance ---------------------------------------------------------------
insert into public.lifecycle_events (
  event_name, subject_type, subject_id, amount, actor_kind, source, metadata, occurred_at
)
select 'event_authorization_created', 'event_authorization', a.id, a.max_resale_price,
       'admin', 'backfill',
       jsonb_build_object('backfilled', true, 'event_id', a.event_id), a.authorized_at
from public.event_authorizations a
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'event_authorization_created' and e.subject_id = a.id
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_key, actor_kind, source, metadata, occurred_at
)
select 'admin_allowlisted', 'admin_allowlist', a.email, 'admin', 'backfill',
       jsonb_build_object('backfilled', true, 'note', a.note), a.created_at
from public.admin_allowlist a
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'admin_allowlisted' and e.subject_key = a.email
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, new_state, actor_kind, source, metadata, occurred_at
)
select 'admin_granted', 'profile', p.id, 'true', 'admin', 'backfill',
       jsonb_build_object('backfilled', true), p.created_at
from public.profiles p
where p.is_admin
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'admin_granted' and e.subject_id = p.id
  );

insert into public.lifecycle_events (
  event_name, subject_type, subject_key, event_slug, amount, actor_kind, actor_label,
  source, metadata, occurred_at
)
select 'catalog_event_created', 'catalog_event', c.slug, c.slug,
       (to_jsonb(c) ->> 'fixed_price_each')::numeric, 'ops', c.created_by, 'backfill',
       jsonb_build_object('backfilled', true, 'supported', c.supported), c.created_at
from public.beta_event_catalog c
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'catalog_event_created' and e.subject_key = c.slug
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_id, actor_kind, source, metadata, occurred_at
)
select 'member_created', 'member', m.id, 'buyer', 'backfill',
       jsonb_build_object('backfilled', true, 'intent', m.intent,
                          'acquisition_channel', m.acquisition_channel),
       m.created_at
from public.beta_members m
where not exists (
  select 1 from public.lifecycle_events e
   where e.event_name = 'member_created' and e.subject_id = m.id
);

insert into public.lifecycle_events (
  event_name, subject_type, subject_key, event_slug, seat_key, actor_kind, source,
  metadata, occurred_at
)
select 'seat_went_dormant', 'seat', s.seat_key, s.event_slug, s.seat_key, 'system', 'backfill',
       jsonb_build_object('backfilled', true), s.dormant_at
from public.beta_queue_seat_state s
where s.dormant_at is not null
  and not exists (
    select 1 from public.lifecycle_events e
     where e.event_name = 'seat_went_dormant' and e.subject_key = s.seat_key
  );

commit;

-- 0025 — Clear seeded fake-front padding. Ops can still set values in /ops/waitlist.

begin;

update public.beta_queue_config
  set fake_front = 0,
      updated_at = now()
  where fake_front <> 0;

commit;

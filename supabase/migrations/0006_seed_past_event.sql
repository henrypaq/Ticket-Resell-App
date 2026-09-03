-- A single already-happened event, so the Tickets page's "Past" filter has a
-- real row to show instead of only ever being reachable in an empty state.
-- Every other seeded event is deliberately future-dated (0002_seed_events.sql
-- uses now() + interval), so nothing else in the catalog can ever land here.
insert into public.events
  (name, venue, city, starts_at, source_platform, original_price, verification_tier,
   flyer_url, tags, is_sold_out, status, price_source, organizer_id, description)
select
  'Datcha Late: Rotation — Season Closer', 'Datcha', 'Montreal',
  now() - interval '10 days', 'manual', 15.00, 'B',
  '/flyers/datcha.svg', array['Techno','Minimal'], false, 'resale_enabled', 'platform_parsed',
  o.id,
  'Last rotation of the season before Datcha''s winter booking pause.'
from public.organizers o
where o.handle = 'datcha.mtl'
  and not exists (
    select 1 from public.events e where e.name = 'Datcha Late: Rotation — Season Closer'
  );

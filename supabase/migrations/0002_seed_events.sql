-- 0002_seed_events.sql — admin-curated Montreal event list.
--
-- CLAUDE_1 Phase 1 keeps the fraud surface small by curating events rather than
-- letting users create them, so the "admin flow" at this stage is this file.
-- Dates are relative to apply time so the feed is always populated in dev.

begin;

-- Keyed by name, not a unique constraint: two genuinely distinct future events
-- could share a name, and the schema shouldn't forbid that. This guard only
-- needs to stop *this seed list* from re-inserting itself, e.g. if this
-- migration is ever re-applied outside the CLI's own tracking table.
insert into public.events
  (name, venue, city, starts_at, source_platform, original_price, verification_tier, flyer_url, tags, is_sold_out)
select v.name, v.venue, v.city, v.starts_at, v.source_platform, v.original_price, v.verification_tier,
       v.flyer_url, v.tags, v.is_sold_out
from (values
  ('Sous-Sol: Opening Season',        'Stereo',              'Montreal', now() + interval '2 days'  + interval '23 hours', 'dice',       32.00, 'A', '/flyers/sous-sol.svg',   array['Techno','House'],              true),
  ('Newspeak Presents: Ateliers',     'Newspeak',            'Montreal', now() + interval '4 days'  + interval '22 hours', 'showpass',   24.50, 'A', '/flyers/ateliers.svg',   array['Nu-Disco','Dance','Live'],     false),
  ('Piknic Électronik — Closing',     'Parc Jean-Drapeau',   'Montreal', now() + interval '6 days'  + interval '14 hours', 'eventbrite', 45.00, 'A', '/flyers/piknic.svg',     array['House','Open Air','Techno'],   true),
  ('Ritz Basement: Shatta Night',     'Bar Le Ritz PDB',     'Montreal', now() + interval '9 days'  + interval '23 hours', 'manual',     18.00, 'B', '/flyers/ritz.svg',       array['Shatta','Reggaeton','Hip Hop'], false),
  ('SAT — Audiovisual Session',       'Société des arts technologiques', 'Montreal', now() + interval '12 days' + interval '21 hours', 'tixr', 38.00, 'A', '/flyers/sat.svg',   array['Ambient','AV','Experimental'], false),
  ('Datcha Late: Rotation',           'Datcha',              'Montreal', now() + interval '15 days' + interval '23 hours', 'manual',     15.00, 'B', '/flyers/datcha.svg',     array['Techno','Minimal'],            true),
  ('Le Belmont: Rap FR Night',        'Le Belmont',          'Montreal', now() + interval '18 days' + interval '22 hours', 'showpass',   27.50, 'A', '/flyers/belmont.svg',    array['Rap FR','Club','Pop'],         false),
  ('MTelus: Warehouse Series',        'MTelus',              'Montreal', now() + interval '23 days' + interval '21 hours', 'eventbrite', 55.00, 'A', '/flyers/mtelus.svg',     array['Techno','Warehouse'],          true)
) as v(name, venue, city, starts_at, source_platform, original_price, verification_tier, flyer_url, tags, is_sold_out)
where not exists (select 1 from public.events e where e.name = v.name);

commit;

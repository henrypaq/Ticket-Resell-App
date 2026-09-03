-- 0005 — Backfills organizer, description, and lineup for the events seeded
-- in 0002, so the fuller event detail page has real content to render
-- against rather than empty sections.

begin;

insert into public.organizers (name, handle, bio) values
  ('Sous-Sol Collective', 'sous.sol', 'Underground techno and house nights, running Stereo''s late slot since 2019.'),
  ('Newspeak', 'newspeak.mtl', 'A listening room and stage for touring live acts passing through Montreal.'),
  ('Piknic Électronik', 'piknicelectronik', 'Outdoor electronic music at Parc Jean-Drapeau, running every season since 2003.'),
  ('Bar Le Ritz PDB', 'leritzpdb', 'Basement venue on the Main booking club nights and DIY shows.'),
  ('SAT', 'sat_mtl', 'Société des arts technologiques — audiovisual performance and immersive sound.'),
  ('Datcha Presents', 'datcha.mtl', 'Late-night rotation of local and touring techno and minimal DJs.'),
  ('Le Belmont', 'lebelmont', 'Club nights spanning rap, club, and pop on the Main.'),
  ('MTelus Warehouse Series', 'mtelus', 'MTelus''s recurring warehouse-format techno series.')
on conflict (handle) do nothing;

update public.events e set
  organizer_id = o.id,
  description = d.description,
  lineup = d.lineup
from (
  values
    ('Sous-Sol: Opening Season', 'sous.sol',
     'Season opener for Sous-Sol''s Friday residency at Stereo. Full-strength sound system, no phones on the floor, doors close once the room hits capacity.',
     '[{"name":"Marie Devine","role":"Headliner"},{"name":"Ombre","role":"Support"},{"name":"Kaï Rousseau","role":"Opening"}]'::jsonb),
    ('Newspeak Presents: Ateliers', 'newspeak.mtl',
     'A live-instrumentation night — nu-disco and dance built around a full band setup rather than a laptop, in Newspeak''s standing room.',
     '[{"name":"Ateliers Live Band"},{"name":"DJ Fontaine","role":"Support"}]'::jsonb),
    ('Piknic Électronik — Closing', 'piknicelectronik',
     'The last Piknic of the season on the Jean-Drapeau terrace — open-air house and techno from early afternoon into the evening.',
     '[{"name":"Anz","role":"Headliner"},{"name":"Call Super","role":"Headliner"},{"name":"DJ Fart in the Club"}]'::jsonb),
    ('Ritz Basement: Shatta Night', 'leritzpdb',
     'A basement-level shatta and reggaeton night — low ceiling, loud system, small room.',
     '[{"name":"DJ Anelka","role":"Headliner"},{"name":"Selecta Bwoy"}]'::jsonb),
    ('SAT — Audiovisual Session', 'sat_mtl',
     'A seated audiovisual set in the SATosphere dome — ambient and experimental sound paired with a full-dome visual system.',
     '[{"name":"Félicité Lemoine","role":"Sound"},{"name":"Studio Nord","role":"Visuals"}]'::jsonb),
    ('Datcha Late: Rotation', 'datcha.mtl',
     'Datcha''s late rotation slot — back-to-back minimal and techno sets running past close.',
     '[{"name":"Iris Nakamura"},{"name":"Theo Voss"}]'::jsonb),
    ('Le Belmont: Rap FR Night', 'lebelmont',
     'French rap and club night on Le Belmont''s main floor, with a pop room upstairs.',
     '[{"name":"DJ Poste 7","role":"Headliner"},{"name":"MC Solène"}]'::jsonb),
    ('MTelus: Warehouse Series', 'mtelus',
     'MTelus stripped down to a warehouse setup for one night — a longer-format techno set on the full room system.',
     '[{"name":"Head High","role":"Headliner"},{"name":"Local Support TBA"}]'::jsonb)
) as d(event_name, handle, description, lineup)
join public.organizers o on o.handle = d.handle
where e.name = d.event_name;

commit;

-- 0007 — Phase 2: tiered verification + automated release trigger.
-- Spec refs: CLAUDE.md § Phase 2, SECURITY.md (duplicate detection, file
-- upload validation, signed single-use codes), ARCHITECTURE.md (DB-level
-- enforcement, idempotent background work).
--
-- Two features land here:
--   * Tier B ticket evidence at listing time (barcode/ticket-ID + optional
--     photo) with duplicate-listing detection physically enforced, mirroring
--     how 0001's price cap and 0003's resale-enabled gate are enforced.
--   * The automated release trigger for Tier B (buyer-confirms-entry, or an
--     unattended timeout) and a dispute path, alongside the Phase 1 manual
--     admin release/refund, which stays as the fallback for both tiers.
--
-- Tier A (official transfer-API integration) has no schema footprint here —
-- there is no partner API access yet, so it is a fail-closed provider
-- interface in application code only (src/lib/verification). See
-- docs/adr/0003-phase2-tier-a-fail-closed-and-auto-release-cron.md.

begin;

-- ---------------------------------------------------------------------------
-- Tier B ticket evidence on listings.
--
-- ticket_barcode_hash stores a sha256 hex digest of the normalized barcode /
-- ticket ID, never the raw value (SECURITY.md: don't hold a scannable ticket
-- credential at rest any more than the duplicate check needs). ticket_evidence_path
-- points into the private ticket-evidence storage bucket below; nullable
-- because the photo is optional evidence, the barcode hash is not.
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists ticket_barcode_hash text;
alter table public.listings add column if not exists ticket_evidence_path text;
alter table public.listings add column if not exists ticket_evidence_uploaded_at timestamptz;

-- "Has this exact barcode/ticket ID been listed before?" (CLAUDE.md § Phase 2),
-- enforced as a security control, not a soft flag (SECURITY.md § duplicate
-- detection): only one *live* listing may exist per barcode fingerprint at a
-- time. A listing that was cancelled/refunded/removed drops out of the index,
-- so a legitimate re-list after a refund is not blocked.
create unique index if not exists listings_ticket_barcode_hash_live_idx
  on public.listings (ticket_barcode_hash)
  where ticket_barcode_hash is not null
    and removed_at is null
    and status in ('active', 'reserved', 'sold');

-- ---------------------------------------------------------------------------
-- Automated release trigger + dispute path on transactions.
--
-- buyer_confirmed_at: the Tier B release signal ("buyer confirms entry" per
-- CLAUDE.md § Phase 2). Recorded independently of whether the Transfer itself
-- succeeds (e.g. the seller has no payout account yet), so a retry doesn't
-- require the buyer to reconfirm.
-- dispute_*: the alternative to confirming — routes the transaction to
-- escrow_status = 'disputed' (already modeled in 0001) for manual admin
-- resolution, same release/refund actions as Phase 1, just from a different
-- starting state.
-- ---------------------------------------------------------------------------
alter table public.transactions add column if not exists buyer_confirmed_at timestamptz;
alter table public.transactions add column if not exists dispute_reason text;
alter table public.transactions add column if not exists dispute_opened_at timestamptz;

create index if not exists transactions_buyer_confirmed_idx
  on public.transactions (buyer_confirmed_at) where buyer_confirmed_at is not null;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for Tier B ticket evidence photos/PDFs.
--
-- Uploads are validated server-side (type sniffed by magic bytes, size capped)
-- before they ever reach storage — see src/lib/verification/ticket-evidence.ts
-- — and written with the service role, so these policies only need to cover
-- *reads*: a seller can read their own evidence back, an admin can read any of
-- it (needed to resolve a dispute). No public/anon access at all.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-evidence', 'ticket-evidence', false, 8388608, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Objects are stored at `<seller_id>/<listing_id>/<filename>` — the path
-- prefix is what these policies key off.
--
-- storage.objects is owned by supabase_storage_admin, not the role migrations
-- normally run as. Applying this via the Supabase dashboard's SQL editor (as
-- documented in README § Database) has the right privileges; running it
-- through a plain psql connection might not. Verify after applying:
--   select policyname from pg_policies where tablename = 'objects';
-- should list both ticket_evidence_read_own and ticket_evidence_read_admin. If
-- it doesn't, evidence photos are stored but unreadable by anyone until this
-- section is re-applied with sufficient privileges.
drop policy if exists ticket_evidence_read_own on storage.objects;
create policy ticket_evidence_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists ticket_evidence_read_admin on storage.objects;
create policy ticket_evidence_read_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-evidence' and public.is_admin());

-- No insert/update/delete policy for any client role: every write goes
-- through the service role after server-side validation.

commit;

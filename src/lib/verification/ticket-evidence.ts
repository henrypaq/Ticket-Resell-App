import { createHash } from "node:crypto";

/**
 * Tier B ticket evidence: barcode/ticket-ID fingerprinting for duplicate
 * detection, and server-side validation for the optional photo/PDF upload.
 * Pure functions — no Supabase/storage IO here — so they're unit testable and
 * reusable from both the create-listing service and, later, any admin
 * re-verification tooling.
 */

/**
 * Normalizes a barcode/ticket-ID before hashing so trivial formatting
 * differences (whitespace, case, dashes some scanners insert) don't produce
 * two different fingerprints for the same physical ticket.
 */
export function normalizeBarcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/**
 * SHA-256 of the normalized barcode. We store this, never the raw value
 * (SECURITY.md) — it's enough to detect an exact repeat listing without
 * holding a scannable ticket credential at rest.
 */
export function hashBarcode(raw: string): string {
  return createHash("sha256").update(normalizeBarcode(raw)).digest("hex");
}

export const MAX_TICKET_EVIDENCE_BYTES = 8 * 1024 * 1024; // matches the storage bucket's file_size_limit

const SIGNATURES: { mime: string; ext: string; bytes: number[] }[] = [
  { mime: "image/jpeg", ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "application/pdf", ext: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
];

export type EvidenceValidationResult =
  | { ok: true; mime: string; ext: string }
  | { ok: false; message: string };

/**
 * Validates a ticket-evidence upload by sniffing its actual bytes rather than
 * trusting the client-reported MIME type (SECURITY.md § file uploads: "don't
 * trust client-reported MIME types"). Malware scanning is not implemented —
 * see README § known gaps; this is type/size validation only.
 */
export function validateTicketEvidenceFile(bytes: Uint8Array): EvidenceValidationResult {
  if (bytes.byteLength === 0) {
    return { ok: false, message: "The file is empty." };
  }
  if (bytes.byteLength > MAX_TICKET_EVIDENCE_BYTES) {
    return { ok: false, message: "That file is too large — 8MB max." };
  }

  const match = SIGNATURES.find((sig) => sig.bytes.every((b, i) => bytes[i] === b));
  if (!match) {
    return { ok: false, message: "Upload a JPEG, PNG, or PDF of your ticket." };
  }

  return { ok: true, mime: match.mime, ext: match.ext };
}

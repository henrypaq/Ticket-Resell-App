import { describe, expect, it } from "vitest";
import { hashBarcode, normalizeBarcode, validateTicketEvidenceFile } from "./ticket-evidence";

// SECURITY.md: duplicate-listing detection is a security control, so the
// fingerprint has to be stable across trivial formatting differences and
// never leak the raw barcode.

describe("barcode normalization + hashing", () => {
  it("treats whitespace/dash/case variants as the same ticket", () => {
    expect(normalizeBarcode(" abc-123 456 ")).toBe("ABC123456");
    expect(hashBarcode("abc-123-456")).toBe(hashBarcode(" ABC 123456 "));
  });

  it("treats genuinely different barcodes as different fingerprints", () => {
    expect(hashBarcode("ABC123456")).not.toBe(hashBarcode("ABC123457"));
  });

  it("never returns the raw value", () => {
    expect(hashBarcode("ABC123456")).not.toContain("ABC123456");
    expect(hashBarcode("ABC123456")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ticket evidence file validation", () => {
  it("accepts a real JPEG signature", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const r = validateTicketEvidenceFile(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mime).toBe("image/jpeg");
  });

  it("accepts a real PNG signature", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(validateTicketEvidenceFile(bytes).ok).toBe(true);
  });

  it("accepts a real PDF signature", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 rest of file...");
    expect(validateTicketEvidenceFile(bytes).ok).toBe(true);
  });

  it("REJECTS a file whose content doesn't match its claimed type — a renamed .exe, say", () => {
    const bytes = new TextEncoder().encode("MZ this is not actually an image");
    const r = validateTicketEvidenceFile(bytes);
    expect(r.ok).toBe(false);
  });

  it("REJECTS an empty file", () => {
    expect(validateTicketEvidenceFile(new Uint8Array()).ok).toBe(false);
  });

  it("REJECTS a file over the size limit", () => {
    const big = new Uint8Array(8 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateTicketEvidenceFile(big).ok).toBe(false);
  });
});

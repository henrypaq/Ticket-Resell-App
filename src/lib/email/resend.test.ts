import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// env.ts validates Supabase settings at import; this test only needs Resend's.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test";
});

import { sendEmail } from "@/lib/email/resend";

const OPS_FROM = "mcgill.tickets ops <alerts@ops.mcgilltickets.party>";
const MAIN_FROM = "mcgill.tickets <hello@mcgilltickets.party>";

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const unverified = {
  statusCode: 403,
  message:
    "The ops.mcgilltickets.party domain is not verified. Please, add and verify your domain on https://resend.com/domains",
  name: "validation_error",
};

describe("sendEmail sender fallback", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = MAIN_FROM;
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sentFrom = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body).from;
  const mail = { to: "ops@example.test", subject: "s", text: "t", html: "<p>t</p>" };

  it("resends from the main address while the custom sender's domain is unverified", async () => {
    fetchMock.mockResolvedValueOnce(reply(403, unverified)).mockResolvedValueOnce(reply(200, { id: "e1" }));
    const result = await sendEmail({ ...mail, from: OPS_FROM });
    expect(result).toEqual({ ok: true, id: "e1" });
    expect(sentFrom(0)).toBe(OPS_FROM);
    expect(sentFrom(1)).toBe(MAIN_FROM);
  });

  it("uses the custom sender once it's verified", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: "e2" }));
    await sendEmail({ ...mail, from: OPS_FROM });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentFrom(0)).toBe(OPS_FROM);
  });

  it("doesn't retry other failures", async () => {
    fetchMock.mockResolvedValueOnce(reply(422, { message: "Invalid `to` field.", name: "validation_error" }));
    const result = await sendEmail({ ...mail, from: OPS_FROM });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("defaults to the main sender", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: "e3" }));
    await sendEmail(mail);
    expect(sentFrom(0)).toBe(MAIN_FROM);
  });
});

#!/usr/bin/env node
/**
 * Seeds the demo account (ENABLE_DEMO_LOGIN / DEMO_LOGIN_EMAIL) with a small
 * social graph — a handful of fake friend accounts, follows, "I'm going"
 * attendance, and one listing/purchase pair — so the Phase 3 UI (home feed,
 * profile, event pages) has something real to show instead of an empty
 * state when you sign in as the demo user.
 *
 * Deliberately scoped to the demo account only: every row this creates is
 * anchored to DEMO_LOGIN_EMAIL's user id as the follower/buyer, or to the
 * fake friend accounts it creates. A real signup never follows anyone or has
 * any attendance/listings by default — this script doesn't touch that path
 * at all, it only adds rows, and only ones reachable from the demo account.
 *
 * Idempotent: safe to re-run. Uses upserts / existence checks throughout.
 *
 * Usage: node scripts/seed-demo-social.mjs
 * Needs SUPABASE_PROJECT_URL and SUPABASE_PROJECT_KEY from .env.local (the
 * service-role key — this bypasses RLS on purpose, the same way any other
 * admin-client seed script does).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const text = readFileSync(path.join(repoRoot, ".env.local"), "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = loadEnv();
const DEMO_EMAIL = env.DEMO_LOGIN_EMAIL || "demo@passe.local";
const SERVICE_FEE_CAD = 2.49;
const SERVICE_FEE_LABEL = "Service fee";
const DISCLOSURE_VERSION = "2026-09-03.1";

const admin = createClient(env.SUPABASE_PROJECT_URL, env.SUPABASE_PROJECT_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getOrCreateUser(email, displayName) {
  const { data: existing } = await admin.from("profiles").select("id, display_name, handle").eq("email", email).maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);

  // handle_new_user runs on the auth.users insert trigger; give it a beat.
  await new Promise((r) => setTimeout(r, 400));
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, display_name, handle")
    .eq("id", data.user.id)
    .single();
  if (profileError) throw new Error(`profile lookup (${email}): ${profileError.message}`);
  return profile;
}

function buildDisclosureSnapshot(event, listingPrice) {
  return {
    version: DISCLOSURE_VERSION,
    generatedAt: new Date().toISOString(),
    isResale: true,
    listingType: "resale",
    event: {
      id: event.id,
      name: event.name,
      venue: event.venue,
      city: event.city,
      startsAt: event.starts_at,
      sourcePlatform: event.source_platform,
    },
    originalTicketPrice: Number(event.original_price),
    priceCap: Number(event.original_price),
    priceCapSource: "face_value",
    fees: {
      ticketPrice: listingPrice,
      serviceFee: SERVICE_FEE_CAD,
      serviceFeeLabel: SERVICE_FEE_LABEL,
      total: Math.round((listingPrice + SERVICE_FEE_CAD + Number.EPSILON) * 100) / 100,
    },
    verification: {
      tier: event.verification_tier,
      method: "seller_attestation",
      note: "Seed data for the demo account.",
    },
  };
}

async function main() {
  console.log(`Demo account: ${DEMO_EMAIL}`);
  const demo = await getOrCreateUser(DEMO_EMAIL, "Demo");
  console.log(`  id=${demo.id} handle=${demo.handle}`);

  const friends = await Promise.all(
    [
      ["priya.seed@passe.local", "Priya Sharma"],
      ["marc.seed@passe.local", "Marc-Antoine Roy"],
      ["elo.seed@passe.local", "Élo Bergeron"],
      ["sam.seed@passe.local", "Sam Okafor"],
    ].map(([email, name]) => getOrCreateUser(email, name)),
  );
  console.log(
    "Friends:",
    friends.map((f) => `${f.display_name} (@${f.handle})`).join(", "),
  );

  // Follows: demo -> every seeded friend.
  const followRows = friends.map((f) => ({ follower_id: demo.id, followee_id: f.id }));
  const { error: followError } = await admin
    .from("follows")
    .upsert(followRows, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (followError) throw new Error(`follows upsert: ${followError.message}`);
  console.log(`Follows: demo -> ${friends.length} friends`);

  const { data: events, error: eventsError } = await admin
    .from("events")
    .select("id, name, venue, city, starts_at, source_platform, original_price, verification_tier")
    .eq("status", "resale_enabled")
    .order("starts_at", { ascending: true });
  if (eventsError) throw new Error(`events query: ${eventsError.message}`);
  if (events.length < 3) throw new Error("Need at least 3 resale_enabled events to seed against — apply 0002/0004/0006 first.");

  // Attendance: spread friends (+ demo, for one event) across a few events so
  // the "friends going" row on an event page and the home feed both have
  // something to show, rather than everyone piling onto event #1.
  const attendanceRows = [
    { user_id: friends[0].id, event_id: events[0].id },
    { user_id: friends[1].id, event_id: events[0].id },
    { user_id: friends[1].id, event_id: events[1].id },
    { user_id: friends[2].id, event_id: events[2].id },
    { user_id: friends[3].id, event_id: events[2].id },
    { user_id: demo.id, event_id: events[1].id },
  ].map((r) => ({ ...r, visibility: "followers" }));

  const { error: attendanceError } = await admin
    .from("attendance_confirmations")
    .upsert(attendanceRows, { onConflict: "user_id,event_id", ignoreDuplicates: true });
  if (attendanceError) throw new Error(`attendance upsert: ${attendanceError.message}`);
  console.log(`Attendance: ${attendanceRows.length} confirmations across ${new Set(attendanceRows.map((r) => r.event_id)).size} events`);

  // One listing + purchase: a friend sells a ticket to a later event, demo
  // buys it (escrow released) — populates /tickets "buying" with a real row.
  const sellEvent = events[3] ?? events[events.length - 1];
  const sellPrice = Math.round(Number(sellEvent.original_price) * 0.85 * 100) / 100;

  let { data: existingListing } = await admin
    .from("listings")
    .select("id, status")
    .eq("event_id", sellEvent.id)
    .eq("seller_id", friends[0].id)
    .maybeSingle();

  let soldListing = existingListing;
  if (!soldListing) {
    const { data: inserted, error: insertError } = await admin
      .from("listings")
      .insert({
        event_id: sellEvent.id,
        seller_id: friends[0].id,
        price: sellPrice,
        status: "sold",
        disclosure_snapshot: buildDisclosureSnapshot(sellEvent, sellPrice),
        ticket_barcode_hash:
          sellEvent.verification_tier === "B" ? createHash("sha256").update(`seed-${sellEvent.id}`).digest("hex") : null,
      })
      .select("id, status")
      .single();
    if (insertError) throw new Error(`seed listing insert: ${insertError.message}`);
    soldListing = inserted;
  }

  const { data: existingTx } = await admin
    .from("transactions")
    .select("id")
    .eq("listing_id", soldListing.id)
    .eq("buyer_id", demo.id)
    .maybeSingle();

  if (!existingTx) {
    const { error: txError } = await admin.from("transactions").insert({
      listing_id: soldListing.id,
      buyer_id: demo.id,
      amount: sellPrice,
      fee_amount: SERVICE_FEE_CAD,
      escrow_status: "released",
      verification_status: "released_by_admin",
      stripe_payment_intent_id: `seed_pi_${soldListing.id}`,
      released_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      admin_note: "Seed data for the demo account.",
    });
    if (txError) throw new Error(`seed transaction insert: ${txError.message}`);
  }
  console.log(`Purchase: demo bought "${sellEvent.name}" from ${friends[0].display_name} (${soldListing.status})`);

  // A second listing, this one posted BY the demo account and still active —
  // populates /tickets "selling" and shows up under that event's page.
  const listEvent = events[1];
  const listPrice = Math.round(Number(listEvent.original_price) * 0.75 * 100) / 100;

  const { data: existingDemoListing } = await admin
    .from("listings")
    .select("id")
    .eq("event_id", listEvent.id)
    .eq("seller_id", demo.id)
    .maybeSingle();

  if (!existingDemoListing) {
    const { error: demoListingError } = await admin.from("listings").insert({
      event_id: listEvent.id,
      seller_id: demo.id,
      price: listPrice,
      status: "active",
      disclosure_snapshot: buildDisclosureSnapshot(listEvent, listPrice),
      ticket_barcode_hash:
        listEvent.verification_tier === "B" ? createHash("sha256").update(`seed-demo-${listEvent.id}`).digest("hex") : null,
    });
    if (demoListingError) throw new Error(`demo listing insert: ${demoListingError.message}`);
  }
  console.log(`Listing: demo is selling a ticket to "${listEvent.name}"`);

  console.log("\nDone. Sign in as the demo account to see it.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

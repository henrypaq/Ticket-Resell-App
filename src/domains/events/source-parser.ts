import "server-only";

/**
 * Best-effort extraction of event details from a public ticketing page.
 *
 * CLAUDE.md § Phase 1 sanctions this explicitly: most platforms embed
 * schema.org or Open Graph data in the page HTML, and Eventbrite shut down its
 * general public Search API in 2020, so there is usually no clean documented
 * endpoint to read instead.
 *
 * ARCHITECTURE.md warns against *depending* on fragile scraping, so this is
 * strictly an autofill convenience: it never blocks a submission, every field
 * it returns is editable by the submitter, and an admin re-verifies the price
 * before the event is ever resale_enabled. When parsing fails the manual form
 * carries the request instead, with the link stored either way.
 */

export type ParsedEvent = {
  name?: string;
  venue?: string;
  startsAt?: string;
  originalPrice?: number;
  sourcePlatform: SourcePlatform;
  parsed: boolean;
  note: string;
};

export type SourcePlatform = "eventbrite" | "showpass" | "tixr" | "dice" | "manual";

const PLATFORM_HOSTS: [RegExp, SourcePlatform][] = [
  [/eventbrite\./i, "eventbrite"],
  [/showpass\./i, "showpass"],
  [/tixr\./i, "tixr"],
  [/dice\.fm/i, "dice"],
];

export function platformFromUrl(url: string): SourcePlatform {
  try {
    const host = new URL(url).hostname;
    for (const [pattern, platform] of PLATFORM_HOSTS) {
      if (pattern.test(host)) return platform;
    }
  } catch {
    // fall through
  }
  return "manual";
}

/** Only http(s), and no internal hosts — this fetches a user-supplied URL. */
export function isSafePublicUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  return !blocked;
}

export async function parseEventUrl(rawUrl: string): Promise<ParsedEvent> {
  const sourcePlatform = platformFromUrl(rawUrl);
  const miss = (note: string): ParsedEvent => ({ sourcePlatform, parsed: false, note });

  if (!isSafePublicUrl(rawUrl)) {
    return miss("That doesn't look like a public event link.");
  }

  let html: string;
  try {
    const res = await fetch(rawUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        // Some ticketing pages return a stub to unknown agents.
        "user-agent": "Mozilla/5.0 (compatible; PasseBot/0.1; +https://passe.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return miss(`The page returned ${res.status}. Fill the details in manually.`);
    html = (await res.text()).slice(0, 800_000);
  } catch {
    return miss("Couldn't reach that page. Fill the details in manually.");
  }

  const fromJsonLd = parseJsonLd(html);
  const fromOg = parseOpenGraph(html);

  const merged: ParsedEvent = {
    name: fromJsonLd.name ?? fromOg.name,
    venue: fromJsonLd.venue ?? fromOg.venue,
    startsAt: fromJsonLd.startsAt ?? fromOg.startsAt,
    originalPrice: fromJsonLd.originalPrice ?? fromOg.originalPrice,
    sourcePlatform,
    parsed: false,
    note: "",
  };

  merged.parsed = Boolean(merged.name || merged.startsAt || merged.originalPrice);
  merged.note = merged.parsed
    ? "Pulled from the event page — check every field before submitting."
    : "Couldn't read structured data from that page. Fill the details in manually.";

  return merged;
}

type Partial_ = Omit<ParsedEvent, "sourcePlatform" | "parsed" | "note">;

function parseJsonLd(html: string): Partial_ {
  const out: Partial_ = {};
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];

  for (const block of blocks) {
    let json: unknown;
    try {
      json = JSON.parse(block[1].trim());
    } catch {
      continue;
    }

    for (const node of flatten(json)) {
      if (!isRecord(node)) continue;
      const type = node["@type"];
      const isEvent =
        typeof type === "string"
          ? /event/i.test(type)
          : Array.isArray(type) && type.some((t) => typeof t === "string" && /event/i.test(t));
      if (!isEvent) continue;

      if (!out.name && typeof node.name === "string") out.name = node.name.trim();
      if (!out.startsAt && typeof node.startDate === "string") {
        const d = new Date(node.startDate);
        if (!Number.isNaN(d.getTime())) out.startsAt = d.toISOString();
      }
      if (!out.venue) {
        const loc = node.location;
        if (isRecord(loc) && typeof loc.name === "string") out.venue = loc.name.trim();
        else if (Array.isArray(loc)) {
          const first = loc.find((l) => isRecord(l) && typeof l.name === "string");
          if (isRecord(first) && typeof first.name === "string") out.venue = first.name.trim();
        }
      }
      if (out.originalPrice === undefined) {
        const price = lowestOfferPrice(node.offers);
        if (price !== undefined) out.originalPrice = price;
      }
    }
  }
  return out;
}

function lowestOfferPrice(offers: unknown): number | undefined {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const prices: number[] = [];

  for (const offer of list) {
    if (!isRecord(offer)) continue;
    for (const key of ["price", "lowPrice"]) {
      const raw = offer[key];
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= 0) prices.push(n);
    }
  }
  return prices.length ? Math.min(...prices) : undefined;
}

function parseOpenGraph(html: string): Partial_ {
  const out: Partial_ = {};
  const meta = (property: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    );
    return html.match(re)?.[1] ?? html.match(alt)?.[1];
  };

  const title = meta("og:title");
  if (title) out.name = decodeEntities(title).trim();

  const price = meta("product:price:amount") ?? meta("og:price:amount");
  if (price && Number.isFinite(Number(price))) out.originalPrice = Number(price);

  const start = meta("event:start_time") ?? meta("og:start_time");
  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) out.startsAt = d.toISOString();
  }

  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function flatten(node: unknown, depth = 0): unknown[] {
  if (depth > 6) return [];
  if (Array.isArray(node)) return node.flatMap((n) => flatten(n, depth + 1));
  if (!isRecord(node)) return [];
  const nested = ["@graph", "subEvent", "itemListElement"].flatMap((key) =>
    key in node ? flatten(node[key], depth + 1) : [],
  );
  return [node, ...nested];
}

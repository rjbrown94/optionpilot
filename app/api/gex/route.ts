import { NextResponse } from "next/server";
import { calculateGex, type GexContract } from "@/libs/gex/gexEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 250;
const MAX_PAGES = 40;
const FRESH_MS = 120_000;
const STALE_MS = 900_000;
const TIMEOUT_MS = 8_000;
const TOTAL_BUDGET_MS = 20_000;

type Mode = "day" | "swing" | "full";
type MassiveRow = {
  details?: {
    ticker?: string;
    contract_type?: string;
    expiration_date?: string;
    strike_price?: number;
  };
  greeks?: { gamma?: number };
  open_interest?: number;
  underlying_asset?: { price?: number };
};
type MassivePage = {
  results?: MassiveRow[];
  next_url?: string;
  status?: string;
  error?: string;
  message?: string;
};
type Payload = {
  symbol: string;
  mode: Mode;
  expirationFrom: string | null;
  expirationTo: string | null;
  source: "massive";
  updatedAt: string;
  complete: boolean;
  pagesFetched: number;
  contractsFetched: number;
  gex: ReturnType<typeof calculateGex>;
  warning: string | null;
};
type CacheEntry = { timestamp: number; payload: Payload };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Payload>>();

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function normalizeRow(row: MassiveRow): GexContract | null {
  const details = row.details;
  const strikePrice = positive(details?.strike_price);
  if (!details?.ticker || !details.expiration_date || strikePrice === null) return null;
  return {
    ticker: details.ticker,
    contractType:
      details.contract_type === "call" || details.contract_type === "put"
        ? details.contract_type
        : "other",
    strikePrice,
    expirationDate: details.expiration_date,
    gamma:
      typeof row.greeks?.gamma === "number" &&
      Number.isFinite(row.greeks.gamma) &&
      row.greeks.gamma >= 0 && row.greeks.gamma <= 10
        ? row.greeks.gamma
        : null,
    openInterest: positive(row.open_interest) ?? 0,
    underlyingPrice: positive(row.underlying_asset?.price),
  };
}

// Expiration dates are based on the U.S. equity market calendar date.
function marketDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function plusDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

async function loadGex(
  symbol: string,
  mode: Mode,
  today: string,
  apiKey: string,
): Promise<Payload> {
  const expirationFrom = mode === "full" ? null : plusDays(today, mode === "day" ? 0 : 8);
  const expirationTo = mode === "full" ? null : plusDays(today, mode === "day" ? 7 : 60);
  const first = new URL(`https://api.massive.com/v3/snapshot/options/${symbol}`);
  first.searchParams.set("limit", String(PAGE_SIZE));
  if (expirationFrom && expirationTo) {
    first.searchParams.set("expiration_date.gte", expirationFrom);
    first.searchParams.set("expiration_date.lte", expirationTo);
  }
  first.searchParams.set("apiKey", apiKey);

  let next: string | null = first.toString();
  const seen = new Set<string>();
  const contracts: GexContract[] = [];
  let pagesFetched = 0;
  let spot: number | null = null;
  let stoppedForTime = false;
  const startedAt = Date.now();

  while (next && pagesFetched < MAX_PAGES) {
    if (Date.now() - startedAt >= TOTAL_BUDGET_MS) {
      stoppedForTime = true;
      break;
    }
    const url: URL = new URL(next);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.massive.com" ||
      url.pathname !== `/v3/snapshot/options/${symbol}`
    ) {
      throw new Error("Massive returned an unexpected pagination URL.");
    }
    url.searchParams.set("apiKey", apiKey);
    // Keep the expiration window on every page, even if next_url omits it.
    if (expirationFrom && expirationTo) {
      url.searchParams.set("expiration_date.gte", expirationFrom);
      url.searchParams.set("expiration_date.lte", expirationTo);
    }
    const pageUrl = url.toString();
    if (seen.has(pageUrl)) throw new Error("Massive pagination repeated a page.");
    seen.add(pageUrl);

    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      stoppedForTime = true;
      break;
    }
    const response = await fetch(pageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(TIMEOUT_MS, remaining)),
    });
    if (!response.ok) throw new Error(`Massive returned HTTP ${response.status}.`);
    const page = (await response.json()) as MassivePage;
    if (page.status === "ERROR" || page.error) {
      throw new Error("Massive rejected the options snapshot request.");
    }
    if (!Array.isArray(page.results)) {
      throw new Error("Massive returned an invalid options snapshot.");
    }
    for (const raw of page.results) {
      const row = normalizeRow(raw);
      if (!row) continue;
      // Verify filtering locally as a safeguard against provider behavior.
      if (expirationFrom && row.expirationDate < expirationFrom) continue;
      if (expirationTo && row.expirationDate > expirationTo) continue;
      if (spot === null && row.underlyingPrice !== null) spot = row.underlyingPrice;
      contracts.push(row);
    }
    pagesFetched++;
    next = page.next_url || null;
  }

  if (spot === null) throw new Error("Massive did not provide a valid underlying price.");
  if (contracts.length === 0) throw new Error("Massive returned no usable contracts for this window.");

  const complete = next === null;
  return {
    symbol,
    mode,
    expirationFrom,
    expirationTo,
    source: "massive",
    updatedAt: new Date().toISOString(),
    complete,
    pagesFetched,
    contractsFetched: contracts.length,
    gex: calculateGex(contracts, spot),
    warning: complete
      ? null
      : `Partial ${mode} options chain: fetched ${pagesFetched} pages${stoppedForTime ? " before reaching the time budget" : " before reaching the page limit"}. GEX may be materially incomplete.`,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "SPY").trim().toUpperCase();
  if (!/^[A-Z]{1,6}$/.test(symbol)) {
    return NextResponse.json({ success: false, error: "Invalid stock symbol." }, { status: 400 });
  }
  const rawMode = (url.searchParams.get("mode") || "day").trim().toLowerCase();
  if (rawMode !== "day" && rawMode !== "swing" && rawMode !== "full") {
    return NextResponse.json({ success: false, error: "Mode must be day, swing, or full." }, { status: 400 });
  }
  const mode: Mode = rawMode;
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "MASSIVE_API_KEY is not configured." }, { status: 500 });
  }

  const today = marketDate();
  const key = `${symbol}:${mode}:${today}`;
  const now = Date.now();
  const previous = cache.get(key);
  const age = previous ? now - previous.timestamp : Infinity;
  if (previous && age < FRESH_MS) {
    return NextResponse.json({ success: true, ...previous.payload, cached: true, stale: false });
  }

  let task = inflight.get(key);
  if (!task) {
    task = loadGex(symbol, mode, today, apiKey);
    inflight.set(key, task);
    void task.finally(() => {
      if (inflight.get(key) === task) inflight.delete(key);
    }).catch(() => {});
  }

  try {
    const payload = await task;
    cache.set(key, { timestamp: Date.now(), payload });
    return NextResponse.json({ success: true, ...payload, cached: false, stale: false });
  } catch (error) {
    if (previous && age < STALE_MS) {
      return NextResponse.json({
        success: true,
        ...previous.payload,
        cached: true,
        stale: true,
        warning: "Live refresh failed; showing an older snapshot. " + (previous.payload.warning ?? ""),
      });
    }
    console.error("[GEX] Snapshot failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({
      success: false,
      symbol,
      mode,
      error: "Unable to calculate GEX from Massive right now.",
    }, { status: 503 });
  }
}

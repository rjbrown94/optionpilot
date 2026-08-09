import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OptionGreeks = {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
};

type OptionDetails = {
  contract_type?: "call" | "put" | "other";
  expiration_date?: string;
  strike_price?: number;
  ticker?: string;
};

type OptionQuote = {
  ask?: number;
  bid?: number;
  midpoint?: number;
};

type OptionTrade = {
  price?: number;
};

type OptionDay = {
  change?: number;
  change_percent?: number;
  high?: number;
  low?: number;
  volume?: number;
  vwap?: number;
};

type UnderlyingAsset = {
  price?: number;
};

type MassiveOptionResult = {
  break_even_price?: number;
  day?: OptionDay;
  details?: OptionDetails;
  greeks?: OptionGreeks;
  implied_volatility?: number;
  last_quote?: OptionQuote;
  last_trade?: OptionTrade;
  open_interest?: number;
  underlying_asset?: UnderlyingAsset;
};

type MassiveOptionsResponse = {
  status?: string;
  request_id?: string;
  results?: MassiveOptionResult[];
  error?: string;
  message?: string;
};

type CleanOptionContract = {
  ticker: string;
  contractType: "call" | "put" | "other";
  expirationDate: string;
  strikePrice: number;
  underlyingPrice: number | null;
  breakEvenPrice: number | null;
  bid: number | null;
  ask: number | null;
  midpoint: number | null;
  spread: number | null;
  spreadPercent: number | null;
  lastPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayVwap: number | null;
};

type ContractTypeFilter = "call" | "put" | "all";

type CachedPayload = {
  symbol: string;
  contractType: ContractTypeFilter;
  expirationDate: string | null;
  strikePrice: number | null;
  count: number;
  contracts: CleanOptionContract[];
  source: "massive";
  updatedAt: string;
};

type CacheItem = {
  timestamp: number;
  payload: CachedPayload;
};

const FRESH_CACHE_MS = 120_000;
const STALE_CACHE_MS = 900_000;

declare global {
  var optionPilotMassiveOptionsCache: Map<string, CacheItem> | undefined;

  var optionPilotMassiveOptionsInflight:
    | Map<string, Promise<CachedPayload>>
    | undefined;
}

const optionsCache =
  global.optionPilotMassiveOptionsCache ?? new Map<string, CacheItem>();

const inflightRequests =
  global.optionPilotMassiveOptionsInflight ??
  new Map<string, Promise<CachedPayload>>();

if (process.env.NODE_ENV !== "production") {
  global.optionPilotMassiveOptionsCache = optionsCache;
  global.optionPilotMassiveOptionsInflight = inflightRequests;
}

function cleanSymbol(value: string | null): string {
  return (value || "SPY").trim().toUpperCase();
}

function cleanContractType(value: string | null): ContractTypeFilter {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "call" || normalized === "put") {
    return normalized;
  }

  return "all";
}

function cleanExpiration(value: string | null): string | null {
  if (!value) return null;

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function cleanStrike(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanLimit(value: string | null): number {
  const parsed = Number(value || 250);

  if (!Number.isFinite(parsed)) return 250;

  return Math.min(Math.max(Math.floor(parsed), 1), 250);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeGreek(value: unknown): number | null {
  const parsed = numberOrNull(value);

  if (parsed === null || Math.abs(parsed) > 10) {
    return null;
  }

  return parsed;
}

function normalizeIv(value: unknown): number | null {
  const parsed = numberOrNull(value);

  if (parsed === null || parsed <= 0 || parsed > 5) {
    return null;
  }

  return parsed;
}

function calculateMidpoint(
  bid: number | null,
  ask: number | null,
): number | null {
  if (bid === null || ask === null || bid < 0 || ask <= 0 || ask < bid) {
    return null;
  }

  return Number(((bid + ask) / 2).toFixed(4));
}

function calculateSpread(
  bid: number | null,
  ask: number | null,
): {
  spread: number | null;
  spreadPercent: number | null;
} {
  if (bid === null || ask === null || bid < 0 || ask <= 0 || ask < bid) {
    return {
      spread: null,
      spreadPercent: null,
    };
  }

  const spread = ask - bid;
  const midpoint = (bid + ask) / 2;

  return {
    spread: Number(spread.toFixed(4)),
    spreadPercent:
      midpoint > 0 ? Number(((spread / midpoint) * 100).toFixed(2)) : null,
  };
}

function mapContract(item: MassiveOptionResult): CleanOptionContract | null {
  const ticker = item.details?.ticker;
  const contractType = item.details?.contract_type;
  const expirationDate = item.details?.expiration_date;
  const strikePrice = numberOrNull(item.details?.strike_price);

  if (!ticker || !contractType || !expirationDate || strikePrice === null) {
    return null;
  }

  const bid = numberOrNull(item.last_quote?.bid);
  const ask = numberOrNull(item.last_quote?.ask);
  const providerMidpoint = numberOrNull(item.last_quote?.midpoint);
  const calculatedMidpoint = calculateMidpoint(bid, ask);
  const { spread, spreadPercent } = calculateSpread(bid, ask);

  return {
    ticker,
    contractType,
    expirationDate,
    strikePrice,
    underlyingPrice: numberOrNull(item.underlying_asset?.price),
    breakEvenPrice: numberOrNull(item.break_even_price),
    bid,
    ask,
    midpoint: providerMidpoint ?? calculatedMidpoint,
    spread,
    spreadPercent,
    lastPrice: numberOrNull(item.last_trade?.price),
    volume: numberOrNull(item.day?.volume) ?? 0,
    openInterest: numberOrNull(item.open_interest) ?? 0,
    impliedVolatility: normalizeIv(item.implied_volatility),
    delta: normalizeGreek(item.greeks?.delta),
    gamma: normalizeGreek(item.greeks?.gamma),
    theta: normalizeGreek(item.greeks?.theta),
    vega: normalizeGreek(item.greeks?.vega),
    dayChange: numberOrNull(item.day?.change),
    dayChangePercent: numberOrNull(item.day?.change_percent),
    dayHigh: numberOrNull(item.day?.high),
    dayLow: numberOrNull(item.day?.low),
    dayVwap: numberOrNull(item.day?.vwap),
  };
}

function isRateLimitMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("maximum requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  );
}

async function loadLivePayload(input: {
  symbol: string;
  contractType: ContractTypeFilter;
  expirationDate: string | null;
  strikePrice: number | null;
  limit: number;
  apiKey: string;
}): Promise<CachedPayload> {
  const { symbol, contractType, expirationDate, strikePrice, limit, apiKey } =
    input;

  const endpoint = new URL(
    `https://api.massive.com/v3/snapshot/options/${encodeURIComponent(symbol)}`,
  );

  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("apiKey", apiKey);

  if (contractType !== "all") {
    endpoint.searchParams.set("contract_type", contractType);
  }

  if (expirationDate) {
    endpoint.searchParams.set("expiration_date", expirationDate);
  }

  if (strikePrice !== null) {
    endpoint.searchParams.set("strike_price", String(strikePrice));
  }

  const response = await fetch(endpoint.toString(), {
    cache: "no-store",
  });

  const text = await response.text();

  let data: MassiveOptionsResponse;

  try {
    data = JSON.parse(text) as MassiveOptionsResponse;
  } catch {
    throw new Error(
      `Massive returned invalid JSON with HTTP ${response.status}.`,
    );
  }

  if (!response.ok || data.status === "ERROR" || data.error) {
    throw new Error(
      data.error || data.message || `Massive returned HTTP ${response.status}.`,
    );
  }

  let contracts = (data.results || [])
    .map(mapContract)
    .filter((contract): contract is CleanOptionContract => contract !== null);

  contracts = contracts.filter((contract) => {
    if (contractType !== "all" && contract.contractType !== contractType) {
      return false;
    }

    if (expirationDate && contract.expirationDate !== expirationDate) {
      return false;
    }

    if (strikePrice !== null && contract.strikePrice !== strikePrice) {
      return false;
    }

    return true;
  });

  contracts.sort((first, second) => {
    const expirationComparison = first.expirationDate.localeCompare(
      second.expirationDate,
    );

    if (expirationComparison !== 0) {
      return expirationComparison;
    }

    if (first.contractType !== second.contractType) {
      return first.contractType.localeCompare(second.contractType);
    }

    return first.strikePrice - second.strikePrice;
  });

  return {
    symbol,
    contractType,
    expirationDate,
    strikePrice,
    count: contracts.length,
    contracts,
    source: "massive",
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const symbol = cleanSymbol(searchParams.get("symbol"));
  const contractType = cleanContractType(searchParams.get("type"));
  const expirationDate = cleanExpiration(searchParams.get("expiration"));
  const strikePrice = cleanStrike(searchParams.get("strike"));
  const limit = cleanLimit(searchParams.get("limit"));
  const forceRefresh = searchParams.get("refresh") === "1";

  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "MASSIVE_API_KEY is missing.",
      },
      { status: 500 },
    );
  }

  const cacheKey = [
    symbol,
    contractType,
    expirationDate ?? "all-expirations",
    strikePrice ?? "all-strikes",
    limit,
  ].join(":");

  const now = Date.now();
  const cached = optionsCache.get(cacheKey);
  const cacheAge = cached ? now - cached.timestamp : null;

  if (
    !forceRefresh &&
    cached &&
    cacheAge !== null &&
    cacheAge < FRESH_CACHE_MS
  ) {
    return NextResponse.json({
      success: true,
      ...cached.payload,
      cached: true,
      stale: false,
      cacheAgeSeconds: Math.round(cacheAge / 1000),
      message: "Using shared OptionPilot snapshot cache.",
    });
  }

  const existingRequest = inflightRequests.get(cacheKey);

  if (existingRequest) {
    try {
      const payload = await existingRequest;

      return NextResponse.json({
        success: true,
        ...payload,
        cached: true,
        stale: false,
        deduplicated: true,
        message: "Reused an OptionPilot request already in progress.",
      });
    } catch {
      // Continue into the normal fallback path.
    }
  }

  const requestPromise = loadLivePayload({
    symbol,
    contractType,
    expirationDate,
    strikePrice,
    limit,
    apiKey,
  });

  inflightRequests.set(cacheKey, requestPromise);

  try {
    const payload = await requestPromise;

    optionsCache.set(cacheKey, {
      timestamp: Date.now(),
      payload,
    });

    return NextResponse.json({
      success: true,
      ...payload,
      cached: false,
      stale: false,
      message: "Live Massive snapshot loaded.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Massive options data.";

    if (cached && cacheAge !== null && cacheAge < STALE_CACHE_MS) {
      return NextResponse.json({
        success: true,
        ...cached.payload,
        cached: true,
        stale: true,
        cacheAgeSeconds: Math.round(cacheAge / 1000),
        warning: isRateLimitMessage(message)
          ? "Massive request limit reached. Showing the most recent OptionPilot snapshot."
          : "Live options data is temporarily unavailable. Showing the most recent OptionPilot snapshot.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: isRateLimitMessage(message)
          ? "Live options data is temporarily paused because the provider request limit was reached. Wait briefly and try again."
          : "Unable to load options data right now.",
        details: message,
        symbol,
        source: "massive",
        retryAfterSeconds: isRateLimitMessage(message) ? 60 : null,
      },
      { status: 503 },
    );
  } finally {
    inflightRequests.delete(cacheKey);
  }
}

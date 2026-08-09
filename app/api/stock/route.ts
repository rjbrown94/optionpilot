import { NextResponse } from "next/server";

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
  error?: string;
};

type StockResult = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  percentChange: number;

  trend: "Bullish" | "Bearish" | "Neutral";
  bestPlay: "CALLS" | "PUTS" | "WAIT";

  rsi14: null;
  ema20: null;
  ema50: null;

  volume: number;
  averageVolume: number;
  relativeVolume: number;

  support: null;
  resistance: null;

  candlePattern: string;
  candleDirection: "WAIT";
  candleConfidence: number;

  momentumScore: number;
  setupQuality: string;
  score: number;

  updatedAt: string;
  cached: boolean;
  source: "finnhub";
};

type CacheItem = {
  timestamp: number;
  data: StockResult;
};

const CACHE_TIME_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

const quoteCache = new Map<string, CacheItem>();
const inFlightRequests = new Map<string, Promise<StockResult>>();

function cleanSymbol(value: string | null) {
  return (value || "").trim().toUpperCase();
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function getTrend(price: number, previousClose: number): StockResult["trend"] {
  if (price > previousClose) return "Bullish";
  if (price < previousClose) return "Bearish";
  return "Neutral";
}

function getBestPlay(trend: StockResult["trend"]): StockResult["bestPlay"] {
  if (trend === "Bullish") return "CALLS";
  if (trend === "Bearish") return "PUTS";
  return "WAIT";
}

function getMomentumScore(percentChange: number) {
  const move = Math.abs(percentChange);

  if (move >= 5) return 70;
  if (move >= 3) return 60;
  if (move >= 2) return 50;
  if (move >= 1) return 40;

  return 25;
}

function getSetupQuality(score: number) {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Good";
  return "Wait";
}

async function requestQuote(
  symbol: string,
  apiKey: string,
): Promise<StockResult> {
  const url = new URL("https://finnhub.io/api/v1/quote");

  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", apiKey);

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    let quote: FinnhubQuote;

    try {
      quote = JSON.parse(text) as FinnhubQuote;
    } catch {
      throw new Error("Finnhub returned invalid JSON.");
    }

    if (!response.ok || quote.error) {
      throw new Error(
        quote.error || `Finnhub returned HTTP ${response.status}.`,
      );
    }

    const price = Number(quote.c ?? 0);
    const previousClose = Number(quote.pc ?? 0);

    if (price <= 0 || previousClose <= 0) {
      throw new Error(`No valid quote returned for ${symbol}.`);
    }

    const change = Number.isFinite(Number(quote.d))
      ? Number(quote.d)
      : price - previousClose;

    const percentChange = Number.isFinite(Number(quote.dp))
      ? Number(quote.dp)
      : (change / previousClose) * 100;

    const trend = getTrend(price, previousClose);
    const momentumScore = getMomentumScore(percentChange);

    return {
      symbol,
      price: round(price),
      open: round(Number(quote.o ?? 0)),
      high: round(Number(quote.h ?? 0)),
      low: round(Number(quote.l ?? 0)),
      previousClose: round(previousClose),
      change: round(change),
      percentChange: round(percentChange),

      trend,
      bestPlay: getBestPlay(trend),

      rsi14: null,
      ema20: null,
      ema50: null,

      volume: 0,
      averageVolume: 0,
      relativeVolume: 0,

      support: null,
      resistance: null,

      candlePattern: "Calculated from Massive candles",
      candleDirection: "WAIT",
      candleConfidence: 0,

      momentumScore,
      setupQuality: getSetupQuality(momentumScore),
      score: momentumScore,

      updatedAt: new Date().toISOString(),
      cached: false,
      source: "finnhub",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const symbol = cleanSymbol(requestUrl.searchParams.get("symbol"));
  const forceRefresh = requestUrl.searchParams.get("refresh") === "1";

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing stock symbol." },
      { status: 400 },
    );
  }

  const cached = quoteCache.get(symbol);

  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.timestamp < CACHE_TIME_MS
  ) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY is missing from .env.local." },
      { status: 500 },
    );
  }

  try {
    let pending = inFlightRequests.get(symbol);

    if (!pending) {
      pending = requestQuote(symbol, apiKey);
      inFlightRequests.set(symbol, pending);
    }

    const result = await pending;

    quoteCache.set(symbol, {
      timestamp: Date.now(),
      data: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning:
          error instanceof Error
            ? error.message
            : "Live quote failed. Using cached quote.",
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the live stock quote.",
        symbol,
      },
      { status: 502 },
    );
  } finally {
    inFlightRequests.delete(symbol);
  }
}

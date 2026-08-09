import { NextResponse } from "next/server";

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CandleResult = {
  symbol: string;
  interval: string;
  candles: Candle[];
  cached: boolean;
  source: "massive";
};

type CacheItem = {
  timestamp: number;
  data: CandleResult;
};

type MassiveBar = {
  t?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

type MassiveResponse = {
  status?: string;
  results?: MassiveBar[];
  resultsCount?: number;
  error?: string;
  message?: string;
};

type IntervalConfig = {
  multiplier: number;
  timespan: "minute" | "hour" | "day";
  lookbackDays: number;
  minimumCandles: number;
};

const candleCache = new Map<string, CacheItem>();

const CACHE_TIME_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

function cleanSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeInterval(interval: string | null): string {
  const allowedIntervals = new Set([
    "1min",
    "5min",
    "15min",
    "30min",
    "45min",
    "1h",
    "2h",
    "4h",
    "1day",
  ]);

  const requested = interval?.trim() || "5min";

  return allowedIntervals.has(requested) ? requested : "5min";
}

function getIntervalConfig(interval: string): IntervalConfig {
  switch (interval) {
    case "1min":
      return {
        multiplier: 1,
        timespan: "minute",
        lookbackDays: 5,
        minimumCandles: 25,
      };

    case "15min":
      return {
        multiplier: 15,
        timespan: "minute",
        lookbackDays: 10,
        minimumCandles: 25,
      };

    case "30min":
      return {
        multiplier: 30,
        timespan: "minute",
        lookbackDays: 15,
        minimumCandles: 25,
      };

    case "45min":
      return {
        multiplier: 45,
        timespan: "minute",
        lookbackDays: 20,
        minimumCandles: 25,
      };

    case "1h":
      return {
        multiplier: 1,
        timespan: "hour",
        lookbackDays: 30,
        minimumCandles: 25,
      };

    case "2h":
      return {
        multiplier: 2,
        timespan: "hour",
        lookbackDays: 45,
        minimumCandles: 25,
      };

    case "4h":
      return {
        multiplier: 4,
        timespan: "hour",
        lookbackDays: 90,
        minimumCandles: 25,
      };

    case "1day":
      return {
        multiplier: 1,
        timespan: "day",
        lookbackDays: 180,
        minimumCandles: 25,
      };

    case "5min":
    default:
      return {
        multiplier: 5,
        timespan: "minute",
        lookbackDays: 7,
        minimumCandles: 25,
      };
  }
}

function buildCacheKey(symbol: string, interval: string): string {
  return `${symbol}:${interval}`;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isValidCandle(candle: Candle): boolean {
  return (
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0 &&
    candle.high >= candle.low
  );
}

function createMassiveUrl(input: {
  symbol: string;
  multiplier: number;
  timespan: string;
  from: string;
  to: string;
  apiKey: string;
}) {
  const { symbol, multiplier, timespan, from, to, apiKey } = input;

  const url = new URL(
    `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(
      symbol,
    )}/range/${multiplier}/${timespan}/${from}/${to}`,
  );

  url.searchParams.set("adjusted", "true");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("limit", "50000");
  url.searchParams.set("apiKey", apiKey);

  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const symbol = cleanSymbol(searchParams.get("symbol") || "AAPL");

  const interval = normalizeInterval(searchParams.get("interval"));

  const cacheKey = buildCacheKey(symbol, interval);
  const cached = candleCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TIME_MS) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "MASSIVE_API_KEY is missing. Using cached candles.",
      });
    }

    return NextResponse.json(
      {
        error: "MASSIVE_API_KEY is missing from .env.local.",
        symbol,
        interval,
      },
      { status: 500 },
    );
  }

  const config = getIntervalConfig(interval);

  const toDate = new Date();
  const fromDate = new Date();

  fromDate.setDate(toDate.getDate() - config.lookbackDays);

  const url = createMassiveUrl({
    symbol,
    multiplier: config.multiplier,
    timespan: config.timespan,
    from: formatDate(fromDate),
    to: formatDate(toDate),
    apiKey,
  });

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    let data: MassiveResponse;

    try {
      data = JSON.parse(text) as MassiveResponse;
    } catch {
      data = {
        error: text || "Massive returned an invalid response.",
      };
    }

    if (
      !response.ok ||
      data.status === "ERROR" ||
      data.error ||
      !Array.isArray(data.results)
    ) {
      const message =
        data.error ||
        data.message ||
        `Massive candle request returned HTTP ${response.status}.`;

      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning: message,
        });
      }

      return NextResponse.json(
        {
          error: message,
          symbol,
          interval,
          source: "massive",
        },
        { status: 502 },
      );
    }

    const candles: Candle[] = data.results
      .map((bar): Candle => {
        const timestamp = Number(bar.t ?? 0);

        return {
          time: timestamp > 0 ? new Date(timestamp).toISOString() : "",
          open: Number(bar.o ?? 0),
          high: Number(bar.h ?? 0),
          low: Number(bar.l ?? 0),
          close: Number(bar.c ?? 0),
          volume: Number(bar.v ?? 0),
        };
      })
      .filter(isValidCandle)
      .slice(-250);

    if (candles.length < config.minimumCandles) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning: "Massive returned too few candles. Using cached data.",
        });
      }

      return NextResponse.json(
        {
          error: `Not enough valid ${interval} candles returned for ${symbol}.`,
          symbol,
          interval,
          count: candles.length,
          source: "massive",
        },
        { status: 502 },
      );
    }

    const result: CandleResult = {
      symbol,
      interval,
      candles,
      cached: false,
      source: "massive",
    };

    candleCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Massive candle request timed out."
        : error instanceof Error
          ? error.message
          : "Unable to load Massive candle data.";

    console.error("Massive candle request failed:", error);

    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: message,
      });
    }

    return NextResponse.json(
      {
        error: message,
        symbol,
        interval,
        source: "massive",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

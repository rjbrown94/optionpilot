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
};

type CacheItem = {
  timestamp: number;
  data: CandleResult;
};

type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
};

const candleCache = new Map<string, CacheItem>();

// Keep completed 5-minute candle data briefly cached.
const CACHE_TIME = 60 * 1000;

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

  const requestedInterval = interval?.trim() || "5min";

  return allowedIntervals.has(requestedInterval) ? requestedInterval : "5min";
}

function buildCacheKey(symbol: string, interval: string): string {
  return `${symbol}:${interval}`;
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const symbol = cleanSymbol(searchParams.get("symbol") || "AAPL");
  const interval = normalizeInterval(searchParams.get("interval"));
  const cacheKey = buildCacheKey(symbol, interval);
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  const cached = candleCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TIME) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  if (!apiKey) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "Missing TWELVE_DATA_API_KEY. Using cached candles.",
      });
    }

    return NextResponse.json(
      {
        error: "Missing TWELVE_DATA_API_KEY",
        symbol,
        interval,
      },
      { status: 500 },
    );
  }

  const outputsize = interval === "1day" ? 90 : 120;

  const url = new URL("https://api.twelvedata.com/time_series");

  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("timezone", "America/Chicago");
  url.searchParams.set("order", "ASC");
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    if (
      !response.ok ||
      data?.status === "error" ||
      !Array.isArray(data?.values)
    ) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : "Twelve Data candle request failed.";

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
        },
        { status: 502 },
      );
    }

    const candles: Candle[] = data.values
      .map(
        (item: TwelveDataCandle): Candle => ({
          time: item.datetime,
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
          volume: Number(item.volume ?? 0),
        }),
      )
      .filter(isValidCandle);

    if (candles.length < 25) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning:
            "Not enough valid live candles were returned. Using cached data.",
        });
      }

      return NextResponse.json(
        {
          error: `Not enough valid ${interval} candles returned for ${symbol}.`,
          symbol,
          interval,
          count: candles.length,
        },
        { status: 502 },
      );
    }

    const result: CandleResult = {
      symbol,
      interval,
      candles,
      cached: false,
    };

    candleCache.set(cacheKey, {
      timestamp: now,
      data: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Twelve Data candle request failed:", error);

    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "Live request failed. Using cached candle data.",
      });
    }

    return NextResponse.json(
      {
        error: "Unable to load live candle data.",
        symbol,
        interval,
      },
      { status: 502 },
    );
  }
}

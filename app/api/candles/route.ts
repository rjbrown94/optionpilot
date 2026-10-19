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
  source: "twelve-data";
  latestCandleTime: string | null;
  latestCandleAgeMinutes: number | null;
  stale: boolean;
};

type CacheItem = {
  timestamp: number;
  data: CandleResult;
};

type TwelveDataValue = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TwelveDataResponse = {
  status?: string;
  code?: number;
  message?: string;
  values?: TwelveDataValue[];
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

function getOutputSize(interval: string): number {
  switch (interval) {
    case "1min":
      return 250;

    case "5min":
      return 250;

    case "15min":
      return 250;

    case "30min":
      return 250;

    case "45min":
      return 250;

    case "1h":
      return 500;

    case "2h":
      return 500;

    case "4h":
      return 500;

    case "1day":
      return 300;

    default:
      return 250;
  }
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

function parseTwelveDataTime(datetime: string): Date | null {
  if (!datetime) return null;

  const normalized = datetime.includes("T")
    ? datetime
    : datetime.replace(" ", "T");

  if (
    normalized.endsWith("Z") ||
    /[+-]\\d{2}:\\d{2}$/.test(normalized)
  ) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = normalized.match(
    /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00"] = match;

  const localTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let timestamp = localTime;

  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    const observedLocalTime = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );

    timestamp += localTime - observedLocalTime;
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLatestCandleInfo(candles: Candle[]): {
  latestCandleTime: string | null;
  latestCandleAgeMinutes: number | null;
} {
  if (candles.length === 0) {
    return {
      latestCandleTime: null,
      latestCandleAgeMinutes: null,
    };
  }

  const latest = candles[candles.length - 1];

  const parsed = new Date(latest.time);

  if (Number.isNaN(parsed.getTime())) {
    return {
      latestCandleTime: latest.time || null,
      latestCandleAgeMinutes: null,
    };
  }

  const ageMilliseconds = Date.now() - parsed.getTime();

  const ageMinutes = Math.max(0, Math.floor(ageMilliseconds / 60_000));

  return {
    latestCandleTime: latest.time,
    latestCandleAgeMinutes: ageMinutes,
  };
}

function getStaleThresholdMinutes(interval: string): number {
  switch (interval) {
    case "1min":
      return 3;

    case "5min":
      return 10;

    case "15min":
      return 25;

    case "30min":
      return 45;

    case "45min":
      return 65;

    case "1h":
      return 90;

    case "2h":
      return 180;

    case "4h":
      return 360;

    case "1day":
      return 2880;

    default:
      return 10;
  }
}

function isRegularMarketHoursNow(): boolean {
  const now = new Date();

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);

  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  const totalMinutes = hour * 60 + minute;

  /*
   * Regular US market:
   * 9:30 AM - 4:00 PM ET
   */
  return totalMinutes >= 570 && totalMinutes < 960;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const symbol = cleanSymbol(searchParams.get("symbol") || "AAPL");

  const interval = normalizeInterval(searchParams.get("interval"));

  const forceRefresh =
    searchParams.get("refresh") === "1" ||
    searchParams.get("refresh") === "true";

  const cacheKey = buildCacheKey(symbol, interval);

  const cached = candleCache.get(cacheKey);

  const now = Date.now();

  if (
    !forceRefresh &&
    cached &&
    now - cached.timestamp < CACHE_TIME_MS
  ) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "Twelve Data API key is unavailable. Using cached candles.",
      });
    }

    return NextResponse.json(
      {
        error: "TWELVE_DATA_API_KEY is missing from the server environment.",
        symbol,
        interval,
      },
      {
        status: 500,
      },
    );
  }

  const outputsize = getOutputSize(interval);

  const url = new URL("https://api.twelvedata.com/time_series");

  url.searchParams.set("symbol", symbol);

  url.searchParams.set("interval", interval);

  url.searchParams.set("outputsize", String(outputsize));

  url.searchParams.set("order", "ASC");

  url.searchParams.set("timezone", "America/New_York");

  url.searchParams.set("apikey", apiKey);

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    let data: TwelveDataResponse;

    try {
      data = JSON.parse(text) as TwelveDataResponse;
    } catch {
      data = {
        status: "error",
        message: text || "Twelve Data returned an invalid response.",
      };
    }

    if (
      !response.ok ||
      data.status === "error" ||
      !Array.isArray(data.values)
    ) {
      const message =
        data.message || `Twelve Data returned HTTP ${response.status}.`;

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
          source: "twelve-data",
        },
        {
          status: 502,
        },
      );
    }

    const candles: Candle[] = data.values
      .map((value): Candle | null => {
        if (!value.datetime) {
          return null;
        }

        const parsedTime = parseTwelveDataTime(value.datetime);

        const candle: Candle = {
          time: parsedTime?.toISOString() ?? value.datetime,

          open: Number(value.open ?? 0),

          high: Number(value.high ?? 0),

          low: Number(value.low ?? 0),

          close: Number(value.close ?? 0),

          volume: Number(value.volume ?? 0),
        };

        return isValidCandle(candle) ? candle : null;
      })
      .filter((candle): candle is Candle => candle !== null)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(-outputsize);

    if (candles.length < 20) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning:
            "Twelve Data returned too few candles. Using cached candles.",
        });
      }

      return NextResponse.json(
        {
          error: `Not enough valid ${interval} candles returned for ${symbol}.`,
          symbol,
          interval,
          count: candles.length,
          source: "twelve-data",
        },
        {
          status: 502,
        },
      );
    }

    const { latestCandleTime, latestCandleAgeMinutes } =
      getLatestCandleInfo(candles);

    const stale =
      interval !== "1day" &&
      isRegularMarketHoursNow() &&
      latestCandleAgeMinutes !== null &&
      latestCandleAgeMinutes > getStaleThresholdMinutes(interval);

    const result: CandleResult = {
      symbol,
      interval,
      candles,
      cached: false,
      source: "twelve-data",
      latestCandleTime,
      latestCandleAgeMinutes,
      stale,
    };

    candleCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Twelve Data request timed out."
        : error instanceof Error
          ? error.message
          : "Twelve Data request failed.";

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
        source: "twelve-data",
      },
      {
        status: 502,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

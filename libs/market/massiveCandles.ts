import { getMassiveData } from "./massiveClient";

export type MarketCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MassiveBar = {
  t?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

type MassiveAggregateResponse = {
  status?: string;
  results?: MassiveBar[];
  error?: string;
  message?: string;
};

type IntervalConfig = {
  multiplier: number;
  timespan: "minute" | "hour" | "day";
  lookbackDays: number;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeInterval(interval: string): string {
  const allowed = new Set([
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

  return allowed.has(interval) ? interval : "5min";
}

function getIntervalConfig(interval: string): IntervalConfig {
  switch (interval) {
    case "1min":
      return { multiplier: 1, timespan: "minute", lookbackDays: 3 };
    case "15min":
      return { multiplier: 15, timespan: "minute", lookbackDays: 7 };
    case "30min":
      return { multiplier: 30, timespan: "minute", lookbackDays: 10 };
    case "45min":
      return { multiplier: 45, timespan: "minute", lookbackDays: 14 };
    case "1h":
      return { multiplier: 1, timespan: "hour", lookbackDays: 21 };
    case "2h":
      return { multiplier: 2, timespan: "hour", lookbackDays: 30 };
    case "4h":
      return { multiplier: 4, timespan: "hour", lookbackDays: 60 };
    case "1day":
      return { multiplier: 1, timespan: "day", lookbackDays: 45 };
    case "5min":
    default:
      return { multiplier: 5, timespan: "minute", lookbackDays: 5 };
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isValidCandle(candle: MarketCandle): boolean {
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

function getApiLimit(interval: string, requestedLimit: number): number {
  if (interval === "1day") {
    return Math.min(Math.max(requestedLimit + 10, 40), 500);
  }

  return Math.min(Math.max(requestedLimit * 3, 500), 5_000);
}

export async function getMassiveCandles({
  symbol,
  interval = "5min",
  limit = 250,
  forceRefresh = false,
}: {
  symbol: string;
  interval?: string;
  limit?: number;
  forceRefresh?: boolean;
}): Promise<MarketCandle[]> {
  const cleanSymbol = normalizeSymbol(symbol);
  const cleanInterval = normalizeInterval(interval);
  const config = getIntervalConfig(cleanInterval);

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - config.lookbackDays);

  const response = await getMassiveData<MassiveAggregateResponse>({
    path: `/v2/aggs/ticker/${encodeURIComponent(
      cleanSymbol,
    )}/range/${config.multiplier}/${config.timespan}/${formatDate(
      fromDate,
    )}/${formatDate(toDate)}`,
    searchParams: {
      adjusted: true,
      sort: "asc",
      limit: getApiLimit(cleanInterval, limit),
    },
    cacheKey: `massive:candles:${cleanSymbol}:${cleanInterval}`,
    ttlMilliseconds: cleanInterval === "1day" ? 5 * 60_000 : 60_000,
    forceRefresh,
    timeoutMilliseconds: cleanInterval === "1day" ? 5_000 : 6_000,
  });

  return (response.results ?? [])
    .map((bar): MarketCandle => {
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
    .slice(-Math.max(1, limit));
}

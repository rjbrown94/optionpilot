export type SwingCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TwelveDataResponse = {
  values?: Array<{
    datetime?: string;
    open?: string;
    high?: string;
    low?: string;
    close?: string;
    volume?: string;
  }>;
  status?: string;
  message?: string;
  code?: number;
};

type Interval = "1week" | "1day" | "1h";

const CACHE = new Map<
  string,
  {
    expiresAt: number;
    candles: SwingCandle[];
  }
>();

function getTtl(interval: Interval): number {
  if (interval === "1week") return 6 * 60 * 60 * 1000;
  if (interval === "1day") return 30 * 60 * 1000;

  return 10 * 60 * 1000;
}

function getApiKey(): string {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TWELVE_DATA_API_KEY is missing from your environment variables.",
    );
  }

  return apiKey;
}

export async function getSwingCandles(
  symbol: string,
  interval: Interval,
  outputsize: number,
): Promise<SwingCandle[]> {
  const cleanSymbol = symbol.trim().toUpperCase();

  const cacheKey = `${cleanSymbol}:${interval}:${outputsize}`;

  const cached = CACHE.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.candles;
  }

  const url = new URL("https://api.twelvedata.com/time_series");

  url.searchParams.set("symbol", cleanSymbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", getApiKey());
  url.searchParams.set("format", "JSON");

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Twelve Data returned HTTP ${response.status}.`,
    );
  }

  const data = (await response.json()) as TwelveDataResponse;

  if (
    data.status === "error" ||
    !Array.isArray(data.values)
  ) {
    throw new Error(
      data.message ||
        `Twelve Data did not return ${interval} candles for ${cleanSymbol}.`,
    );
  }

  const candles = data.values
    .map((value): SwingCandle | null => {
      const open = Number(value.open);
      const high = Number(value.high);
      const low = Number(value.low);
      const close = Number(value.close);
      const volume = Number(value.volume ?? 0);

      if (
        !value.datetime ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
      ) {
        return null;
      }

      return {
        datetime: value.datetime,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      };
    })
    .filter((candle): candle is SwingCandle => candle !== null)
    .reverse();

  CACHE.set(cacheKey, {
    expiresAt: Date.now() + getTtl(interval),
    candles,
  });

  return candles;
}

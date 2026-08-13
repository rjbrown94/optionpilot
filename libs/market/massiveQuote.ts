import { getMassiveCandles } from "./massiveCandles";
import { withMarketCache } from "./dataCache";

export type MarketQuote = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  percentChange: number;
  volume: number;
  averageVolume: number;
  relativeVolume: number;
  updatedAt: string;
  source: "massive-aggregates";
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export async function getMassiveQuote({
  symbol,
  forceRefresh = false,
}: {
  symbol: string;
  forceRefresh?: boolean;
}): Promise<MarketQuote> {
  const cleanSymbol = normalizeSymbol(symbol);

  return withMarketCache<MarketQuote>({
    key: `massive:quote:${cleanSymbol}`,
    ttlMilliseconds: 60_000,
    forceRefresh,

    request: async () => {
      const candles = await getMassiveCandles({
        symbol: cleanSymbol,
        interval: "1day",
        limit: 30,
        forceRefresh,
      });

      if (candles.length < 2) {
        throw new Error(
          `Not enough daily candles were returned for ${cleanSymbol}.`,
        );
      }

      const latest = candles[candles.length - 1];
      const previous = candles[candles.length - 2];

      const price = latest.close;
      const previousClose = previous.close;

      if (
        !Number.isFinite(price) ||
        !Number.isFinite(previousClose) ||
        price <= 0 ||
        previousClose <= 0
      ) {
        throw new Error(
          `Massive returned invalid quote data for ${cleanSymbol}.`,
        );
      }

      const change = price - previousClose;
      const percentChange = (change / previousClose) * 100;

      const recentVolumes = candles
        .slice(-21, -1)
        .map((candle) => candle.volume)
        .filter((value) => Number.isFinite(value) && value >= 0);

      const averageVolume = average(recentVolumes);

      const relativeVolume =
        averageVolume > 0 ? latest.volume / averageVolume : 0;

      return {
        symbol: cleanSymbol,
        price: round(price),
        open: round(latest.open),
        high: round(latest.high),
        low: round(latest.low),
        previousClose: round(previousClose),
        change: round(change),
        percentChange: round(percentChange),
        volume: Math.round(latest.volume),
        averageVolume: Math.round(averageVolume),
        relativeVolume: round(relativeVolume),
        updatedAt: new Date().toISOString(),
        source: "massive-aggregates",
      };
    },
  });
}

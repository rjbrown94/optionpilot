import { getMassiveCandles } from "./massiveCandles";
import { getMassiveStockSnapshots } from "./massiveSnapshot";
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
  source: "massive-snapshot";
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
    ttlMilliseconds: 30_000,
    forceRefresh,

    request: async () => {
      /*
       * Snapshot = current/live market price.
       * Daily candles = historical volume only.
       *
       * Never use a historical candle close as the primary
       * current stock price.
       */
      const [snapshots, dailyCandles] = await Promise.all([
        getMassiveStockSnapshots({
          symbols: [cleanSymbol],
          forceRefresh,
        }),

        getMassiveCandles({
          symbol: cleanSymbol,
          interval: "1day",
          limit: 30,
          forceRefresh,
        }),
      ]);

      const snapshot = snapshots.find(
        (item) => item.symbol === cleanSymbol,
      );

      if (!snapshot) {
        throw new Error(
          `Massive returned no stock snapshot for ${cleanSymbol}.`,
        );
      }

      const price = snapshot.price;
      const previousClose = snapshot.previousClose;

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        throw new Error(
          `Massive returned an invalid live price for ${cleanSymbol}.`,
        );
      }

      /*
       * Massive snapshot already provides change information.
       * Recalculate only when needed.
       */
      const change =
        Number.isFinite(snapshot.change)
          ? snapshot.change
          : previousClose > 0
            ? price - previousClose
            : 0;

      const percentChange =
        Number.isFinite(snapshot.percentChange)
          ? snapshot.percentChange
          : previousClose > 0
            ? (change / previousClose) * 100
            : 0;

      /*
       * Use completed historical daily candles to calculate
       * 20-day average volume.
       */
      const historicalVolumes = dailyCandles
        .slice(-21, -1)
        .map((candle) => candle.volume)
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value >= 0,
        );

      const averageVolume = average(historicalVolumes);

      const relativeVolume =
        averageVolume > 0
          ? snapshot.volume / averageVolume
          : snapshot.relativeVolume;

      const updatedAt =
        snapshot.lastUpdated &&
        Number.isFinite(snapshot.lastUpdated)
          ? new Date(snapshot.lastUpdated).toISOString()
          : new Date().toISOString();

      return {
        symbol: cleanSymbol,

        price: round(price),

        open: round(snapshot.open),
        high: round(snapshot.high),
        low: round(snapshot.low),

        previousClose: round(previousClose),

        change: round(change),
        percentChange: round(percentChange),

        volume: Math.round(snapshot.volume),
        averageVolume: Math.round(averageVolume),
        relativeVolume: round(relativeVolume),

        updatedAt,

        source: "massive-snapshot",
      };
    },
  });
}

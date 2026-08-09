import { withMarketCache } from "./dataCache";

export type MassiveStockSnapshot = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  percentChange: number;
  volume: number;
  previousVolume: number;
  relativeVolume: number;
  lastUpdated: number | null;
};

type SnapshotBar = {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
  av?: number;
};

type SnapshotTicker = {
  ticker?: string;
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
  day?: SnapshotBar;
  min?: SnapshotBar;
  prevDay?: SnapshotBar;
  lastTrade?: {
    p?: number;
    t?: number;
  };
};

type MassiveSnapshotResponse = {
  status?: string;
  count?: number;
  tickers?: SnapshotTicker[];
  error?: string;
  message?: string;
};

const SNAPSHOT_CACHE_MS = 30_000;

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(
    new Set(
      symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    ),
  );
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSnapshot(
  snapshot: SnapshotTicker,
): MassiveStockSnapshot | null {
  const symbol = snapshot.ticker?.trim().toUpperCase();

  if (!symbol) {
    return null;
  }

  const previousClose = finiteNumber(snapshot.prevDay?.c);
  const dayClose = finiteNumber(snapshot.day?.c);
  const lastTradePrice = finiteNumber(snapshot.lastTrade?.p);

  const price =
    lastTradePrice > 0
      ? lastTradePrice
      : dayClose > 0
        ? dayClose
        : previousClose;

  if (price <= 0) {
    return null;
  }

  const change = Number.isFinite(Number(snapshot.todaysChange))
    ? finiteNumber(snapshot.todaysChange)
    : previousClose > 0
      ? price - previousClose
      : 0;

  const percentChange = Number.isFinite(Number(snapshot.todaysChangePerc))
    ? finiteNumber(snapshot.todaysChangePerc)
    : previousClose > 0
      ? (change / previousClose) * 100
      : 0;

  const volume = finiteNumber(
    snapshot.day?.v ?? snapshot.min?.av ?? snapshot.min?.v,
  );

  const previousVolume = finiteNumber(snapshot.prevDay?.v);

  return {
    symbol,
    price,
    open: finiteNumber(snapshot.day?.o, price),
    high: finiteNumber(snapshot.day?.h, price),
    low: finiteNumber(snapshot.day?.l, price),
    previousClose,
    change,
    percentChange,
    volume,
    previousVolume,
    relativeVolume: previousVolume > 0 ? volume / previousVolume : 0,
    lastUpdated:
      typeof snapshot.updated === "number"
        ? snapshot.updated
        : typeof snapshot.lastTrade?.t === "number"
          ? snapshot.lastTrade.t
          : null,
  };
}

export async function getMassiveStockSnapshots({
  symbols,
  forceRefresh = false,
}: {
  symbols: string[];
  forceRefresh?: boolean;
}): Promise<MassiveStockSnapshot[]> {
  const cleanSymbols = normalizeSymbols(symbols);

  if (cleanSymbols.length === 0) {
    return [];
  }

  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    throw new Error("MASSIVE_API_KEY is missing from .env.local.");
  }

  const cacheKey = `massive:stock-snapshot:${cleanSymbols.join(",")}`;

  return withMarketCache<MassiveStockSnapshot[]>({
    key: cacheKey,
    ttlMilliseconds: SNAPSHOT_CACHE_MS,
    forceRefresh,

    request: async () => {
      const endpoint = new URL(
        "https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers",
      );

      endpoint.searchParams.set("tickers", cleanSymbols.join(","));
      endpoint.searchParams.set("include_otc", "false");
      endpoint.searchParams.set("apiKey", apiKey);

      const response = await fetch(endpoint.toString(), {
        cache: "no-store",
      });

      const text = await response.text();

      let payload: MassiveSnapshotResponse;

      try {
        payload = JSON.parse(text) as MassiveSnapshotResponse;
      } catch {
        throw new Error(
          `Massive snapshot returned invalid JSON with status ${response.status}.`,
        );
      }

      if (!response.ok || payload.status === "ERROR" || payload.error) {
        throw new Error(
          payload.error ||
            payload.message ||
            `Massive snapshot returned HTTP ${response.status}.`,
        );
      }

      return (payload.tickers ?? [])
        .map(normalizeSnapshot)
        .filter(
          (snapshot): snapshot is MassiveStockSnapshot => snapshot !== null,
        );
    },
  });
}

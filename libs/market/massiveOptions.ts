import { withMarketCache } from "./dataCache";

export type MassiveOptionContract = {
  ticker: string;
  contractType: "call" | "put";
  expirationDate: string;
  strikePrice: number;
  underlyingPrice: number;
  breakEvenPrice: number | null;

  bid: number;
  ask: number;
  midpoint: number;
  spread: number;
  spreadPercent: number;

  lastPrice: number | null;
  volume: number;
  openInterest: number;

  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
};

type MassiveOptionsApiResponse = {
  success?: boolean;
  contracts?: MassiveOptionContract[];
  error?: string;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export async function getMassiveOptions({
  symbol,
  type,
  limit = 50,
  forceRefresh = false,
}: {
  symbol: string;
  type: "call" | "put";
  limit?: number;
  forceRefresh?: boolean;
}): Promise<MassiveOptionContract[]> {
  const cleanSymbol = normalizeSymbol(symbol);

  return withMarketCache<MassiveOptionContract[]>({
    key: `massive:options:${cleanSymbol}:${type}:${limit}`,
    ttlMilliseconds: 60_000,
    forceRefresh,

    request: async () => {
      const endpoint = new URL(
        "/api/massive-options",
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      );

      endpoint.searchParams.set("symbol", cleanSymbol);
      endpoint.searchParams.set("type", type);
      endpoint.searchParams.set("limit", String(limit));

      const response = await fetch(endpoint.toString(), {
        cache: "no-store",
      });

      const text = await response.text();

      let payload: MassiveOptionsApiResponse;

      try {
        payload = JSON.parse(text) as MassiveOptionsApiResponse;
      } catch {
        throw new Error("Massive options route returned invalid JSON.");
      }

      if (!response.ok || payload.success === false || payload.error) {
        throw new Error(
          payload.error || `Massive options returned ${response.status}.`,
        );
      }

      return Array.isArray(payload.contracts) ? payload.contracts : [];
    },
  });
}

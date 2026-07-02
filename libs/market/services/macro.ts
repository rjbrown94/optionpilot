import { marketSnapshotSymbols } from "../symbols";

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
};

export async function getQuote(symbol: string): Promise<LiveQuote | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/quote?symbol=${symbol}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
}

export async function getMarketSnapshot() {
  const quotes = await Promise.all(
    marketSnapshotSymbols.map((symbol) => getQuote(symbol)),
  );

  return quotes.filter(Boolean) as LiveQuote[];
}

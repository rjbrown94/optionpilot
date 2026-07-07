import { marketSnapshotSymbols, sectorSymbols } from "../symbols";

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
};

export async function getQuote(symbol: string): Promise<LiveQuote | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      console.error("Missing FINNHUB_API_KEY");
      return null;
    }

    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    if (!data || typeof data.c !== "number") {
      return null;
    }

    return {
      symbol,
      price: data.c,
      change: data.d,
      percentChange: data.dp,
    };
  } catch (error) {
    console.error("Quote fetch failed:", error);
    return null;
  }
}

export async function getMarketSnapshot(): Promise<LiveQuote[]> {
  const quotes = await Promise.all(
    marketSnapshotSymbols.map((symbol) => getQuote(symbol)),
  );

  return quotes.filter((quote): quote is LiveQuote => quote !== null);
}

export async function getSectorSnapshot(): Promise<LiveQuote[]> {
  const quotes = await Promise.all(
    sectorSymbols.map((symbol) => getQuote(symbol)),
  );

  return quotes.filter((quote): quote is LiveQuote => quote !== null);
}

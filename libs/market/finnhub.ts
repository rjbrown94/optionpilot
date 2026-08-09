const API_KEY = process.env.FINNHUB_API_KEY!;

export type FinnhubQuote = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
};

export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const quote = await response.json();

    if (!quote.c || quote.c <= 0) {
      return null;
    }

    return {
      symbol,
      price: quote.c,
      change: quote.d,
      percentChange: quote.dp,
      high: quote.h,
      low: quote.l,
      open: quote.o,
      previousClose: quote.pc,
      timestamp: quote.t,
    };
  } catch {
    return null;
  }
}

export async function getQuotes(symbols: string[]) {
  const quotes = await Promise.all(symbols.map((symbol) => getQuote(symbol)));

  return quotes.filter((quote): quote is FinnhubQuote => quote !== null);
}

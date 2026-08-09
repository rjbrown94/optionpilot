import {
  marketSnapshotSymbols,
  sectorSymbols,
} from "../symbols";

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;

  previousClose: number;
  open: number;
  high: number;
  low: number;

  updatedAt: number | null;
};

type FinnhubQuoteResponse = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

type SnapshotCache = {
  timestamp: number;
  quotes: LiveQuote[];
};

const CACHE_MS = 60_000;

declare global {
  var optionPilotDashboardQuotes:
    | SnapshotCache
    | undefined;

  var optionPilotDashboardQuoteRequest:
    | Promise<LiveQuote[]>
    | undefined;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function allDashboardSymbols(): string[] {
  return Array.from(
    new Set([
      ...marketSnapshotSymbols,
      ...sectorSymbols,
    ]),
  );
}

async function fetchQuote(
  symbol: string,
  apiKey: string,
): Promise<LiveQuote | null> {
  const cleanSymbol = normalizeSymbol(symbol);

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
        cleanSymbol,
      )}&token=${apiKey}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        `[Dashboard Quote] ${cleanSymbol} returned HTTP ${response.status}`,
      );

      return null;
    }

    const data =
      (await response.json()) as FinnhubQuoteResponse;

    const price = numberOrZero(data.c);

    if (price <= 0) {
      return null;
    }

    const previousClose =
      numberOrZero(data.pc);

    const change =
      typeof data.d === "number"
        ? data.d
        : previousClose > 0
          ? price - previousClose
          : 0;

    const percentChange =
      typeof data.dp === "number"
        ? data.dp
        : previousClose > 0
          ? (change / previousClose) * 100
          : 0;

    return {
      symbol: cleanSymbol,

      price,

      change,
      percentChange,

      previousClose,

      open: numberOrZero(data.o),

      high: numberOrZero(data.h),

      low: numberOrZero(data.l),

      updatedAt:
        typeof data.t === "number"
          ? data.t * 1000
          : Date.now(),
    };
  } catch (error) {
    console.error(
      `[Dashboard Quote] ${cleanSymbol} failed:`,
      error,
    );

    return null;
  }
}

async function loadDashboardQuotes(): Promise<
  LiveQuote[]
> {
  const now = Date.now();

  const cached =
    global.optionPilotDashboardQuotes;

  if (
    cached &&
    now - cached.timestamp < CACHE_MS
  ) {
    return cached.quotes;
  }

  /*
   * If another part of the dashboard already started
   * loading quotes, reuse that same request.
   */
  if (
    global.optionPilotDashboardQuoteRequest
  ) {
    return global.optionPilotDashboardQuoteRequest;
  }

  const apiKey =
    process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.error(
      "[Dashboard Quote] FINNHUB_API_KEY is missing.",
    );

    return cached?.quotes ?? [];
  }

  const symbols =
    allDashboardSymbols();

  const request = Promise.all(
    symbols.map((symbol) =>
      fetchQuote(symbol, apiKey),
    ),
  )
    .then((results) => {
      const quotes = results.filter(
        (
          quote,
        ): quote is LiveQuote =>
          quote !== null,
      );

      /*
       * Only replace the cache if we got useful data.
       */
      if (quotes.length > 0) {
        global.optionPilotDashboardQuotes = {
          timestamp: Date.now(),
          quotes,
        };
      }

      return quotes.length > 0
        ? quotes
        : cached?.quotes ?? [];
    })
    .finally(() => {
      global.optionPilotDashboardQuoteRequest =
        undefined;
    });

  global.optionPilotDashboardQuoteRequest =
    request;

  return request;
}

function selectSymbols(
  quotes: LiveQuote[],
  symbols: string[],
): LiveQuote[] {
  const quoteMap = new Map(
    quotes.map((quote) => [
      normalizeSymbol(quote.symbol),
      quote,
    ]),
  );

  return symbols
    .map((symbol) =>
      quoteMap.get(
        normalizeSymbol(symbol),
      ),
    )
    .filter(
      (
        quote,
      ): quote is LiveQuote =>
        quote !== undefined,
    );
}

export async function getQuote(
  symbol: string,
): Promise<LiveQuote | null> {
  const quotes =
    await loadDashboardQuotes();

  const cleanSymbol =
    normalizeSymbol(symbol);

  return (
    quotes.find(
      (quote) =>
        quote.symbol === cleanSymbol,
    ) ?? null
  );
}

export async function getMarketSnapshot(): Promise<
  LiveQuote[]
> {
  const quotes =
    await loadDashboardQuotes();

  return selectSymbols(
    quotes,
    marketSnapshotSymbols,
  );
}

export async function getSectorSnapshot(): Promise<
  LiveQuote[]
> {
  /*
   * This shares the same cached request as
   * getMarketSnapshot().
   */
  const quotes =
    await loadDashboardQuotes();

  return selectSymbols(
    quotes,
    sectorSymbols,
  );
}

export type TradingViewCandidate = {
  symbol: string;
  description: string;
  exchange: string;
  price: number;
  percentChange: number;
  volume: number;
  relativeVolume: number;
  marketCap: number;
  rsi: number;
};

type TradingViewRow = {
  s?: string;
  d?: unknown[];
};

type TradingViewResponse = {
  totalCount?: number;
  data?: TradingViewRow[];
};

const TRADINGVIEW_URL =
  "https://scanner.tradingview.com/america/scan";

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validSymbol(symbol: string): boolean {
  /*
   * Keep normal ticker symbols.
   *
   * This removes things such as:
   * ORCL/PD
   * preferred-share style symbols
   * malformed scanner results
   */
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol);
}

export async function getTradingViewCandidates(
  limit = 50,
): Promise<TradingViewCandidate[]> {
  const response = await fetch(TRADINGVIEW_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    },

    cache: "no-store",

    body: JSON.stringify({
      filter: [
        {
          left: "type",
          operation: "equal",
          right: "stock",
        },

        {
          left: "exchange",
          operation: "in_range",
          right: ["NASDAQ", "NYSE", "AMEX"],
        },

        {
          left: "close",
          operation: "egreater",
          right: 10,
        },

        {
          left: "close",
          operation: "eless",
          right: 500,
        },

        {
          left: "volume",
          operation: "egreater",
          right: 500000,
        },

        {
          left: "market_cap_basic",
          operation: "egreater",
          right: 1000000000,
        },

        {
          left: "relative_volume_10d_calc",
          operation: "egreater",
          right: 1.2,
        },

        /*
         * Avoid stocks that already made huge moves.
         * We want developing setups, not late chases.
         */
        {
          left: "change",
          operation: "egreater",
          right: -8,
        },

        {
          left: "change",
          operation: "eless",
          right: 8,
        },
      ],

      options: {
        lang: "en",
      },

      markets: ["america"],

      symbols: {
        query: {
          types: [],
        },
        tickers: [],
      },

      columns: [
        "name",
        "description",
        "exchange",
        "close",
        "change",
        "volume",
        "relative_volume_10d_calc",
        "market_cap_basic",
        "RSI",
      ],

      sort: {
        /*
         * RVOL still matters, but the ±8% filter above
         * removes the worst already-extended names.
         */
        sortBy: "relative_volume_10d_calc",
        sortOrder: "desc",
      },

      range: [0, Math.max(0, limit - 1)],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `TradingView screener returned HTTP ${response.status}.`,
    );
  }

  const payload =
    (await response.json()) as TradingViewResponse;

  const candidates: TradingViewCandidate[] = [];

  for (const row of payload.data ?? []) {
    if (!Array.isArray(row.d)) {
      continue;
    }

    const [
      rawSymbol,
      rawDescription,
      rawExchange,
      rawPrice,
      rawChange,
      rawVolume,
      rawRelativeVolume,
      rawMarketCap,
      rawRsi,
    ] = row.d;

    const symbol = String(rawSymbol ?? "")
      .trim()
      .toUpperCase();

    if (!validSymbol(symbol)) {
      continue;
    }

    const price = numberValue(rawPrice);
    const volume = numberValue(rawVolume);
    const relativeVolume =
      numberValue(rawRelativeVolume);

    if (
      price <= 0 ||
      volume <= 0 ||
      relativeVolume <= 0
    ) {
      continue;
    }

    candidates.push({
      symbol,

      description:
        String(rawDescription ?? symbol),

      exchange:
        String(rawExchange ?? ""),

      price,

      percentChange:
        numberValue(rawChange),

      volume,

      relativeVolume,

      marketCap:
        numberValue(rawMarketCap),

      rsi:
        numberValue(rawRsi),
    });
  }

  return candidates.slice(0, limit);
}

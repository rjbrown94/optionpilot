import { withMarketCache } from "./dataCache";

export type MarketNewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number | null;
  catalystType: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  catalystScore: number;
};

export type MarketNewsResult = {
  symbol: string;
  topCatalyst: MarketNewsItem | null;
  recent: MarketNewsItem[];
  score: number;
  bias: "Bullish" | "Bearish" | "Neutral";
};

type FinnhubNewsItem = {
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
  datetime?: number;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function getCatalystType(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("earnings") || lower.includes("revenue")) {
    return "Earnings";
  }

  if (
    lower.includes("upgrade") ||
    lower.includes("downgrade") ||
    lower.includes("price target")
  ) {
    return "Analyst";
  }

  if (lower.includes("fda") || lower.includes("approval")) {
    return "FDA";
  }

  if (lower.includes("partnership") || lower.includes("collaboration")) {
    return "Partnership";
  }

  if (lower.includes("contract") || lower.includes("deal")) {
    return "Contract";
  }

  if (lower.includes("acquisition") || lower.includes("merger")) {
    return "Merger";
  }

  if (lower.includes("guidance") || lower.includes("forecast")) {
    return "Guidance";
  }

  return "General News";
}

function getCatalystBias(text: string): "Bullish" | "Bearish" | "Neutral" {
  const lower = text.toLowerCase();

  const bullishWords = [
    "beat",
    "beats",
    "upgrade",
    "raises",
    "raised",
    "approval",
    "approved",
    "partnership",
    "contract",
    "record",
    "growth",
    "surge",
    "strong",
    "buy",
    "bullish",
    "outperform",
  ];

  const bearishWords = [
    "miss",
    "misses",
    "downgrade",
    "cuts",
    "cut",
    "lawsuit",
    "probe",
    "investigation",
    "delay",
    "weak",
    "decline",
    "falls",
    "sell",
    "bearish",
    "underperform",
  ];

  const bullishCount = bullishWords.filter((word) =>
    lower.includes(word),
  ).length;

  const bearishCount = bearishWords.filter((word) =>
    lower.includes(word),
  ).length;

  if (bullishCount > bearishCount) {
    return "Bullish";
  }

  if (bearishCount > bullishCount) {
    return "Bearish";
  }

  return "Neutral";
}

function getCatalystScore(
  catalystType: string,
  bias: "Bullish" | "Bearish" | "Neutral",
): number {
  let score = 50;

  if (catalystType !== "General News") {
    score += 20;
  }

  if (bias !== "Neutral") {
    score += 20;
  }

  return Math.min(score, 100);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function getFinnhubNews({
  symbol,
  forceRefresh = false,
}: {
  symbol: string;
  forceRefresh?: boolean;
}): Promise<MarketNewsResult> {
  const cleanSymbol = normalizeSymbol(symbol);

  return withMarketCache<MarketNewsResult>({
    key: `finnhub:news:${cleanSymbol}`,
    ttlMilliseconds: 5 * 60_000,
    forceRefresh,

    request: async () => {
      const apiKey = process.env.FINNHUB_API_KEY;

      if (!apiKey) {
        throw new Error("FINNHUB_API_KEY is missing from .env.local.");
      }

      const toDate = new Date();
      const fromDate = new Date();

      fromDate.setDate(toDate.getDate() - 7);

      const endpoint = new URL("https://finnhub.io/api/v1/company-news");

      endpoint.searchParams.set("symbol", cleanSymbol);
      endpoint.searchParams.set("from", formatDate(fromDate));
      endpoint.searchParams.set("to", formatDate(toDate));
      endpoint.searchParams.set("token", apiKey);

      const response = await fetch(endpoint.toString(), {
        cache: "no-store",
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Finnhub news returned HTTP ${response.status}.`);
      }

      let payload: FinnhubNewsItem[];

      try {
        payload = JSON.parse(text) as FinnhubNewsItem[];
      } catch {
        throw new Error("Finnhub news returned invalid JSON.");
      }

      const items = Array.isArray(payload)
        ? payload
            .map((item): MarketNewsItem => {
              const combinedText = `${item.headline || ""} ${
                item.summary || ""
              }`;

              const catalystType = getCatalystType(combinedText);

              const bias = getCatalystBias(combinedText);

              return {
                headline: item.headline || "No headline",
                summary: item.summary || "",
                source: item.source || "Unknown",
                url: item.url || "",
                datetime:
                  typeof item.datetime === "number" ? item.datetime : null,
                catalystType,
                bias,
                catalystScore: getCatalystScore(catalystType, bias),
              };
            })
            .sort((first, second) => {
              if (second.catalystScore !== first.catalystScore) {
                return second.catalystScore - first.catalystScore;
              }

              return (second.datetime ?? 0) - (first.datetime ?? 0);
            })
        : [];

      const topCatalyst = items[0] ?? null;

      return {
        symbol: cleanSymbol,
        topCatalyst,
        recent: items.slice(0, 5),
        score: topCatalyst?.catalystScore ?? 0,
        bias: topCatalyst?.bias ?? "Neutral",
      };
    },
  });
}

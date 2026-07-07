import { getQuote, type LiveQuote } from "@/libs/market/marketService";

export type ScanResult = {
  symbol: string;
  price: number;
  percentChange: number;
  tradeScore: number;
  direction: "Bullish" | "Bearish" | "Neutral";
};

const watchUniverse = [
  // ETFs
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "SMH",
  "XLK",
  "XLF",
  "XLE",
  "XLV",

  // AI / Semiconductors
  "NVDA",
  "AMD",
  "AVGO",
  "TSM",
  "MU",
  "ARM",
  "MRVL",

  // Mega Caps
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL",

  // Growth
  "PLTR",
  "CRWD",
  "NET",
  "SNOW",
  "PANW",

  // Momentum
  "COIN",
  "HOOD",
  "SOFI",
  "RKLB",
  "ASTS",

  // Energy
  "XOM",
  "CVX",

  // Financials
  "JPM",
  "GS",
  "BAC",

  // Healthcare
  "LLY",
  "ABBV",
  "UNH",
];

function calculateTradeScore(quote: LiveQuote): number {
  let score = 50;

  if (quote.percentChange > 0) score += 20;
  if (quote.percentChange > 1) score += 10;
  if (quote.percentChange > 2) score += 10;
  if (quote.percentChange > 3) score += 10;

  if (quote.percentChange < 0) score -= 20;
  if (quote.percentChange < -2) score -= 10;

  return Math.max(0, Math.min(score, 100));
}

function getDirection(
  percentChange: number,
): "Bullish" | "Bearish" | "Neutral" {
  if (percentChange > 0) return "Bullish";
  if (percentChange < 0) return "Bearish";
  return "Neutral";
}

export async function runLiveMarketScanner(): Promise<ScanResult[]> {
  const quotes = await Promise.all(
    watchUniverse.map((symbol) => getQuote(symbol)),
  );

  const results: ScanResult[] = quotes
    .filter((quote): quote is LiveQuote => quote !== null)
    .map((quote) => ({
      symbol: quote.symbol,
      price: quote.price,
      percentChange: quote.percentChange,
      tradeScore: calculateTradeScore(quote),
      direction: getDirection(quote.percentChange),
    }))
    .sort((a, b) => b.tradeScore - a.tradeScore);

  return results;
}

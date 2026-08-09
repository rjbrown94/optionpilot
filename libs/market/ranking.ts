import type { FinnhubQuote } from "./finnhub";

export type RankedStock = FinnhubQuote & {
  direction: "CALLS" | "PUTS" | "WAIT";
  score: number;
};

function getDirection(change: number): RankedStock["direction"] {
  if (change >= 1) return "CALLS";
  if (change <= -1) return "PUTS";
  return "WAIT";
}

function getScore(change: number) {
  const move = Math.abs(change);

  if (move >= 8) return 100;
  if (move >= 6) return 90;
  if (move >= 4) return 80;
  if (move >= 3) return 70;
  if (move >= 2) return 60;
  if (move >= 1) return 50;

  return 40;
}

export function rankStocks(quotes: FinnhubQuote[]): RankedStock[] {
  return quotes
    .map((quote) => ({
      ...quote,
      direction: getDirection(quote.percentChange),
      score: getScore(quote.percentChange),
    }))
    .sort((a, b) => b.score - a.score);
}

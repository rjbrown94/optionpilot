import { NextResponse } from "next/server";

type OptionsFlowItem = {
  symbol: string;
  callVolume: number;
  putVolume: number;
  callPutRatio: string;
  signal: "Bullish" | "Bearish" | "Neutral";
  score: number;
  status: "TRADE READY" | "WATCH";
  scannerUrl: string;
};

const symbols = [
  "PLTR",
  "AMD",
  "NVDA",
  "TSLA",
  "AAPL",
  "SMCI",
  "AVGO",
  "COIN",
  "MARA",
  "RIOT",
  "SOFI",
  "HOOD",
  "RIVN",
  "ARM",
  "MU",
  "QCOM",
  "META",
  "AMZN",
  "MSFT",
  "GOOGL",
  "NFLX",
  "BABA",
  "UBER",
  "SHOP",
  "SQ",
  "PYPL",
  "AFRM",
  "UPST",
  "SOUN",
  "IONQ",
  "RKLB",
  "ASTS",
  "HIMS",
  "QQQ",
  "SPY",
  "IWM",
  "SOXL",
  "TQQQ",
  "SQQQ",
];

function makeFlow(symbol: string, index: number): OptionsFlowItem {
  const callVolume = 25000 + ((index * 17300) % 140000);
  const putVolume = 18000 + ((index * 9700) % 120000);
  const ratio = callVolume / putVolume;

  const signal =
    ratio >= 1.5 ? "Bullish" : ratio <= 0.75 ? "Bearish" : "Neutral";

  let score = 50;

  if (ratio >= 1.5 || ratio <= 0.75) score += 20;
  if (callVolume + putVolume >= 100000) score += 15;
  if (callVolume + putVolume >= 180000) score += 10;
  if (ratio >= 2 || ratio <= 0.5) score += 10;

  score = Math.min(score, 100);

  return {
    symbol,
    callVolume,
    putVolume,
    callPutRatio: ratio.toFixed(2),
    signal,
    score,
    status: score >= 80 ? "TRADE READY" : "WATCH",
    scannerUrl: `/scanner?symbol=${symbol}`,
  };
}

export async function GET() {
  const results = symbols
    .map((symbol, index) => makeFlow(symbol, index))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    results,
    note: "Level 1 demo options-flow universe. Real live options flow requires Unusual Whales, Tradier, Polygon, or MarketData later.",
  });
}

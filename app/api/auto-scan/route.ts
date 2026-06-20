import { NextResponse } from "next/server";
import { watchlistCategories } from "@/data/watchlistCategories";

type AutoScanResult = {
  symbol: string;
  price: string;
  previousClose: string;
  changePercent: string;
  bestPlay: string;
  pattern: string;
  candle: string;
  confidence: number;
  score: number;
  setupQuality: string;
  status: string;
  signal: string;
  scannerUrl: string;
};

const cache = new Map<
  string,
  {
    timestamp: number;
    data: {
      category: string;
      limit: number;
      updatedAt: string;
      results: AutoScanResult[];
    };
  }
>();

const CACHE_TIME = 60 * 1000;

function getSetupQuality(score: number) {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  return "Wait";
}

function getSignal(bestPlay: string, score: number) {
  if (score >= 90) {
    return bestPlay === "PUTS" ? "🚀 STRONG PUT" : "🚀 STRONG CALL";
  }

  if (score >= 75) {
    return bestPlay === "PUTS" ? "🔥 WATCH PUT" : "🔥 WATCH CALL";
  }

  return "WAIT";
}

function getStatus(score: number) {
  if (score >= 90) return "TRADE READY";
  if (score >= 75) return "WATCH";
  return "WAIT";
}

function getScore(price: number, previousClose: number, changePercent: number) {
  let score = 40;

  if (price > 0) score += 10;
  if (previousClose > 0) score += 10;
  if (Math.abs(changePercent) >= 0.5) score += 10;
  if (Math.abs(changePercent) >= 1) score += 10;
  if (Math.abs(changePercent) >= 2) score += 10;
  if (Math.abs(changePercent) >= 4) score += 10;

  return Math.min(score, 100);
}

function isBadPrice(symbol: string, price: number) {
  if (!price || price <= 0) return true;

  const maxReasonablePrice: Record<string, number> = {
    SPY: 700,
    QQQ: 650,
    AAPL: 300,
    AMD: 300,
    NVDA: 300,
    TSLA: 600,
    MSFT: 700,
    META: 900,
    AMZN: 400,
    NFLX: 1500,
    GOOG: 400,
    GOOGL: 400,
  };

  const maxPrice = maxReasonablePrice[symbol];

  if (!maxPrice) return false;

  return price > maxPrice;
}

async function scanSymbol(
  symbol: string,
  apiKey: string,
): Promise<AutoScanResult | null> {
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
    {
      next: { revalidate: 30 },
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  const price = Number(data.c || 0);
  const previousClose = Number(data.pc || 0);

  if (isBadPrice(symbol, price)) {
    return null;
  }

  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  const bestPlay = changePercent >= 0 ? "CALLS" : "PUTS";
  const score = getScore(price, previousClose, changePercent);
  const setupQuality = getSetupQuality(score);
  const status = getStatus(score);
  const signal = getSignal(bestPlay, score);

  return {
    symbol,
    price: price.toFixed(2),
    previousClose: previousClose.toFixed(2),
    changePercent: changePercent.toFixed(2),
    bestPlay,
    pattern: "See Scanner",
    candle: "See Scanner",
    confidence: 0,
    score,
    setupQuality,
    status,
    signal,
    scannerUrl: `/scanner?symbol=${symbol}`,
  };
}

export async function GET(req: Request) {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category") || "Core";
  const rawLimit = Number(searchParams.get("limit") || 10);
  const limit = Math.min(Math.max(rawLimit, 1), 15);

  const allSymbols = watchlistCategories[category] || watchlistCategories.Core;
  const symbols = allSymbols.slice(0, limit);

  const cacheKey = `${category}-${limit}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  try {
    const scanned = await Promise.all(
      symbols.map((symbol) => scanSymbol(symbol, apiKey)),
    );

    const results = scanned
      .filter((result): result is AutoScanResult => result !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const responseData = {
      category,
      limit,
      updatedAt: new Date().toISOString(),
      results,
    };

    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData,
    });

    return NextResponse.json({
      ...responseData,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run auto scanner",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

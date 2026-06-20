import { NextResponse } from "next/server";
import { watchlistCategories } from "@/data/watchlistCategories";
import { scanCandles, type Candle } from "@/libs/candleScanner";
import { scanPatterns } from "@/libs/patternScanner";

type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

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
  scannerUrl: string;
  signal: string;
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

function getSignal(bestPlay: string, score: number, confidence: number) {
  if (score >= 90 && confidence >= 80) {
    return bestPlay === "PUTS" ? "🚀 STRONG PUT" : "🚀 STRONG CALL";
  }

  if (score >= 80 && confidence >= 70) {
    return bestPlay === "PUTS" ? "🔥 WATCH PUT" : "🔥 WATCH CALL";
  }

  return "WAIT";
}

function getStatus(
  score: number,
  confidence: number,
  hasPattern: boolean,
  hasCandle: boolean,
) {
  if (score >= 90 && confidence >= 80 && (hasPattern || hasCandle)) {
    return "TRADE READY";
  }

  if (score >= 80 && (hasPattern || hasCandle)) {
    return "WATCH";
  }

  return "WAIT";
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

async function getPatternData(symbol: string) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return {
      pattern: "No confirmed pattern",
      candle: "No confirmed candle",
      patternDirection: "WAIT",
      confidence: 0,
    };
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=60&apikey=${apiKey}`,
      {
        next: { revalidate: 60 },
      },
    );

    const data = await response.json();

    if (!data.values) {
      return {
        pattern: "No confirmed pattern",
        candle: "No confirmed candle",
        patternDirection: "WAIT",
        confidence: 0,
      };
    }

    const candles: Candle[] = data.values
      .map((candle: TwelveDataCandle): Candle => {
        return {
          time: candle.datetime,
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
          volume: Number(candle.volume),
        };
      })
      .reverse();

    const candleResult = scanCandles(candles);
    const patternResult = scanPatterns(candles);

    const patternDirection =
      patternResult.direction !== "WAIT"
        ? patternResult.direction
        : candleResult.direction;

    const confidence = Math.max(
      patternResult.confidence,
      candleResult.confidence,
    );

    return {
      pattern: patternResult.pattern,
      candle: candleResult.candle,
      patternDirection,
      confidence,
    };
  } catch {
    return {
      pattern: "No confirmed pattern",
      candle: "No confirmed candle",
      patternDirection: "WAIT",
      confidence: 0,
    };
  }
}

async function scanSymbol(
  symbol: string,
  apiKey: string,
): Promise<AutoScanResult | null> {
  const [quoteResponse, patternData] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`, {
      next: { revalidate: 30 },
    }),
    getPatternData(symbol),
  ]);

  const data = await quoteResponse.json();

  const price = Number(data.c || 0);
  const previousClose = Number(data.pc || 0);

  if (isBadPrice(symbol, price)) {
    return null;
  }

  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  const priceDirection = changePercent >= 0 ? "CALLS" : "PUTS";

  const bestPlay =
    patternData.patternDirection !== "WAIT"
      ? patternData.patternDirection
      : priceDirection;

  const hasPattern = patternData.pattern !== "No confirmed pattern";
  const hasCandle = patternData.candle !== "No confirmed candle";

  let score = 40;

  if (Math.abs(changePercent) >= 1) score += 10;
  if (Math.abs(changePercent) >= 2) score += 10;
  if (Math.abs(changePercent) >= 4) score += 10;
  if (price > 0) score += 5;
  if (hasPattern) score += 20;
  if (hasCandle) score += 15;
  if (patternData.confidence >= 75) score += 10;
  if (patternData.confidence >= 85) score += 10;

  if (!hasPattern && !hasCandle) {
    score = Math.min(score, 75);
  }

  score = Math.min(score, 100);

  const setupQuality = getSetupQuality(score);
  const status = getStatus(
    score,
    patternData.confidence,
    hasPattern,
    hasCandle,
  );
  const signal = getSignal(bestPlay, score, patternData.confidence);

  return {
    symbol,
    price: price.toFixed(2),
    previousClose: previousClose.toFixed(2),
    changePercent: changePercent.toFixed(2),
    bestPlay,
    pattern: patternData.pattern,
    candle: patternData.candle,
    confidence: patternData.confidence,
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

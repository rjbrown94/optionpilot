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

function getSetupQuality(score: number) {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  return "Wait";
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
      `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=120&apikey=${apiKey}`,
      { cache: "no-store" },
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

  const symbols = watchlistCategories[category] || watchlistCategories.Core;

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const [quoteResponse, patternData] = await Promise.all([
          fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
            { cache: "no-store" },
          ),
          getPatternData(symbol),
        ]);

        const data = await quoteResponse.json();

        const price = Number(data.c || 0);
        const previousClose = Number(data.pc || 0);

        const changePercent =
          previousClose > 0
            ? ((price - previousClose) / previousClose) * 100
            : 0;

        const priceDirection = changePercent >= 0 ? "CALLS" : "PUTS";

        const bestPlay =
          patternData.patternDirection !== "WAIT"
            ? patternData.patternDirection
            : priceDirection;

        let score = 50;

        if (Math.abs(changePercent) >= 1) score += 10;
        if (Math.abs(changePercent) >= 2) score += 10;
        if (Math.abs(changePercent) >= 4) score += 15;
        if (price > 0) score += 10;
        if (patternData.pattern !== "No confirmed pattern") score += 15;
        if (patternData.candle !== "No confirmed candle") score += 10;
        if (patternData.confidence >= 85) score += 10;

        score = Math.min(score, 100);

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
          setupQuality: getSetupQuality(score),
          status: score >= 80 ? "TRADE READY" : "WAIT",
          scannerUrl: `/scanner?symbol=${symbol}`,
        };
      }),
    );

    const sorted = results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      category,
      updatedAt: new Date().toISOString(),
      results: sorted,
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

import { NextResponse } from "next/server";
import { scanCandles, type Candle } from "@/libs/candleScanner";
import { scanPatterns } from "@/libs/patternScanner";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const symbol = searchParams.get("symbol") || "AAPL";

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing TWELVE_DATA_API_KEY" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=120&apikey=${apiKey}`,
      { cache: "no-store" },
    );

    const data = await response.json();

    if (!data.values) {
      return NextResponse.json(
        {
          error: "No candle data found",
          symbol,
        },
        { status: 500 },
      );
    }

    const candles: Candle[] = data.values
      .map((c: any) => ({
        time: c.datetime,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }))
      .reverse();

    const candleResult = scanCandles(candles);
    const patternResult = scanPatterns(candles);

    return NextResponse.json({
      symbol,
      pattern: patternResult.pattern,
      candle: candleResult.candle,
      direction:
        patternResult.direction !== "WAIT"
          ? patternResult.direction
          : candleResult.direction,
      confidence: Math.max(patternResult.confidence, candleResult.confidence),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to scan patterns",
      },
      { status: 500 },
    );
  }
}

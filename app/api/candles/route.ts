import { NextResponse } from "next/server";

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CacheItem = {
  timestamp: number;
  data: {
    symbol: string;
    candles: Candle[];
    cached: boolean;
  };
};

const candleCache = new Map<string, CacheItem>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing TWELVE_DATA_API_KEY" },
      { status: 500 },
    );
  }

  const cached = candleCache.get(symbol);
  const now = Date.now();

  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=90&apikey=${apiKey}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    const data = await response.json();

    if (!data.values) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning: "Using cached candles because API limit was reached.",
        });
      }

      return NextResponse.json(
        {
          error: "No candle data found",
          raw: data,
        },
        { status: 500 },
      );
    }

    const candles = data.values
      .map((candle: any) => ({
        time: candle.datetime,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume),
      }))
      .reverse();

    const result = {
      symbol,
      candles,
      cached: false,
    };

    candleCache.set(symbol, {
      timestamp: now,
      data: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "Using cached candles because live request failed.",
      });
    }

    return NextResponse.json(
      {
        error: "Failed to fetch candles",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

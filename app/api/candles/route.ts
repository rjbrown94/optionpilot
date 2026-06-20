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

type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
};

const candleCache = new Map<string, CacheItem>();
const CACHE_TIME = 5 * 60 * 1000;

function cleanSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function buildFallbackCandles(symbol: string, price = 100) {
  const candles: Candle[] = [];

  for (let i = 90; i >= 1; i--) {
    const base = price + Math.sin(i / 5) * 3;
    candles.push({
      time: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      open: Number((base - 1).toFixed(2)),
      high: Number((base + 2).toFixed(2)),
      low: Number((base - 2).toFixed(2)),
      close: Number(base.toFixed(2)),
      volume: 0,
    });
  }

  return {
    symbol,
    candles,
    cached: false,
    fallback: true,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = cleanSymbol(searchParams.get("symbol") || "AAPL");
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  const cached = candleCache.get(symbol);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TIME) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  if (!apiKey) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "Missing TWELVE_DATA_API_KEY. Using cached candles.",
      });
    }

    return NextResponse.json(buildFallbackCandles(symbol));
  }

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol,
  )}&interval=1day&outputsize=90&apikey=${apiKey}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 300 },
    });

    const data = await response.json();

    if (
      !response.ok ||
      data.status === "error" ||
      !Array.isArray(data.values)
    ) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning: data.message || "Using cached candles because API failed.",
        });
      }

      return NextResponse.json(buildFallbackCandles(symbol, 100));
    }

    const candles: Candle[] = data.values
      .map((candle: TwelveDataCandle) => ({
        time: candle.datetime,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume || 0),
      }))
      .filter(
        (candle: Candle) =>
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close),
      )
      .reverse();

    if (!candles.length) {
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          warning: "No valid candle data. Using cached candles.",
        });
      }

      return NextResponse.json(buildFallbackCandles(symbol));
    }

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

    return NextResponse.json(buildFallbackCandles(symbol));
  }
}

import { NextResponse } from "next/server";
import { scanCandles, type Candle } from "@/libs/candleScanner";

type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

function calculateEMA(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(values: number[], period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const difference = values[i] - values[i - 1];

    if (difference >= 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const difference = values[i] - values[i - 1];
    const gain = difference > 0 ? difference : 0;
    const loss = difference < 0 ? Math.abs(difference) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function calculateAverage(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getSupport(candles: Candle[]) {
  const recent = candles.slice(-20);
  if (!recent.length) return null;

  return Math.min(...recent.map((candle) => candle.low));
}

function getResistance(candles: Candle[]) {
  const recent = candles.slice(-20);
  if (!recent.length) return null;

  return Math.max(...recent.map((candle) => candle.high));
}

function getMomentumScore({
  price,
  previousClose,
  rsi,
  ema20,
  ema50,
  relativeVolume,
}: {
  price: number;
  previousClose: number;
  rsi: number | null;
  ema20: number | null;
  ema50: number | null;
  relativeVolume: number;
}) {
  let score = 0;

  if (price > previousClose) score += 20;
  if (ema20 && price > ema20) score += 20;
  if (ema20 && ema50 && ema20 > ema50) score += 20;
  if (rsi && rsi >= 50 && rsi <= 70) score += 20;
  if (relativeVolume >= 1.2) score += 20;

  return Math.min(score, 100);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing stock symbol" },
      { status: 400 },
    );
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const twelveDataKey = process.env.TWELVE_DATA_API_KEY;

  if (!finnhubKey) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  try {
    const quoteResponse = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
      { next: { revalidate: 30 } },
    );

    if (!quoteResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch stock quote" },
        { status: 500 },
      );
    }

    const quote = await quoteResponse.json();

    const price = Number(quote.c || 0);
    const open = Number(quote.o || 0);
    const high = Number(quote.h || 0);
    const low = Number(quote.l || 0);
    const previousClose = Number(quote.pc || 0);
    const change = Number(quote.d || 0);
    const percentChange = Number(quote.dp || 0);

    let rsi14: number | null = null;
    let ema20: number | null = null;
    let ema50: number | null = null;
    let volume = 0;
    let averageVolume = 0;
    let relativeVolume = 0;
    let support: number | null = null;
    let resistance: number | null = null;
    let candlePattern = "Unknown";
    let candleDirection = "WAIT";
    let candleConfidence = 0;

    if (twelveDataKey) {
      const candleResponse = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=120&apikey=${twelveDataKey}`,
        { next: { revalidate: 60 } },
      );

      const candleData = await candleResponse.json();

      if (candleData.values) {
        const candles: Candle[] = candleData.values
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

        const closes = candles.map((candle) => candle.close);
        const volumes = candles.map((candle) => candle.volume);

        rsi14 = calculateRSI(closes, 14);
        ema20 = calculateEMA(closes, 20);
        ema50 = calculateEMA(closes, 50);

        volume = volumes[volumes.length - 1] || 0;
        averageVolume = calculateAverage(volumes.slice(-20));
        relativeVolume = averageVolume > 0 ? volume / averageVolume : 0;

        support = getSupport(candles);
        resistance = getResistance(candles);

        const candleScan = scanCandles(candles);
        candlePattern = candleScan.candle;
        candleDirection = candleScan.direction;
        candleConfidence = candleScan.confidence;
      }
    }

    const trend =
      ema20 && ema50
        ? ema20 > ema50
          ? "Bullish"
          : "Bearish"
        : price >= previousClose
          ? "Bullish"
          : "Bearish";

    const bestPlay =
      candleDirection !== "WAIT"
        ? candleDirection
        : trend === "Bullish"
          ? "CALLS"
          : "PUTS";

    const momentumScore = getMomentumScore({
      price,
      previousClose,
      rsi: rsi14,
      ema20,
      ema50,
      relativeVolume,
    });

    const setupQuality =
      momentumScore >= 80
        ? "Elite"
        : momentumScore >= 65
          ? "Strong"
          : momentumScore >= 50
            ? "Good"
            : "Wait";

    return NextResponse.json({
      symbol,
      price,
      open,
      high,
      low,
      previousClose,
      change,
      percentChange,

      trend,
      bestPlay,

      rsi14,
      ema20,
      ema50,

      volume,
      averageVolume,
      relativeVolume,

      support,
      resistance,

      candlePattern,
      candleDirection,
      candleConfidence,

      momentumScore,
      setupQuality,

      score: momentumScore,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch stock data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

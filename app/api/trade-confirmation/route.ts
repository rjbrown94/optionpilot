import { NextResponse } from "next/server";

import {
  calculateTradeConfirmation,
  type ConfirmationCandle,
} from "@/libs/scanner/tradeConfirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandleApiItem = {
  datetime?: string;
  time?: string;

  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

type CandleApiResponse = {
  symbol?: string;
  interval?: string;
  candles?: CandleApiItem[];

  cached?: boolean;
  warning?: string;
  error?: string;
};

function normalizeSymbol(value: string | null): string {
  return value?.trim().toUpperCase() || "QQQ";
}

function isFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function normalizeCandles(
  rawCandles: CandleApiItem[],
): ConfirmationCandle[] {
  return rawCandles
    .filter(
      (candle) =>
        isFiniteNumber(candle.open) &&
        isFiniteNumber(candle.high) &&
        isFiniteNumber(candle.low) &&
        isFiniteNumber(candle.close) &&
        isFiniteNumber(candle.volume),
    )
    .map((candle) => ({
      datetime:
        candle.datetime ||
        candle.time ||
        new Date().toISOString(),

      open: candle.open as number,
      high: candle.high as number,
      low: candle.low as number,
      close: candle.close as number,
      volume: candle.volume as number,
    }));
}

function cleanProviderError(
  message: string,
): string {
  const lower = message.toLowerCase();

  const rateLimited =
    lower.includes("maximum requests") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("upgrade your subscription");

  if (rateLimited) {
    return "Live technical data is temporarily busy. Please wait briefly and try again.";
  }

  return message;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);

    const symbol = normalizeSymbol(
      requestUrl.searchParams.get("symbol"),
    );

    /*
     * IMPORTANT:
     *
     * Trade Confirmation no longer calls /api/scanner.
     *
     * The old scanner route loaded quotes, news,
     * market snapshots, sectors, option contracts,
     * and other data.
     *
     * That was unnecessary for technical confirmation
     * and caused unnecessary Massive REST usage.
     *
     * We now load ONLY 5-minute candle data.
     */
    const candleUrl = new URL(
      "/api/candles",
      requestUrl.origin,
    );

    candleUrl.searchParams.set(
      "symbol",
      symbol,
    );

    candleUrl.searchParams.set(
      "interval",
      "5min",
    );

    const response = await fetch(
      candleUrl.toString(),
      {
        cache: "no-store",
      },
    );

    const text = await response.text();

    if (!text.trim()) {
      return NextResponse.json(
        {
          success: false,
          symbol,
          timeframe: "5min",
          signal: "WAIT",
          error:
            "No 5-minute candle data was returned.",
        },
        { status: 502 },
      );
    }

    let candleData: CandleApiResponse;

    try {
      candleData =
        JSON.parse(text) as CandleApiResponse;
    } catch {
      return NextResponse.json(
        {
          success: false,
          symbol,
          timeframe: "5min",
          signal: "WAIT",
          error:
            "5-minute candle data returned invalid JSON.",
        },
        { status: 502 },
      );
    }

    if (
      !response.ok ||
      candleData.error
    ) {
      const rawError =
        candleData.error ||
        "Unable to load 5-minute technical data.";

      return NextResponse.json(
        {
          success: false,
          symbol,
          timeframe: "5min",
          signal: "WAIT",

          error: cleanProviderError(
            rawError,
          ),
        },
        {
          status:
            response.status >= 400
              ? response.status
              : 502,
        },
      );
    }

    const candles = normalizeCandles(
      Array.isArray(candleData.candles)
        ? candleData.candles
        : [],
    );

    if (candles.length < 20) {
      return NextResponse.json(
        {
          success: false,

          symbol,
          timeframe: "5min",

          signal: "WAIT",

          candleCount: candles.length,

          error:
            `Not enough completed 5-minute candles are available for ${symbol}. ` +
            `OptionPilot has ${candles.length}; at least 20 are required.`,
        },
        { status: 422 },
      );
    }

    const technical =
      calculateTradeConfirmation(
        symbol,
        candles,
      );

    if (!technical) {
      return NextResponse.json(
        {
          success: false,

          symbol,
          timeframe: "5min",

          signal: "WAIT",

          error:
            "OptionPilot could not calculate technical confirmation.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,

      symbol:
        candleData.symbol ||
        symbol,

      updatedAt:
        new Date().toISOString(),

      timeframe: "5min",

      signal:
        technical.signal,

      direction:
        technical.direction,

      score:
        technical.score,

      price:
        technical.price,

      vwap:
        technical.vwap,

      ema9:
        technical.ema9,

      ema20:
        technical.ema20,

      /*
       * These are intentionally null because the
       * lightweight confirmation engine does not need
       * additional REST calls to calculate them.
       */
      ema50: null,
      rsi14: null,

      relativeVolume:
        technical.relativeVolume,

      volume:
        candles[candles.length - 1]?.volume ?? 0,

      averageVolume:
        technical.relativeVolume > 0
          ? (candles[candles.length - 1]?.volume ?? 0) /
            technical.relativeVolume
          : 0,

      support: null,
      resistance: null,

      aboveVWAP:
        technical.aboveVWAP,

      belowVWAP:
        technical.belowVWAP,

      higherHigh:
        technical.higherHigh,

      higherLow:
        technical.higherLow,

      lowerHigh:
        technical.lowerHigh,

      lowerLow:
        technical.lowerLow,

      bullishEMA:
        technical.bullishEMA,

      bearishEMA:
        technical.bearishEMA,

      strongVolume:
        technical.strongVolume,

      pattern:
        technical.signal === "CALL READY"
          ? "Bullish 5-minute confirmation"
          : technical.signal === "PUT READY"
            ? "Bearish 5-minute confirmation"
            : "No confirmed structure",

      confirmations:
        technical.confirmations,

      warnings: [
        ...(technical.warnings || []),

        ...(candleData.warning
          ? [candleData.warning]
          : []),
      ],

      candleCount:
        candles.length,

      source:
        "5-minute-technical-engine",

      cached:
        candleData.cached ?? false,
    });
  } catch (error) {
    console.error(
      "Trade confirmation failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Trade confirmation failed.";

    return NextResponse.json(
      {
        success: false,

        signal: "WAIT",

        error:
          cleanProviderError(message),
      },
      { status: 500 },
    );
  }
}

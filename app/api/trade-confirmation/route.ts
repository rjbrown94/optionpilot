import { NextResponse } from "next/server";
import {
  calculateTradeConfirmation,
  type ConfirmationCandle,
} from "@/libs/scanner/tradeConfirmation";

type CandleApiResponse = {
  candles?: ConfirmationCandle[];
  values?: ConfirmationCandle[];
  data?: ConfirmationCandle[];
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol")?.toUpperCase() || "QQQ";

    const requestUrl = new URL(req.url);
    const baseUrl = requestUrl.origin;
    const response = await fetch(
      `${baseUrl}/api/candles?symbol=${encodeURIComponent(symbol)}&interval=5min`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to load candle data" },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as
      | CandleApiResponse
      | ConfirmationCandle[];

    const candles = Array.isArray(payload)
      ? payload
      : payload.candles || payload.values || payload.data || [];

    const result = calculateTradeConfirmation(symbol, candles);

    if (!result) {
      return NextResponse.json(
        {
          symbol,
          signal: "WAIT",
          error: "Not enough valid 5-minute candle data",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      timeframe: "5min",
      ...result,
    });
  } catch (error) {
    console.error("Trade confirmation failed:", error);

    return NextResponse.json(
      { error: "Trade confirmation failed" },
      { status: 500 },
    );
  }
}

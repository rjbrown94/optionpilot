import { NextResponse } from "next/server";

import { analyzeSwingTrade } from "@/libs/market/swing/swingTradeEngine";
import { getSwingCandles } from "@/libs/market/swing/twelveDataSwing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);

    const symbol =
      requestUrl.searchParams
        .get("symbol")
        ?.trim()
        .toUpperCase() || "SPY";

    const [
      weeklyCandles,
      dailyCandles,
      hourlyCandles,
    ] = await Promise.all([
      getSwingCandles(symbol, "1week", 160),
      getSwingCandles(symbol, "1day", 300),
      getSwingCandles(symbol, "1h", 500),
    ]);

    const analysis = analyzeSwingTrade({
      symbol,
      weeklyCandles,
      dailyCandles,
      hourlyCandles,
    });

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),

      dataSource: "Twelve Data",

      candles: {
        weekly: weeklyCandles.length,
        daily: dailyCandles.length,
        hourly: hourlyCandles.length,
      },

      currentPrice:
        hourlyCandles[hourlyCandles.length - 1]?.close ??
        dailyCandles[dailyCandles.length - 1]?.close ??
        0,

      ...analysis,
    });
  } catch (error) {
    console.error("Swing analysis failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Swing analysis failed.",
      },
      { status: 500 },
    );
  }
}

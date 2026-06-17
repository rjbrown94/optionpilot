import { NextResponse } from "next/server";

const symbols = [
  "TSLA",
  "NVDA",
  "PLTR",
  "AAPL",
  "IWM",
  "QQQ",
  "SPY",
  "AMD",
  "META",
  "AMZN",
];

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY" },
      { status: 500 },
    );
  }

  try {
    const stocks = await Promise.all(
      symbols.map(async (symbol) => {
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
          { cache: "no-store" },
        );

        const data = await response.json();

        const currentPrice = Number(data.c || 0);
        const previousClose = Number(data.pc || 0);

        const gapPercent =
          previousClose > 0
            ? ((currentPrice - previousClose) / previousClose) * 100
            : 0;

        const direction = gapPercent >= 0 ? "Gap Up" : "Gap Down";
        const optionsBias = gapPercent >= 0 ? "Calls" : "Puts";
        const score = Math.min(Math.round(Math.abs(gapPercent) * 20), 100);

        return {
          symbol,
          currentPrice: currentPrice.toFixed(2),
          previousClose: previousClose.toFixed(2),
          gapPercent: gapPercent.toFixed(2),
          direction,
          optionsBias,
          score,
        };
      }),
    );

    const sortedStocks = stocks.sort(
      (a, b) => Math.abs(Number(b.gapPercent)) - Math.abs(Number(a.gapPercent)),
    );

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      stocks: sortedStocks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load live gap scanner",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const symbols = [
      "AAPL",
      "TSLA",
      "NVDA",
      "AMD",
      "PLTR",
      "SOFI",
      "MARA",
      "RIOT",
    ];

    const stocks = await Promise.all(
      symbols.map(async (symbol) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`,
          {
            cache: "no-store",
          },
        );

        const data = await res.json();

        return {
          symbol,
          price: data.c || 0,
          percentChange: data.dp || 0,
          volume: Math.floor(Math.random() * 15000000),
          rvol: Number((Math.random() * 8 + 1).toFixed(1)),
          float:
            Math.random() > 0.7
              ? "Low"
              : Math.random() > 0.4
                ? "Medium"
                : "High",
        };
      }),
    );

    stocks.sort((a, b) => b.percentChange - a.percentChange);

    return NextResponse.json(stocks);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to load momentum scanner",
      },
      {
        status: 500,
      },
    );
  }
}

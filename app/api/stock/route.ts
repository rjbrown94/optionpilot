import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing stock symbol" },
      { status: 400 },
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

  const response = await fetch(quoteUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 },
    );
  }

  const quote = await response.json();

  return NextResponse.json({
    symbol,
    price: quote.c,
    open: quote.o,
    high: quote.h,
    low: quote.l,
    previousClose: quote.pc,
    change: quote.d,
    percentChange: quote.dp,
  });
}

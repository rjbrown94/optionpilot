import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.MASSIVE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "MASSIVE_API_KEY not found",
      });
    }

    const response = await fetch(
      `https://api.massive.com/v3/reference/tickers/AAPL?apiKey=${apiKey}`,
    );

    const text = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response: text,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

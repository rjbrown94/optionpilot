import { NextResponse } from "next/server";
import { runLiveMarketScanner } from "@/libs/scanner/liveMarketScanner";

export async function GET() {
  try {
    const results = await runLiveMarketScanner();

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Live scanner failed:", error);

    return NextResponse.json({ error: "Live scanner failed" }, { status: 500 });
  }
}

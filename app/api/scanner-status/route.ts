import { NextResponse } from "next/server";

type CheapOptionsScannerResponse = {
  success?: boolean;
  watching?: number;
  ready?: number;
  watchCount?: number;
  conflicts?: number;
  marketStatus?: string;
  updatedAt?: string;
  cached?: boolean;
  error?: string;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const scannerUrl = new URL("/api/cheap-options", requestUrl.origin);

    scannerUrl.searchParams.set("mode", "day");

    const response = await fetch(scannerUrl.toString(), {
      cache: "no-store",
    });

    const data = (await response.json()) as CheapOptionsScannerResponse;

    if (!response.ok || !data.success) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || "The live opportunity scanner is unavailable.",
          watching: 0,
          ready: 0,
          watchCount: 0,
          conflicts: 0,
          mode: "Offline",
          marketStatus: "UNKNOWN",
          updatedAt: new Date().toISOString(),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      watching: data.watching ?? 0,
      ready: data.ready ?? 0,
      watchCount: data.watchCount ?? 0,
      conflicts: data.conflicts ?? 0,
      mode: data.cached ? "Cached" : "Live",
      marketStatus: data.marketStatus ?? "UNKNOWN",
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scanner status request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load scanner status.",
        watching: 0,
        ready: 0,
        watchCount: 0,
        conflicts: 0,
        mode: "Offline",
        marketStatus: "UNKNOWN",
        updatedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}

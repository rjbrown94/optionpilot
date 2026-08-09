import { NextResponse } from "next/server";

type FmpEarning = {
  date?: string;
  symbol?: string;
  eps?: number | null;
  epsEstimated?: number | null;
  revenue?: number | null;
  revenueEstimated?: number | null;
  time?: string;
  fiscalDateEnding?: string;
  updatedFromDate?: string;
};

type EarningsSession =
  | "Before Open"
  | "After Close"
  | "During Market"
  | "Time TBD";

function getCentralDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function normalizeSession(value?: string): EarningsSession {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("bmo") ||
    normalized.includes("before") ||
    normalized.includes("pre-market") ||
    normalized.includes("pre market")
  ) {
    return "Before Open";
  }

  if (
    normalized.includes("amc") ||
    normalized.includes("after") ||
    normalized.includes("post-market") ||
    normalized.includes("post market")
  ) {
    return "After Close";
  }

  if (normalized.includes("during") || normalized.includes("market hours")) {
    return "During Market";
  }

  return "Time TBD";
}

function isValidTicker(symbol?: string): boolean {
  if (!symbol) {
    return false;
  }

  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol.trim().toUpperCase());
}

function getErrorMessage(data: unknown): string {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string") {
      return data.message;
    }

    if ("error" in data && typeof data.error === "string") {
      return data.error;
    }
  }

  return "The earnings calendar is unavailable.";
}

function sessionRank(session: EarningsSession): number {
  switch (session) {
    case "Before Open":
      return 4;

    case "During Market":
      return 3;

    case "After Close":
      return 2;

    default:
      return 1;
  }
}

export async function GET() {
  const apiKey = process.env.FMP_API_KEY;
  const today = getCentralDate();

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "FMP_API_KEY is missing.",
        restricted: false,
        date: today,
        timezone: "America/Chicago",
        count: 0,
        earnings: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }

  const url = new URL(
    "https://financialmodelingprep.com/stable/earnings-calendar",
  );

  url.searchParams.set("from", today);
  url.searchParams.set("to", today);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const rawText = await response.text();

    let parsedData: unknown = rawText;

    try {
      parsedData = JSON.parse(rawText);
    } catch {
      // FMP may return plain text such as "Restricted Endpoint".
    }

    if (!response.ok || !Array.isArray(parsedData)) {
      const errorMessage = getErrorMessage(parsedData);

      const restricted =
        errorMessage.toLowerCase().includes("restricted") ||
        response.status === 401 ||
        response.status === 402 ||
        response.status === 403;

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          restricted,
          upstreamStatus: response.status,
          date: today,
          timezone: "America/Chicago",
          count: 0,
          earnings: [],
          updatedAt: new Date().toISOString(),
        },
        {
          status: response.status >= 400 ? response.status : 502,
        },
      );
    }

    const earnings = (parsedData as FmpEarning[])
      .filter((item) => isValidTicker(item.symbol))
      .map((item) => {
        const ticker = item.symbol!.trim().toUpperCase();
        const session = normalizeSession(item.time);

        return {
          ticker,
          session,
          reportDate: item.date ?? today,
          epsEstimate: item.epsEstimated ?? null,
          epsActual: item.eps ?? null,
          revenueEstimate: item.revenueEstimated ?? null,
          revenueActual: item.revenue ?? null,
          fiscalDateEnding: item.fiscalDateEnding ?? null,
        };
      })
      .sort((a, b) => {
        const rankDifference = sessionRank(b.session) - sessionRank(a.session);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        return a.ticker.localeCompare(b.ticker);
      })
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      restricted: false,
      date: today,
      timezone: "America/Chicago",
      count: earnings.length,
      earnings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Earnings calendar request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load today's earnings.",
        restricted: false,
        date: today,
        timezone: "America/Chicago",
        count: 0,
        earnings: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";

type FmpEconomicEvent = {
  date?: string;
  country?: string;
  event?: string;
  currency?: string;
  previous?: number | string | null;
  estimate?: number | string | null;
  actual?: number | string | null;
  impact?: string;
};

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

function formatCentralTime(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function normalizeImpact(
  value?: string,
): "High" | "Medium" | "Low" {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("high")) {
    return "High";
  }

  if (normalized.includes("medium")) {
    return "Medium";
  }

  return "Low";
}

function isUnitedStatesEvent(item: FmpEconomicEvent): boolean {
  const country = item.country?.trim().toLowerCase() ?? "";
  const currency = item.currency?.trim().toUpperCase() ?? "";

  return (
    country === "us" ||
    country === "usa" ||
    country.includes("united states") ||
    currency === "USD"
  );
}

function getErrorMessage(data: unknown): string {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    if (
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }

    if (
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  }

  return "The economic calendar is unavailable.";
}

export async function GET() {
  const apiKey = process.env.FMP_API_KEY;
  const today = getCentralDate();

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "FMP_API_KEY is missing.",
        date: today,
        timezone: "America/Chicago",
        count: 0,
        events: [],
      },
      { status: 500 },
    );
  }

  const url = new URL(
    "https://financialmodelingprep.com/stable/economic-calendar",
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
      // FMP sometimes returns plain text such as "Restricted".
    }

    if (!response.ok || !Array.isArray(parsedData)) {
      const errorMessage = getErrorMessage(parsedData);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          restricted:
            errorMessage.toLowerCase().includes("restricted") ||
            response.status === 401 ||
            response.status === 403,
          upstreamStatus: response.status,
          date: today,
          timezone: "America/Chicago",
          count: 0,
          events: [],
          updatedAt: new Date().toISOString(),
        },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }

    const events = (parsedData as FmpEconomicEvent[])
      .filter(isUnitedStatesEvent)
      .map((item) => ({
        time: item.date
          ? formatCentralTime(item.date)
          : "Time TBD",
        name: item.event || "Economic Event",
        impact: normalizeImpact(item.impact),
        previous: item.previous ?? null,
        estimate: item.estimate ?? null,
        actual: item.actual ?? null,
      }))
      .sort((a, b) => {
        const impactRank = {
          High: 3,
          Medium: 2,
          Low: 1,
        } as const;

        return impactRank[b.impact] - impactRank[a.impact];
      })
      .slice(0, 8);

    return NextResponse.json({
      success: true,
      date: today,
      timezone: "America/Chicago",
      count: events.length,
      events,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load economic events.",
        date: today,
        timezone: "America/Chicago",
        count: 0,
        events: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}

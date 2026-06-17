import { NextResponse } from "next/server";

type NewsItem = {
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
  datetime?: number;
};

function getCatalystType(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes("earnings") || lower.includes("revenue")) {
    return "Earnings";
  }

  if (lower.includes("upgrade") || lower.includes("price target")) {
    return "Analyst";
  }

  if (lower.includes("fda") || lower.includes("approval")) {
    return "FDA";
  }

  if (lower.includes("partnership") || lower.includes("collaboration")) {
    return "Partnership";
  }

  if (lower.includes("contract") || lower.includes("deal")) {
    return "Contract";
  }

  if (lower.includes("acquisition") || lower.includes("merger")) {
    return "Merger";
  }

  if (lower.includes("guidance") || lower.includes("forecast")) {
    return "Guidance";
  }

  return "General News";
}

function getCatalystBias(text: string) {
  const lower = text.toLowerCase();

  const bullishWords = [
    "beats",
    "beat",
    "upgrade",
    "raises",
    "raised",
    "approval",
    "approved",
    "partnership",
    "contract",
    "record",
    "growth",
    "surge",
    "strong",
    "buy",
    "bullish",
    "outperform",
  ];

  const bearishWords = [
    "misses",
    "miss",
    "downgrade",
    "cuts",
    "cut",
    "lawsuit",
    "probe",
    "investigation",
    "delay",
    "weak",
    "decline",
    "falls",
    "sell",
    "bearish",
    "underperform",
  ];

  const bullishCount = bullishWords.filter((word) =>
    lower.includes(word),
  ).length;

  const bearishCount = bearishWords.filter((word) =>
    lower.includes(word),
  ).length;

  if (bullishCount > bearishCount) return "Bullish";
  if (bearishCount > bullishCount) return "Bearish";

  return "Neutral";
}

function getCatalystScore(type: string, bias: string) {
  let score = 50;

  if (type !== "General News") score += 20;
  if (bias === "Bullish" || bias === "Bearish") score += 20;

  return Math.min(score, 100);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const symbol = searchParams.get("symbol")?.toUpperCase() || "AAPL";
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY" },
      { status: 500 },
    );
  }

  const today = new Date();
  const to = today.toISOString().split("T")[0];

  const fromDate = new Date();
  fromDate.setDate(today.getDate() - 7);
  const from = fromDate.toISOString().split("T")[0];

  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Finnhub news" },
        { status: 500 },
      );
    }

    const data: NewsItem[] = await response.json();

    const filteredData = Array.isArray(data)
      ? data.filter((item) => {
          const text =
            `${item.headline || ""} ${item.summary || ""}`.toLowerCase();

          return (
            text.includes(symbol.toLowerCase()) ||
            text.includes(symbol.replace(".", "").toLowerCase())
          );
        })
      : [];

    const sourceData = filteredData.length > 0 ? filteredData : data;

    const news = Array.isArray(sourceData)
      ? sourceData.slice(0, 5).map((item) => {
          const text = `${item.headline || ""} ${item.summary || ""}`;
          const catalystType = getCatalystType(text);
          const bias = getCatalystBias(text);
          const catalystScore = getCatalystScore(catalystType, bias);

          return {
            headline: item.headline || "No headline",
            summary: item.summary || "",
            source: item.source || "Unknown",
            url: item.url || "",
            datetime: item.datetime || null,
            catalystType,
            bias,
            catalystScore,
          };
        })
      : [];

    const topNews = news[0];

    return NextResponse.json({
      symbol,
      catalyst: topNews ? "News Found" : "No major news found",
      topCatalyst: topNews || null,
      news,
      filtered: filteredData.length > 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch news catalyst",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

const WATCHLIST = [
  "IWM",
  "SPY",
  "QQQ",
  "SOFI",
  "PLTR",
  "HOOD",
  "RIVN",
  "IONQ",
  "SOUN",
  "HIMS",
  "MARA",
  "RIOT",
  "AMD",
  "NVDA",
  "TSLA",
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
];

const COMPANY_NAMES: Record<string, string[]> = {
  SOFI: ["sofi", "sofi technologies"],
  PLTR: ["palantir"],
  HOOD: ["robinhood"],
  RIVN: ["rivian"],
  IONQ: ["ionq"],
  SOUN: ["soundhound"],
  HIMS: ["hims & hers", "hims"],
  MARA: ["marathon digital"],
  RIOT: ["riot platforms"],
  AMD: ["advanced micro devices", "amd"],
  NVDA: ["nvidia"],
  TSLA: ["tesla"],
  AAPL: ["apple"],
  MSFT: ["microsoft"],
  META: ["meta"],
  AMZN: ["amazon"],
  SPY: ["spy", "s&p 500"],
  QQQ: ["qqq", "nasdaq"],
  IWM: ["iwm", "russell 2000"],
};

const bullishWords = [
  "upgrade",
  "beats",
  "beat",
  "raises",
  "raised",
  "partnership",
  "contract",
  "approval",
  "launch",
  "record",
  "growth",
  "buyback",
  "strong",
  "surges",
  "jumps",
  "rallies",
  "wins",
  "expands",
  "guidance",
  "profit",
  "soar",
  "soars",
];

const bearishWords = [
  "downgrade",
  "misses",
  "miss",
  "cuts",
  "cut",
  "lawsuit",
  "investigation",
  "offering",
  "bankruptcy",
  "layoffs",
  "falls",
  "drops",
  "plunges",
  "weak",
  "loss",
  "warning",
  "slumps",
  "concerns",
];

function decodeHtml(text: string) {
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function articleMatchesSymbol(symbol: string, title: string) {
  const lowerTitle = title.toLowerCase();
  const names = COMPANY_NAMES[symbol] || [symbol.toLowerCase()];

  return (
    lowerTitle.includes(symbol.toLowerCase()) ||
    names.some((name) => lowerTitle.includes(name))
  );
}

function getCatalystType(text: string) {
  const lower = text.toLowerCase();

  if (
    lower.includes("earnings") ||
    lower.includes("revenue") ||
    lower.includes("profit")
  ) {
    return "Earnings";
  }

  if (
    lower.includes("upgrade") ||
    lower.includes("downgrade") ||
    lower.includes("analyst")
  ) {
    return "Analyst";
  }

  if (lower.includes("partnership")) return "Partnership";
  if (lower.includes("contract")) return "Contract";
  if (lower.includes("approval")) return "Approval";
  if (lower.includes("lawsuit") || lower.includes("investigation")) {
    return "Legal";
  }
  if (lower.includes("offering")) return "Offering";
  if (lower.includes("guidance")) return "Guidance";

  return "General News";
}

function getBias(text: string) {
  const lower = text.toLowerCase();

  const bullishHits = bullishWords.filter((word) =>
    lower.includes(word),
  ).length;

  const bearishHits = bearishWords.filter((word) =>
    lower.includes(word),
  ).length;

  if (bullishHits > bearishHits) return "Bullish";
  if (bearishHits > bullishHits) return "Bearish";

  return "Neutral";
}

function getScore(bias: string, catalystType: string, text: string) {
  const lower = text.toLowerCase();

  let score = 45;

  bullishWords.forEach((word) => {
    if (lower.includes(word)) score += 8;
  });

  bearishWords.forEach((word) => {
    if (lower.includes(word)) score += 8;
  });

  if (bias !== "Neutral") score += 10;

  if (
    catalystType === "Earnings" ||
    catalystType === "Analyst" ||
    catalystType === "Contract" ||
    catalystType === "Partnership" ||
    catalystType === "Approval" ||
    catalystType === "Guidance"
  ) {
    score += 15;
  }

  return Math.min(score, 100);
}

function getRating(score: number) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "D";
}

function getOptionDirection(bias: string) {
  if (bias === "Bullish") return "CALLS";
  if (bias === "Bearish") return "PUTS";
  return "WAIT";
}

function getImpact(bias: string) {
  if (bias === "Bullish") {
    return "Watch for CALL setup after chart confirmation";
  }

  if (bias === "Bearish") {
    return "Watch for PUT setup after chart confirmation";
  }

  return "Wait for chart confirmation";
}

function getReason(bias: string, catalystType: string) {
  if (bias === "Bullish")
    return `Bullish ${catalystType.toLowerCase()} catalyst`;
  if (bias === "Bearish")
    return `Bearish ${catalystType.toLowerCase()} catalyst`;
  return `${catalystType} needs chart confirmation`;
}

export async function GET() {
  try {
    const allNews: any[] = [];

    for (const symbol of WATCHLIST) {
      const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`;

      const res = await fetch(url, { cache: "no-store" });
      const xml = await res.text();

      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
        .slice(0, 10)
        .map((match) => {
          const item = match[1];

          const title = decodeHtml(
            item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "",
          );

          const link = decodeHtml(
            item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "",
          );

          const description = decodeHtml(
            item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "",
          );

          if (!articleMatchesSymbol(symbol, title)) return null;

          const fullText = `${title} ${description}`;
          const bias = getBias(fullText);
          const catalystType = getCatalystType(fullText);
          const score = getScore(bias, catalystType, fullText);
          const optionDirection = getOptionDirection(bias);
          const rating = getRating(score);
          const reason = getReason(bias, catalystType);

          return {
            symbol,
            title,
            description,
            link,
            source: "Yahoo Finance",
            bias,
            catalystType,
            score,
            rating,
            reason,
            optionDirection,
            impact: getImpact(bias),
          };
        })
        .filter(Boolean);

      allNews.push(...items);
    }

    const ranked = allNews.sort((a: any, b: any) => b.score - a.score);

    const bestBySymbol = new Map<string, any>();

    for (const item of ranked) {
      if (!bestBySymbol.has(item.symbol)) {
        bestBySymbol.set(item.symbol, item);
      }
    }

    const topPlays = Array.from(bestBySymbol.values())
      .filter((item: any) => item.score >= 70)
      .slice(0, 6);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      results: ranked,
      topPlays,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load news catalyst data" },
      { status: 500 },
    );
  }
}

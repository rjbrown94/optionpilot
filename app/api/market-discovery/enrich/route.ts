import { NextResponse } from "next/server";

type Direction = "CALLS" | "PUTS" | "WAIT";

type Candidate = {
  symbol: string;
  direction: Direction;
  baseScore: number;
};

type NewsItem = {
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
  datetime?: number | null;
  catalystType?: string;
  bias?: "Bullish" | "Bearish" | "Neutral";
  catalystScore?: number;
};

type NewsResponse = {
  topCatalyst?: NewsItem | null;
  news?: NewsItem[];
  error?: string;
};

type MassiveContract = {
  ticker?: string;
  contractType?: "call" | "put";
  expirationDate?: string;
  strikePrice?: number;
  underlyingPrice?: number;
  breakEvenPrice?: number | null;
  bid?: number;
  ask?: number;
  midpoint?: number;
  spreadPercent?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number | null;
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
};

type MassiveResponse = {
  success?: boolean;
  contracts?: MassiveContract[];
  error?: string;
};

type BestContract = {
  available: boolean;
  symbol: string | null;
  type: "CALL" | "PUT" | null;
  strike: number | null;
  expiration: string | null;
  premium: number | null;
  bid: number | null;
  ask: number | null;
  spreadPercent: number | null;
  volume: number | null;
  openInterest: number | null;
  delta: number | null;
  impliedVolatility: number | null;
  score: number;
};

type Enrichment = {
  symbol: string;
  news: {
    headline: string | null;
    source: string | null;
    bias: "Bullish" | "Bearish" | "Neutral";
    score: number;
  };
  option: BestContract;
  conflict: boolean;
  institutionalScore: number;
  status: "TRADE CANDIDATE" | "WATCH" | "WAIT";
  reasons: string[];
  warnings: string[];
};

const MAX_SYMBOLS = 8;
const CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function scoreContract(contract: MassiveContract): number {
  let score = 0;

  const openInterest = Number(contract.openInterest ?? 0);
  const volume = Number(contract.volume ?? 0);
  const spreadPercent = Number(contract.spreadPercent ?? 100);
  const delta = Math.abs(Number(contract.delta ?? 0));
  const underlyingPrice = Number(contract.underlyingPrice ?? 0);
  const strikePrice = Number(contract.strikePrice ?? 0);

  if (openInterest >= 10_000) score += 25;
  else if (openInterest >= 5_000) score += 20;
  else if (openInterest >= 1_000) score += 15;
  else if (openInterest >= 250) score += 8;

  if (volume >= 5_000) score += 20;
  else if (volume >= 1_000) score += 15;
  else if (volume >= 250) score += 10;

  if (spreadPercent <= 3) score += 20;
  else if (spreadPercent <= 7) score += 15;
  else if (spreadPercent <= 15) score += 8;

  if (delta >= 0.5 && delta <= 0.75) score += 20;
  else if (delta >= 0.35 && delta <= 0.85) score += 12;

  const distance =
    underlyingPrice > 0
      ? (Math.abs(strikePrice - underlyingPrice) / underlyingPrice) * 100
      : 100;

  if (distance <= 2) score += 15;
  else if (distance <= 5) score += 8;

  return Math.min(100, score);
}

function selectBestContract(
  response: MassiveResponse | null,
  direction: Direction,
): BestContract {
  if (!response?.contracts?.length || direction === "WAIT") {
    return {
      available: false,
      symbol: null,
      type: null,
      strike: null,
      expiration: null,
      premium: null,
      bid: null,
      ask: null,
      spreadPercent: null,
      volume: null,
      openInterest: null,
      delta: null,
      impliedVolatility: null,
      score: 0,
    };
  }

  const expectedType = direction === "CALLS" ? "call" : "put";

  const ranked = response.contracts
    .filter((contract) => contract.contractType === expectedType)
    .filter(
      (contract) =>
        Number(contract.bid ?? 0) > 0 &&
        Number(contract.ask ?? 0) > 0 &&
        Number(contract.ask ?? 0) >= Number(contract.bid ?? 0),
    )
    .map((contract) => ({
      contract,
      score: scoreContract(contract),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best) {
    return {
      available: false,
      symbol: null,
      type: null,
      strike: null,
      expiration: null,
      premium: null,
      bid: null,
      ask: null,
      spreadPercent: null,
      volume: null,
      openInterest: null,
      delta: null,
      impliedVolatility: null,
      score: 0,
    };
  }

  return {
    available: true,
    symbol: best.contract.ticker ?? null,
    type: expectedType === "call" ? "CALL" : "PUT",
    strike: Number(best.contract.strikePrice ?? 0) || null,
    expiration: best.contract.expirationDate ?? null,
    premium: Number(best.contract.midpoint ?? 0) || null,
    bid: Number(best.contract.bid ?? 0) || null,
    ask: Number(best.contract.ask ?? 0) || null,
    spreadPercent: Number(best.contract.spreadPercent ?? 0),
    volume: Number(best.contract.volume ?? 0),
    openInterest: Number(best.contract.openInterest ?? 0),
    delta:
      best.contract.delta === null || best.contract.delta === undefined
        ? null
        : Number(best.contract.delta),
    impliedVolatility:
      best.contract.impliedVolatility === null ||
      best.contract.impliedVolatility === undefined
        ? null
        : Number(best.contract.impliedVolatility),
    score: best.score,
  };
}

function getTopNews(response: NewsResponse | null): NewsItem | null {
  if (response?.topCatalyst) {
    return response.topCatalyst;
  }

  if (!Array.isArray(response?.news) || response.news.length === 0) {
    return null;
  }

  return [...response.news].sort(
    (a, b) => Number(b.catalystScore ?? 0) - Number(a.catalystScore ?? 0),
  )[0];
}

async function enrichCandidate(
  origin: string,
  candidate: Candidate,
): Promise<Enrichment> {
  const optionType = candidate.direction === "PUTS" ? "put" : "call";

  const [newsResponse, massiveResponse] = await Promise.all([
    fetchJson<NewsResponse>(
      `${origin}/api/news?symbol=${encodeURIComponent(candidate.symbol)}`,
    ),
    candidate.direction === "WAIT"
      ? Promise.resolve(null)
      : fetchJson<MassiveResponse>(
          `${origin}/api/massive-options?symbol=${encodeURIComponent(
            candidate.symbol,
          )}&type=${optionType}&limit=30`,
        ),
  ]);

  const topNews = getTopNews(newsResponse);
  const newsBias = topNews?.bias ?? "Neutral";
  const newsScore = Number(topNews?.catalystScore ?? 0);
  const option = selectBestContract(massiveResponse, candidate.direction);

  const conflict =
    (candidate.direction === "CALLS" && newsBias === "Bearish") ||
    (candidate.direction === "PUTS" && newsBias === "Bullish");

  const institutionalScore = Math.min(
    100,
    Math.round(
      candidate.baseScore * 0.6 +
        newsScore * 0.15 +
        option.score * 0.25 -
        (conflict ? 15 : 0),
    ),
  );

  let status: Enrichment["status"] = "WAIT";

  if (
    institutionalScore >= 80 &&
    option.available &&
    !conflict &&
    candidate.direction !== "WAIT"
  ) {
    status = "TRADE CANDIDATE";
  } else if (institutionalScore >= 65 && candidate.direction !== "WAIT") {
    status = "WATCH";
  }

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (newsBias !== "Neutral") {
    reasons.push(`${newsBias} news catalyst`);
  }

  if (option.available) {
    reasons.push(`Option contract score ${option.score}/100`);
  }

  if (option.available && Number(option.spreadPercent ?? 100) <= 7) {
    reasons.push("Liquid option spread");
  }

  if (conflict) {
    warnings.push("News direction conflicts with price direction");
  }

  if (!option.available && candidate.direction !== "WAIT") {
    warnings.push("No matching liquid Massive option contract found");
  }

  return {
    symbol: candidate.symbol,
    news: {
      headline: topNews?.headline ?? null,
      source: topNews?.source ?? null,
      bias: newsBias,
      score: newsScore,
    },
    option,
    conflict,
    institutionalScore,
    status,
    reasons,
    warnings,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      candidates?: Candidate[];
    };

    const candidates = Array.isArray(body.candidates)
      ? body.candidates
          .filter(
            (candidate) =>
              typeof candidate.symbol === "string" &&
              ["CALLS", "PUTS", "WAIT"].includes(candidate.direction) &&
              Number.isFinite(candidate.baseScore),
          )
          .slice(0, MAX_SYMBOLS)
      : [];

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid candidates were supplied.",
        },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;

    const enrichments = await runWithConcurrency(
      candidates,
      CONCURRENCY,
      (candidate) => enrichCandidate(origin, candidate),
    );

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      enriched: enrichments.length,
      enrichments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to enrich market candidates.",
      },
      { status: 500 },
    );
  }
}

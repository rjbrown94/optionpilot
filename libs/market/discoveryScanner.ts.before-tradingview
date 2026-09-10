import { getMassiveQuote, type MarketQuote } from "./massiveQuote";
import {
  getDiscoveryUniverse,
  getUniverseSymbols,
  type UniverseCategory,
} from "./universe";

export type DiscoveryDirection = "CALLS" | "PUTS" | "WAIT";

export type DiscoveryCandidate = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  volume: number;
  averageVolume: number;
  relativeVolume: number;
  direction: DiscoveryDirection;
  score: number;
  reasons: string[];
};

export type DiscoveryScanResult = {
  scanned: number;
  qualified: number;
  failed: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  candidates: DiscoveryCandidate[];
  topOpportunities: DiscoveryCandidate[];
  topGainers: DiscoveryCandidate[];
  topLosers: DiscoveryCandidate[];
  relativeVolume: DiscoveryCandidate[];
  failures: Array<{
    symbol: string;
    error: string;
  }>;
};

type ScanOptions = {
  category?: UniverseCategory;
  limit?: number;
  concurrency?: number;
  minimumScore?: number;
  forceRefresh?: boolean;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function getDirection(quote: MarketQuote): DiscoveryDirection {
  if (quote.percentChange >= 1) {
    return "CALLS";
  }

  if (quote.percentChange <= -1) {
    return "PUTS";
  }

  return "WAIT";
}

function scoreQuote(quote: MarketQuote): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];
  const absoluteMove = Math.abs(quote.percentChange);

  if (absoluteMove >= 5) {
    score += 35;
    reasons.push("Price moved at least 5%");
  } else if (absoluteMove >= 3) {
    score += 30;
    reasons.push("Price moved at least 3%");
  } else if (absoluteMove >= 2) {
    score += 24;
    reasons.push("Price moved at least 2%");
  } else if (absoluteMove >= 1) {
    score += 16;
    reasons.push("Price moved at least 1%");
  } else {
    score += 6;
  }

  if (quote.relativeVolume >= 3) {
    score += 35;
    reasons.push("Relative volume is at least 3x");
  } else if (quote.relativeVolume >= 2) {
    score += 30;
    reasons.push("Relative volume is at least 2x");
  } else if (quote.relativeVolume >= 1.5) {
    score += 24;
    reasons.push("Relative volume is at least 1.5x");
  } else if (quote.relativeVolume >= 1.2) {
    score += 16;
    reasons.push("Relative volume is above average");
  } else {
    score += 5;
  }

  if (quote.price >= 10 && quote.price <= 500) {
    score += 10;
    reasons.push("Price is inside the preferred trading range");
  } else if (quote.price > 0) {
    score += 5;
  }

  if (quote.averageVolume >= 5_000_000) {
    score += 15;
    reasons.push("Very strong average liquidity");
  } else if (quote.averageVolume >= 1_000_000) {
    score += 12;
    reasons.push("Strong average liquidity");
  } else if (quote.averageVolume >= 250_000) {
    score += 8;
    reasons.push("Acceptable average liquidity");
  }

  if (quote.volume >= 1_000_000) {
    score += 5;
    reasons.push("Strong current volume");
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    reasons,
  };
}

function toCandidate(quote: MarketQuote): DiscoveryCandidate {
  const scoring = scoreQuote(quote);

  return {
    symbol: quote.symbol,
    price: round(quote.price),
    change: round(quote.change),
    percentChange: round(quote.percentChange),
    volume: Math.round(quote.volume),
    averageVolume: Math.round(quote.averageVolume),
    relativeVolume: round(quote.relativeVolume),
    direction: getDirection(quote),
    score: scoring.score,
    reasons: scoring.reasons,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    Math.max(1, items.length),
  );

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}

export async function scanDiscoveryUniverse(
  options: ScanOptions = {},
): Promise<DiscoveryScanResult> {
  const { category, limit = 20, concurrency = 2, minimumScore = 45 } = options;

  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  const symbols = category
    ? getUniverseSymbols(category)
    : getDiscoveryUniverse(limit);

  const selectedSymbols = symbols.slice(0, Math.max(1, limit));

  const failures: Array<{
    symbol: string;
    error: string;
  }> = [];

  const scanResults = await mapWithConcurrency(
    selectedSymbols,
    concurrency,
    async (symbol): Promise<DiscoveryCandidate | null> => {
      try {
        const quote = await getMassiveQuote({
          symbol,
          forceRefresh: false,
        });

        return toCandidate(quote);
      } catch (error) {
        failures.push({
          symbol,
          error:
            error instanceof Error
              ? error.message
              : "Unknown discovery scan error.",
        });

        return null;
      }
    },
  );

  const candidates = scanResults
    .filter((candidate): candidate is DiscoveryCandidate => candidate !== null)
    .sort((first, second) => second.score - first.score);

  const qualified = candidates.filter(
    (candidate) => candidate.score >= minimumScore,
  );

  const completedAtDate = new Date();

  return {
    scanned: selectedSymbols.length,
    qualified: qualified.length,
    failed: failures.length,
    startedAt,
    completedAt: completedAtDate.toISOString(),
    durationMs: completedAtDate.getTime() - startedAtDate.getTime(),

    candidates,

    topOpportunities: qualified.slice(0, 20),

    topGainers: [...candidates]
      .sort((first, second) => second.percentChange - first.percentChange)
      .slice(0, 20),

    topLosers: [...candidates]
      .sort((first, second) => first.percentChange - second.percentChange)
      .slice(0, 20),

    relativeVolume: [...candidates]
      .sort((first, second) => second.relativeVolume - first.relativeVolume)
      .slice(0, 20),

    failures,
  };
}

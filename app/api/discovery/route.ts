import { NextResponse } from "next/server";
import {
  scanDiscoveryUniverse,
  type DiscoveryScanResult,
} from "@/libs/market/discoveryScanner";
import type { UniverseCategory } from "@/libs/market/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 75;
const MAX_LIMIT = 250;
const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;
const DEFAULT_MINIMUM_SCORE = 45;

type CachedDiscovery = {
  timestamp: number;
  data: DiscoveryScanResult;
};

const discoveryCache = new Map<string, CachedDiscovery>();
const pendingScans = new Map<string, Promise<DiscoveryScanResult>>();

const CACHE_TIME_MS = 60_000;

const VALID_CATEGORIES = new Set<UniverseCategory>([
  "market-etfs",
  "sector-etfs",
  "mega-cap",
  "semiconductors",
  "ai-infrastructure",
  "software-cloud",
  "cybersecurity",
  "financials",
  "energy",
  "industrials",
  "healthcare",
  "consumer",
  "communications",
  "materials",
  "utilities",
  "real-estate",
  "high-beta",
  "defensive",
]);

function parseInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseCategory(value: string | null): UniverseCategory | undefined {
  const category = value?.trim() as UniverseCategory | undefined;

  if (!category || !VALID_CATEGORIES.has(category)) {
    return undefined;
  }

  return category;
}

function buildCacheKey(input: {
  category?: UniverseCategory;
  limit: number;
  concurrency: number;
  minimumScore: number;
}): string {
  return [
    input.category ?? "all",
    input.limit,
    input.concurrency,
    input.minimumScore,
  ].join(":");
}

async function runDiscoveryScan(input: {
  category?: UniverseCategory;
  limit: number;
  concurrency: number;
  minimumScore: number;
  forceRefresh: boolean;
}): Promise<DiscoveryScanResult> {
  const cacheKey = buildCacheKey(input);

  if (!input.forceRefresh) {
    const cached = discoveryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TIME_MS) {
      return cached.data;
    }
  }

  const existing = pendingScans.get(cacheKey);

  if (existing) {
    return existing;
  }

  const pending = scanDiscoveryUniverse({
    category: input.category,
    limit: input.limit,

    minimumScore: input.minimumScore,
    forceRefresh: input.forceRefresh,
  })
    .then((data) => {
      discoveryCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
      });

      return data;
    })
    .finally(() => {
      pendingScans.delete(cacheKey);
    });

  pendingScans.set(cacheKey, pending);

  return pending;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const category = parseCategory(requestUrl.searchParams.get("category"));

  const limit = parseInteger(
    requestUrl.searchParams.get("limit"),
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );

  const concurrency = parseInteger(
    requestUrl.searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    1,
    MAX_CONCURRENCY,
  );

  const minimumScore = parseInteger(
    requestUrl.searchParams.get("minimumScore"),
    DEFAULT_MINIMUM_SCORE,
    0,
    100,
  );

  const forceRefresh = requestUrl.searchParams.get("refresh") === "1";

  try {
    const result = await runDiscoveryScan({
      category,
      limit,
      concurrency,
      minimumScore,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      category: category ?? "all",
      cached: !forceRefresh,
      updatedAt: result.completedAt,
      ...result,
    });
  } catch (error) {
    console.error("Discovery scan failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete the discovery scan.",
        category: category ?? "all",
        limit,
      },
      {
        status: 502,
      },
    );
  }
}

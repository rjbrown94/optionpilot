"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Direction = "CALLS" | "PUTS" | "WAIT";

type DiscoveryCandidate = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  volume: number;
  averageVolume: number;
  relativeVolume: number;
  direction: Direction;
  score: number;
  reasons: string[];
};

type DiscoveryResponse = {
  success: boolean;
  category: string;
  cached: boolean;
  updatedAt: string;
  scanned: number;
  qualified: number;
  failed: number;
  durationMs: number;
  topOpportunities: DiscoveryCandidate[];
  topGainers: DiscoveryCandidate[];
  topLosers: DiscoveryCandidate[];
  relativeVolume: DiscoveryCandidate[];
  error?: string;
};

type TabKey = "opportunities" | "gainers" | "losers" | "volume";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "opportunities", label: "Top Opportunities" },
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "volume", label: "Relative Volume" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLargeNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getDirectionClasses(direction: Direction): string {
  if (direction === "CALLS") {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
  }

  if (direction === "PUTS") {
    return "border-red-700 bg-red-950/50 text-red-300";
  }

  return "border-yellow-700 bg-yellow-950/50 text-yellow-300";
}

function getChangeClasses(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-zinc-300";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 60) return "Watch";
  return "Low Priority";
}

function getScoreClasses(score: number): string {
  if (score >= 90) {
    return "border-emerald-400 bg-emerald-500 text-black";
  }

  if (score >= 80) {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
  }

  if (score >= 70) {
    return "border-yellow-700 bg-yellow-950/50 text-yellow-300";
  }

  if (score >= 60) {
    return "border-orange-700 bg-orange-950/50 text-orange-300";
  }

  return "border-red-700 bg-red-950/50 text-red-300";
}

function getLiquidityLabel(averageVolume: number): string {
  if (averageVolume >= 5_000_000) return "Very High";
  if (averageVolume >= 1_000_000) return "High";
  if (averageVolume >= 250_000) return "Moderate";
  return "Low";
}

function getTradeFocus(direction: Direction): string {
  if (direction === "CALLS") return "Bullish option setups";
  if (direction === "PUTS") return "Bearish option setups";
  return "Wait for confirmation";
}

export default function MarketDiscoveryPage() {
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("opportunities");

  const loadDiscovery = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch(
        `/api/discovery?limit=20${refresh ? "&refresh=1" : ""}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as DiscoveryResponse;

      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error || `Discovery returned ${response.status}.`,
        );
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load market discovery.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  const visibleCandidates = useMemo(() => {
    if (!data) return [];

    if (activeTab === "gainers") return data.topGainers;
    if (activeTab === "losers") return data.topLosers;
    if (activeTab === "volume") return data.relativeVolume;

    return data.topOpportunities;
  }, [activeTab, data]);

  const topCandidate = data?.topOpportunities?.[0] ?? null;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
              OptionPilot Intelligence
            </p>

            <h1 className="mt-2 text-4xl font-bold md:text-5xl">
              Market Discovery
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Find the strongest liquid movers, understand why they ranked, and
              send only the best setups into the full scanner.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDiscovery(true)}
            disabled={refreshing}
            className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Scanning..." : "Refresh Market"}
          </button>
        </header>

        {loading && (
          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <p className="text-xl font-bold">Scanning the market universe...</p>
            <p className="mt-2 text-zinc-400">
              Ranking price movement, liquidity, and relative volume.
            </p>
          </section>
        )}

        {error && (
          <section className="mt-8 rounded-2xl border border-red-800 bg-red-950/40 p-6">
            <p className="font-bold text-red-300">
              Market Discovery unavailable
            </p>
            <p className="mt-2 text-red-200">{error}</p>
          </section>
        )}

        {data && (
          <>
            {topCandidate && (
              <section className="mt-8 rounded-3xl border border-emerald-900 bg-linear-to-br from-emerald-950/40 to-zinc-950 p-6 md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
                      Today&apos;s Best Opportunity
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <h2 className="text-4xl font-bold">
                        {topCandidate.symbol}
                      </h2>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getDirectionClasses(
                          topCandidate.direction,
                        )}`}
                      >
                        {topCandidate.direction}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getScoreClasses(
                          topCandidate.score,
                        )}`}
                      >
                        {getScoreLabel(topCandidate.score)} Setup
                      </span>
                    </div>

                    <p className="mt-3 text-xl text-zinc-300">
                      {formatCurrency(topCandidate.price)} ·{" "}
                      <span
                        className={getChangeClasses(topCandidate.percentChange)}
                      >
                        {topCandidate.percentChange > 0 ? "+" : ""}
                        {topCandidate.percentChange.toFixed(2)}%
                      </span>
                    </p>

                    <p className="mt-4 max-w-2xl text-zinc-400">
                      Focus: {getTradeFocus(topCandidate.direction)}. Open the
                      scanner to confirm VWAP, market structure, news, and the
                      best liquid contract before entering.
                    </p>
                  </div>

                  <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-105">
                    <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                      <p className="text-sm text-zinc-500">Discovery Score</p>
                      <p className="mt-1 text-3xl font-bold">
                        {topCandidate.score}/100
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                      <p className="text-sm text-zinc-500">Relative Volume</p>
                      <p className="mt-1 text-3xl font-bold">
                        {topCandidate.relativeVolume.toFixed(2)}x
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                      <p className="text-sm text-zinc-500">Liquidity</p>
                      <p className="mt-1 text-xl font-bold">
                        {getLiquidityLabel(topCandidate.averageVolume)}
                      </p>
                    </div>

                    <Link
                      href={`/scanner?symbol=${encodeURIComponent(
                        topCandidate.symbol,
                      )}`}
                      className="flex items-center justify-center rounded-2xl bg-white p-4 text-center font-bold text-black transition hover:bg-zinc-200"
                    >
                      Confirm in Scanner
                    </Link>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Scanned</p>
                <p className="mt-2 text-3xl font-bold">{data.scanned}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Qualified</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">
                  {data.qualified}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Failed</p>
                <p className="mt-2 text-3xl font-bold text-yellow-300">
                  {data.failed}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Scan Time</p>
                <p className="mt-2 text-3xl font-bold">
                  {(data.durationMs / 1000).toFixed(1)}s
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">Discovery Status</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Updated {new Date(data.updatedAt).toLocaleTimeString()}
                  </p>
                </div>

                <span className="w-fit rounded-full border border-emerald-700 bg-emerald-950/50 px-3 py-1 text-xs font-bold text-emerald-300">
                  {data.cached ? "CACHED" : "LIVE SCAN"}
                </span>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition ${
                        active
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleCandidates.map((candidate, index) => (
                <article
                  key={`${activeTab}-${candidate.symbol}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-zinc-500">
                          #{index + 1}
                        </span>

                        <h2 className="text-2xl font-bold">
                          {candidate.symbol}
                        </h2>
                      </div>

                      <p className="mt-2 text-zinc-400">
                        {formatCurrency(candidate.price)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-zinc-500">Score</p>
                      <div
                        className={`mt-1 rounded-xl border px-3 py-2 ${getScoreClasses(
                          candidate.score,
                        )}`}
                      >
                        <p className="text-2xl font-bold">{candidate.score}</p>
                        <p className="text-xs font-bold">
                          {getScoreLabel(candidate.score)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black p-3">
                      <p className="text-xs text-zinc-500">Change</p>
                      <p
                        className={`mt-1 font-bold ${getChangeClasses(
                          candidate.percentChange,
                        )}`}
                      >
                        {candidate.percentChange > 0 ? "+" : ""}
                        {candidate.percentChange.toFixed(2)}%
                      </p>
                    </div>

                    <div className="rounded-xl bg-black p-3">
                      <p className="text-xs text-zinc-500">Relative Volume</p>
                      <p className="mt-1 font-bold">
                        {candidate.relativeVolume.toFixed(2)}x
                      </p>
                    </div>

                    <div className="rounded-xl bg-black p-3">
                      <p className="text-xs text-zinc-500">Liquidity</p>
                      <p className="mt-1 font-bold">
                        {getLiquidityLabel(candidate.averageVolume)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black p-3">
                      <p className="text-xs text-zinc-500">Trade Focus</p>
                      <p className="mt-1 font-bold">{candidate.direction}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getDirectionClasses(
                        candidate.direction,
                      )}`}
                    >
                      {candidate.direction}
                    </span>

                    <Link
                      href={`/scanner?symbol=${encodeURIComponent(
                        candidate.symbol,
                      )}`}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-zinc-200"
                    >
                      Open Scanner
                    </Link>
                  </div>

                  {candidate.reasons.length > 0 && (
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Why it ranked
                      </p>

                      <div className="mt-2 space-y-1">
                        {candidate.reasons.slice(0, 3).map((reason) => (
                          <p key={reason} className="text-sm text-zinc-400">
                            ✓ {reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>

            {visibleCandidates.length === 0 && (
              <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-xl font-bold">No qualifying setups found.</p>
                <p className="mt-2 text-zinc-400">
                  Refresh the market or try again during active trading hours.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

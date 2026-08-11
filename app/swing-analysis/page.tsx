"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type TrendDirection = "UPTREND" | "DOWNTREND" | "RANGE" | "UNKNOWN";

type SwingPoint = {
  index: number;
  datetime: string;
  price: number;
};

type TrendResult = {
  trend: TrendDirection;

  higherHigh: boolean;
  higherLow: boolean;

  lowerHigh: boolean;
  lowerLow: boolean;

  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];

  resistance: number | null;
  support: number | null;

  confidence: number;

  structureScore?: number;
  highTrendScore?: number;
  lowTrendScore?: number;
  closeSlopePercent?: number;

  bullishBreakout?: boolean;
  bearishBreakdown?: boolean;

  currentPrice?: number | null;

  reasons: string[];
};

type ZoneResult = {
  fibonacci: {
    high: number;
    low: number;

    level382: number;
    level500: number;
    level618: number;
    level786: number;
  } | null;

  location:
    | "SHALLOW_PULLBACK"
    | "EQUILIBRIUM"
    | "GOLDEN_ZONE"
    | "DEEP_RETRACEMENT"
    | "EXTENDED"
    | "UNKNOWN";

  nearSupport: boolean;
  nearResistance: boolean;

  reasons: string[];
};

type PriceActionResult = {
  bullishRejection: boolean;
  bearishRejection: boolean;

  strongBullishBody: boolean;
  strongBearishBody: boolean;

  bullishMomentum: boolean;
  bearishMomentum: boolean;

  volumeIncreasing: boolean;

  score: number;

  reasons: string[];
};

type SwingAnalysisResponse = {
  success: boolean;

  updatedAt?: string;

  dataSource?: string;

  symbol?: string;

  currentPrice?: number;

  bias?: "CALL" | "PUT" | "NEUTRAL";

  entryStatus?: "READY" | "WAIT";

  decision?: "CALL" | "PUT" | "WAIT";

  score?: number;

  nextAction?: string;

  candles?: {
    weekly: number;
    daily: number;
    hourly: number;
  };

  weekly?: TrendResult;
  daily?: TrendResult;
  hourly?: TrendResult;

  zones?: ZoneResult;

  dailyPriceAction?: PriceActionResult;

  hourlyPriceAction?: PriceActionResult;

  alignment?: {
    weeklyDaily: boolean;
    weeklyHourly: boolean;
    allAligned: boolean;
  };

  reasons?: string[];

  warnings?: string[];

  error?: string;
};

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `$${value.toFixed(2)}`;
}

function getBiasClasses(bias: "CALL" | "PUT" | "NEUTRAL" | undefined): string {
  if (bias === "CALL") {
    return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
  }

  if (bias === "PUT") {
    return "border-red-700 bg-red-950/40 text-red-300";
  }

  return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
}

function getEntryClasses(status: "READY" | "WAIT" | undefined): string {
  if (status === "READY") {
    return "text-emerald-400";
  }

  return "text-yellow-300";
}

function getTrendClasses(trend: TrendDirection | undefined): string {
  if (trend === "UPTREND") {
    return "text-emerald-400";
  }

  if (trend === "DOWNTREND") {
    return "text-red-400";
  }

  return "text-yellow-300";
}

function StructureRow({
  label,
  active,
}: {
  label: string;
  active: boolean | undefined;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-black/60 px-4 py-3">
      <span className="text-sm text-zinc-300">{label}</span>

      <span
        className={
          active ? "font-bold text-emerald-400" : "font-bold text-zinc-600"
        }
      >
        {active ? "✓" : "—"}
      </span>
    </div>
  );
}

function TimeframeCard({
  title,
  trend,
  confidence,
}: {
  title: string;
  trend?: TrendDirection;
  confidence?: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{title}</p>

      <p className={`mt-2 text-2xl font-bold ${getTrendClasses(trend)}`}>
        {trend || "UNKNOWN"}
      </p>

      <p className="mt-2 text-sm text-zinc-500">
        Confidence: {confidence ?? 0}/100
      </p>
    </div>
  );
}

export default function SwingAnalysisPage() {
  const [symbol, setSymbol] = useState("NVDA");

  const [analysis, setAnalysis] = useState<SwingAnalysisResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function analyzeSymbol(event?: FormEvent) {
    event?.preventDefault();

    const cleanSymbol = symbol.trim().toUpperCase();

    if (!cleanSymbol) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/swing-analysis?symbol=${encodeURIComponent(cleanSymbol)}`,
        {
          cache: "no-store",
        },
      );

      const data = (await response.json()) as SwingAnalysisResponse;

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Unable to analyze this symbol.");
      }

      setAnalysis(data);
      setSymbol(cleanSymbol);
    } catch (error) {
      setAnalysis(null);

      setError(
        error instanceof Error ? error.message : "Swing analysis failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const fibonacci = analysis?.zones?.fibonacci;

  const contractSelectorHref =
    analysis?.symbol && (analysis.bias === "CALL" || analysis.bias === "PUT")
      ? `/cheap-options?symbol=${encodeURIComponent(
          analysis.symbol,
        )}&direction=${analysis.bias}&strategy=swing`
      : null;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
            OptionPilot Intelligence
          </p>

          <h1 className="mt-2 text-4xl font-bold md:text-5xl">
            Swing Trade Analysis
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Weekly direction determines the swing bias. Daily structure confirms
            the setup. The 1-hour chart determines whether the entry is actually
            ready.
          </p>
        </header>

        <form
          onSubmit={analyzeSymbol}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="Enter symbol"
            className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-lg font-semibold text-white outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-emerald-500 px-7 py-4 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Swing"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-800 bg-red-950/40 p-5">
            <p className="font-bold text-red-300">Swing analysis unavailable</p>

            <p className="mt-2 text-sm text-red-200">{error}</p>
          </div>
        )}

        {!analysis && !loading && !error && (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-xl font-bold">Enter a stock or ETF to begin</p>

            <p className="mt-2 text-zinc-400">
              Try NVDA, SPY, QQQ, AMD, AAPL, MSFT, or another U.S. symbol.
            </p>
          </div>
        )}

        {analysis && (
          <>
            <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-zinc-500">
                    {analysis.dataSource || "Market Data"}
                  </p>

                  <h2 className="mt-1 text-4xl font-bold">{analysis.symbol}</h2>

                  <p className="mt-2 text-2xl font-semibold text-zinc-200">
                    {formatPrice(analysis.currentPrice)}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div
                    className={`min-w-47.5 rounded-2xl border px-6 py-5 text-center ${getBiasClasses(
                      analysis.bias,
                    )}`}
                  >
                    <p className="text-sm font-bold uppercase tracking-[0.15em]">
                      Swing Bias
                    </p>

                    <p className="mt-2 text-4xl font-black">
                      {analysis.bias || "NEUTRAL"}
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      {analysis.score ?? 0}
                      /100
                    </p>
                  </div>

                  <div className="min-w-47.5 rounded-2xl border border-zinc-700 bg-black px-6 py-5 text-center">
                    <p className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500">
                      Entry Status
                    </p>

                    <p
                      className={`mt-2 text-4xl font-black ${getEntryClasses(
                        analysis.entryStatus,
                      )}`}
                    >
                      {analysis.entryStatus || "WAIT"}
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                      Final decision: {analysis.decision || "WAIT"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-6">
                {contractSelectorHref ? (
                  <Link
                    href={contractSelectorHref}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-4 text-center text-base font-black text-black transition hover:bg-emerald-400 sm:w-auto"
                  >
                    Open AI Contract Selector →
                  </Link>
                ) : (
                  <div className="inline-flex rounded-2xl border border-zinc-800 bg-black px-6 py-4 text-sm font-bold text-zinc-500">
                    Contract Selector available after CALL or PUT bias
                  </div>
                )}

                {analysis.bias !== "NEUTRAL" && (
                  <p className="mt-3 text-sm text-zinc-500">
                    Sends {analysis.symbol} · {analysis.bias} · Swing strategy
                    to the AI Contract Selector.
                  </p>
                )}
              </div>
            </section>

            {analysis.nextAction && (
              <section className="mt-6 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5">
                <p className="text-sm font-bold uppercase tracking-[0.15em] text-emerald-400">
                  Next Action
                </p>

                <p className="mt-2 text-base leading-7 text-zinc-200">
                  {analysis.nextAction}
                </p>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-2xl font-bold">Timeframe Alignment</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TimeframeCard
                  title="Weekly — Head Coach"
                  trend={analysis.weekly?.trend}
                  confidence={analysis.weekly?.confidence}
                />

                <TimeframeCard
                  title="Daily — Setup"
                  trend={analysis.daily?.trend}
                  confidence={analysis.daily?.confidence}
                />

                <TimeframeCard
                  title="1 Hour — Entry"
                  trend={analysis.hourly?.trend}
                  confidence={analysis.hourly?.confidence}
                />
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-2xl font-bold">Weekly Market Structure</h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <StructureRow
                    label="Higher High"
                    active={analysis.weekly?.higherHigh}
                  />

                  <StructureRow
                    label="Higher Low"
                    active={analysis.weekly?.higherLow}
                  />

                  <StructureRow
                    label="Lower High"
                    active={analysis.weekly?.lowerHigh}
                  />

                  <StructureRow
                    label="Lower Low"
                    active={analysis.weekly?.lowerLow}
                  />

                  <StructureRow
                    label="Bullish Breakout"
                    active={analysis.weekly?.bullishBreakout}
                  />

                  <StructureRow
                    label="Bearish Breakdown"
                    active={analysis.weekly?.bearishBreakdown}
                  />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-black p-4">
                    <p className="text-xs text-zinc-500">Structure Score</p>

                    <p className="mt-1 text-xl font-bold">
                      {analysis.weekly?.structureScore ?? "--"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-black p-4">
                    <p className="text-xs text-zinc-500">Recent Close Slope</p>

                    <p className="mt-1 text-xl font-bold">
                      {analysis.weekly?.closeSlopePercent !== undefined
                        ? `${analysis.weekly.closeSlopePercent.toFixed(2)}%`
                        : "--"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-2xl font-bold">Key Levels</h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-black p-5">
                    <p className="text-sm text-zinc-500">Weekly Support</p>

                    <p className="mt-2 text-2xl font-bold">
                      {formatPrice(analysis.weekly?.support)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-black p-5">
                    <p className="text-sm text-zinc-500">Weekly Resistance</p>

                    <p className="mt-2 text-2xl font-bold">
                      {formatPrice(analysis.weekly?.resistance)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">
                    Current Swing Location
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    {analysis.zones?.location || "UNKNOWN"}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Fibonacci Retracement</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Daily swing location calculated from real market structure.
                  </p>
                </div>

                <span className="rounded-full border border-zinc-700 bg-black px-4 py-2 text-sm font-bold text-zinc-300">
                  {analysis.zones?.location || "UNKNOWN"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">0.382</p>

                  <p className="mt-2 text-xl font-bold">
                    {formatPrice(fibonacci?.level382)}
                  </p>
                </div>

                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">0.500</p>

                  <p className="mt-2 text-xl font-bold">
                    {formatPrice(fibonacci?.level500)}
                  </p>
                </div>

                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">0.618</p>

                  <p className="mt-2 text-xl font-bold text-emerald-400">
                    {formatPrice(fibonacci?.level618)}
                  </p>
                </div>

                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">0.786</p>

                  <p className="mt-2 text-xl font-bold">
                    {formatPrice(fibonacci?.level786)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-2xl font-bold">Daily Price Action</h2>

                <div className="mt-5 space-y-3">
                  <StructureRow
                    label="Bullish Rejection"
                    active={analysis.dailyPriceAction?.bullishRejection}
                  />

                  <StructureRow
                    label="Bearish Rejection"
                    active={analysis.dailyPriceAction?.bearishRejection}
                  />

                  <StructureRow
                    label="Strong Bullish Body"
                    active={analysis.dailyPriceAction?.strongBullishBody}
                  />

                  <StructureRow
                    label="Strong Bearish Body"
                    active={analysis.dailyPriceAction?.strongBearishBody}
                  />

                  <StructureRow
                    label="Bullish Momentum"
                    active={analysis.dailyPriceAction?.bullishMomentum}
                  />

                  <StructureRow
                    label="Bearish Momentum"
                    active={analysis.dailyPriceAction?.bearishMomentum}
                  />

                  <StructureRow
                    label="Volume Increasing"
                    active={analysis.dailyPriceAction?.volumeIncreasing}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-2xl font-bold">Hourly Entry Check</h2>

                <div className="mt-5 space-y-3">
                  <StructureRow
                    label="Bullish Rejection"
                    active={analysis.hourlyPriceAction?.bullishRejection}
                  />

                  <StructureRow
                    label="Bearish Rejection"
                    active={analysis.hourlyPriceAction?.bearishRejection}
                  />

                  <StructureRow
                    label="Strong Bullish Body"
                    active={analysis.hourlyPriceAction?.strongBullishBody}
                  />

                  <StructureRow
                    label="Strong Bearish Body"
                    active={analysis.hourlyPriceAction?.strongBearishBody}
                  />

                  <StructureRow
                    label="Bullish Momentum"
                    active={analysis.hourlyPriceAction?.bullishMomentum}
                  />

                  <StructureRow
                    label="Bearish Momentum"
                    active={analysis.hourlyPriceAction?.bearishMomentum}
                  />

                  <StructureRow
                    label="Volume Increasing"
                    active={analysis.hourlyPriceAction?.volumeIncreasing}
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-emerald-900/60 bg-zinc-900 p-6">
                <h2 className="text-2xl font-bold text-emerald-400">
                  Why OptionPilot Likes This Setup
                </h2>

                <div className="mt-5 space-y-3">
                  {(analysis.reasons || []).length > 0 ? (
                    analysis.reasons?.map((reason, index) => (
                      <div
                        key={`${reason}-${index}`}
                        className="rounded-xl bg-black px-4 py-3 text-sm text-zinc-300"
                      >
                        ✓ {reason}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No major positive confirmations yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-yellow-900/60 bg-zinc-900 p-6">
                <h2 className="text-2xl font-bold text-yellow-300">
                  Warnings / Reasons to Wait
                </h2>

                <div className="mt-5 space-y-3">
                  {(analysis.warnings || []).length > 0 ? (
                    analysis.warnings?.map((warning, index) => (
                      <div
                        key={`${warning}-${index}`}
                        className="rounded-xl bg-black px-4 py-3 text-sm text-zinc-300"
                      >
                        ⚠ {warning}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No major timeframe warnings detected.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-2xl font-bold">Data Verification</h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                This Swing Engine uses real OHLCV candles from Twelve Data.
                OptionPilot calculates the trend, market structure, Fibonacci,
                price action, breakout/breakdown, and timeframe alignment from
                those candles.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">Weekly Candles</p>

                  <p className="mt-2 text-2xl font-bold">
                    {analysis.candles?.weekly ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">Daily Candles</p>

                  <p className="mt-2 text-2xl font-bold">
                    {analysis.candles?.daily ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-black p-5">
                  <p className="text-sm text-zinc-500">Hourly Candles</p>

                  <p className="mt-2 text-2xl font-bold">
                    {analysis.candles?.hourly ?? 0}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

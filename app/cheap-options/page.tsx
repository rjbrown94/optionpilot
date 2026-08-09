"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTradeContext } from "@/components/providers/TradeContext";

type StrategyProfile = "day" | "swing" | "leaps";

type OptimizedContract = {
  stock: string;
  stockPrice: number;
  contractSymbol: string;
  type: "CALL" | "PUT";
  strike: number;
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  premium: number;
  spreadPercent: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  breakEvenPrice: number | null;
  score: number;
  rating: "Excellent" | "Strong" | "Watch" | "Avoid";
  reasons: string[];
  warnings: string[];
};

type BestContractsBySymbol = {
  symbol: string;
  stockPrice: number;
  bestCall: OptimizedContract | null;
  bestPut: OptimizedContract | null;
};

type OptimizerResponse = {
  success?: boolean;
  results?: BestContractsBySymbol[];
  error?: string;
};

type RecommendationStatus = "CONTRACT READY" | "WATCH" | "AVOID";

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `$${value.toFixed(2)}`;
}

function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function scoreClasses(rating: OptimizedContract["rating"]): string {
  if (rating === "Excellent") return "text-emerald-400";
  if (rating === "Strong") return "text-yellow-400";
  if (rating === "Watch") return "text-orange-400";
  return "text-red-400";
}

function borderClasses(rating: OptimizedContract["rating"]): string {
  if (rating === "Excellent") return "border-emerald-700";
  if (rating === "Strong") return "border-yellow-700";
  if (rating === "Watch") return "border-orange-700";
  return "border-red-800";
}

function getRecommendationStatus(
  contract: OptimizedContract,
): RecommendationStatus {
  if (
    contract.score >= 85 &&
    contract.spreadPercent !== null &&
    contract.spreadPercent <= 10 &&
    contract.openInterest >= 1_000 &&
    contract.volume >= 500
  ) {
    return "CONTRACT READY";
  }

  if (contract.score >= 60) {
    return "WATCH";
  }

  return "AVOID";
}

function getRecommendationClasses(status: RecommendationStatus): string {
  if (status === "CONTRACT READY") {
    return "border-emerald-700 bg-emerald-950/30 text-emerald-300";
  }

  if (status === "WATCH") {
    return "border-yellow-700 bg-yellow-950/30 text-yellow-300";
  }

  return "border-red-800 bg-red-950/30 text-red-300";
}

function getExpectedHold(strategy: StrategyProfile): string {
  if (strategy === "day") return "Intraday";
  if (strategy === "leaps") return "6–24 months";
  return "Several days to several weeks";
}

function ContractCard({
  title,
  contract,
  onSelect,
}: {
  title: string;
  contract: OptimizedContract | null;
  onSelect: (contract: OptimizedContract) => void;
}) {
  if (!contract) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-black p-5">
        <p className="font-bold text-zinc-300">{title}</p>
        <p className="mt-3 text-sm text-zinc-500">
          No contract matched this strategy.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-black p-5 ${borderClasses(
        contract.rating,
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-zinc-500">{title}</p>

          <p className="mt-1 text-xl font-bold">
            ${contract.strike.toFixed(2)} {contract.type}
          </p>

          <p className="mt-1 text-sm text-zinc-400">
            {contract.expiration} · {contract.dte} DTE
          </p>
        </div>

        <div className="text-right">
          <p className={`text-2xl font-bold ${scoreClasses(contract.rating)}`}>
            {contract.score}/100
          </p>

          <p className="text-xs text-zinc-500">{contract.rating}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-zinc-500">Premium</p>
          <p className="font-bold text-emerald-400">
            {money(contract.premium)}
          </p>
        </div>

        <div>
          <p className="text-xs text-zinc-500">Delta</p>
          <p className="font-bold">{contract.delta?.toFixed(2) ?? "--"}</p>
        </div>

        <div>
          <p className="text-xs text-zinc-500">IV</p>
          <p className="font-bold">{percent(contract.impliedVolatility)}</p>
        </div>

        <div>
          <p className="text-xs text-zinc-500">Spread</p>
          <p className="font-bold">
            {contract.spreadPercent === null
              ? "--"
              : `${contract.spreadPercent.toFixed(1)}%`}
          </p>
        </div>

        <div>
          <p className="text-xs text-zinc-500">Volume</p>
          <p className="font-bold">{contract.volume.toLocaleString()}</p>
        </div>

        <div>
          <p className="text-xs text-zinc-500">Open Interest</p>
          <p className="font-bold">{contract.openInterest.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {contract.reasons.slice(0, 3).map((reason) => (
          <p key={reason} className="text-sm text-zinc-300">
            ✓ {reason}
          </p>
        ))}

        {contract.reasons.length === 0 && (
          <p className="text-sm text-zinc-500">
            No strong quality confirmations were available.
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onSelect(contract)}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm font-bold text-black"
        >
          Details
        </button>

        <Link
          href={`/scanner?symbol=${encodeURIComponent(contract.stock)}`}
          className="rounded-lg bg-white px-3 py-2 text-center text-sm font-bold text-black"
        >
          Scanner
        </Link>
      </div>
    </div>
  );
}

function CheapOptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tradeContext = useTradeContext();

  const requestedSymbol =
    searchParams.get("symbol")?.toUpperCase() || tradeContext.symbol;
  const requestedDirection =
    searchParams.get("direction")?.toUpperCase() || tradeContext.direction;
  const requestedStrategy =
    (searchParams.get("strategy") as StrategyProfile | null) ||
    tradeContext.strategy;

  const [strategy, setLocalStrategy] =
    useState<StrategyProfile>(requestedStrategy);
  const [symbols, setSymbols] = useState(
    requestedSymbol || "SPY,QQQ,NVDA,AMD,AAPL,MSFT,META,AMZN,TSLA,PLTR",
  );
  const [results, setResults] = useState<BestContractsBySymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function updateStrategy(nextStrategy: StrategyProfile): void {
    setLocalStrategy(nextStrategy);
    tradeContext.setStrategy(nextStrategy);
  }

  function selectAndReview(contract: OptimizedContract): void {
    tradeContext.selectContract({
      contractSymbol: contract.contractSymbol,
      stock: contract.stock,
      type: contract.type,
      strike: contract.strike,
      expiration: contract.expiration,
      premium: contract.premium,
      stockPrice: contract.stockPrice,
      score: contract.score,
      volume: contract.volume,
      openInterest: contract.openInterest,
      bid: contract.bid,
      ask: contract.ask,
      spreadPercent: contract.spreadPercent,
      impliedVolatility: contract.impliedVolatility,
      delta: contract.delta,
      gamma: contract.gamma,
      theta: contract.theta,
      vega: contract.vega,
      breakEvenPrice: contract.breakEvenPrice,
    });

    router.push("/option-details");
  }

  async function optimize(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        strategy,
        symbols,
      });

      const response = await fetch(`/api/cheap-options?${params.toString()}`, {
        cache: "no-store",
      });

      const text = await response.text();

      if (!text.trim()) {
        throw new Error("AI Contract Selector returned an empty response.");
      }

      const payload = JSON.parse(text) as OptimizerResponse;

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "AI Contract Selector failed.");
      }

      setResults(payload.results ?? []);
    } catch (caught) {
      setResults([]);
      setError(
        caught instanceof Error
          ? caught.message
          : "AI Contract Selector failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void optimize();
  }, []);

  const topContract = useMemo(() => {
    const contracts = results.flatMap((item) =>
      [item.bestCall, item.bestPut].filter(
        (contract): contract is OptimizedContract => contract !== null,
      ),
    );

    const directionContracts =
      requestedDirection === "CALL" || requestedDirection === "PUT"
        ? contracts.filter((contract) => contract.type === requestedDirection)
        : contracts;

    return (
      directionContracts.sort(
        (first, second) => second.score - first.score,
      )[0] ?? null
    );
  }, [results, requestedDirection]);

  const recommendationStatus = topContract
    ? getRecommendationStatus(topContract)
    : null;

  return (
    <main className="min-h-screen bg-black p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
              OptionPilot Contract Intelligence
            </p>

            <h1 className="mt-2 text-4xl font-bold md:text-5xl">
              AI Contract Selector
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Find one best call and one best put per stock using Massive
              snapshot data, Greeks, IV, liquidity, and strategy-specific
              expiration rules.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void optimize()}
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black disabled:opacity-60"
          >
            {loading ? "Optimizing..." : "Find Best Contracts"}
          </button>
        </header>

        <section className="mt-8 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-3">
          <label>
            <span className="text-sm text-zinc-400">Strategy</span>

            <select
              value={strategy}
              onChange={(event) =>
                updateStrategy(event.target.value as StrategyProfile)
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3"
            >
              <option value="day">Day Trade</option>
              <option value="swing">Swing Trade</option>
              <option value="leaps">LEAPS</option>
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="text-sm text-zinc-400">Symbols</span>

            <input
              value={symbols}
              onChange={(event) => setSymbols(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3"
            />
          </label>
        </section>

        {topContract && recommendationStatus && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-400">
                  Final Contract Recommendation
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  {topContract.stock} {topContract.strike.toFixed(2)}{" "}
                  {topContract.type}
                </h2>

                <p className="mt-2 text-zinc-300">
                  {topContract.expiration} · {topContract.dte} DTE · Premium{" "}
                  {money(topContract.premium)}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-end">
                <span
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${getRecommendationClasses(
                    recommendationStatus,
                  )}`}
                >
                  {recommendationStatus}
                </span>

                <p
                  className={`text-4xl font-bold ${scoreClasses(
                    topContract.rating,
                  )}`}
                >
                  {topContract.score}/100
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-black p-4">
                <p className="text-xs text-zinc-500">Best For</p>
                <p className="mt-1 font-bold capitalize">
                  {strategy === "day"
                    ? "Day Trade"
                    : strategy === "leaps"
                      ? "LEAPS"
                      : "Swing Trade"}
                </p>
              </div>

              <div className="rounded-xl bg-black p-4">
                <p className="text-xs text-zinc-500">Expected Hold</p>
                <p className="mt-1 font-bold">{getExpectedHold(strategy)}</p>
              </div>

              <div className="rounded-xl bg-black p-4">
                <p className="text-xs text-zinc-500">Direction</p>
                <p className="mt-1 font-bold">{topContract.type}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4">
              <p className="text-sm font-bold text-white">
                Why this contract ranked first
              </p>

              <div className="mt-2 space-y-1">
                {topContract.reasons.slice(0, 5).map((reason) => (
                  <p key={reason} className="text-sm text-zinc-300">
                    ✓ {reason}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-yellow-900 bg-yellow-950/20 p-4">
              <p className="font-bold text-yellow-300">
                Final check before entry
              </p>

              <p className="mt-2 text-sm text-zinc-300">
                This recommendation measures contract quality. It does not prove
                that the market direction is correct. Open Smart Money and the
                Scanner, then enter only when the flow and technical signal
                agree with the {topContract.type} direction.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Link
                href="/smart-money"
                className="rounded-xl border border-emerald-700 bg-emerald-950/30 px-4 py-3 text-center font-bold text-emerald-300"
              >
                Check Smart Money
              </Link>

              <Link
                href={`/scanner?symbol=${encodeURIComponent(
                  topContract.stock,
                )}`}
                className="rounded-xl bg-white px-4 py-3 text-center font-bold text-black"
              >
                Confirm in Scanner
              </Link>

              <button
                type="button"
                onClick={() => selectAndReview(topContract)}
                className="rounded-xl bg-emerald-500 px-4 py-3 text-center font-bold text-black"
              >
                Review Contract
              </button>
            </div>
          </section>
        )}

        {error && (
          <section className="mt-6 rounded-2xl border border-red-800 bg-red-950/40 p-5 text-red-200">
            {error}
          </section>
        )}

        {!loading && !error && results.length === 0 && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">
            No contracts were returned for this strategy.
          </section>
        )}

        <div className="mt-6 space-y-6">
          {results.map((item) => (
            <section
              key={item.symbol}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <div className="mb-5">
                <h2 className="text-3xl font-bold">{item.symbol}</h2>

                <p className="text-zinc-400">
                  Underlying: {money(item.stockPrice)}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <ContractCard
                  title="Best Call"
                  contract={item.bestCall}
                  onSelect={selectAndReview}
                />

                <ContractCard
                  title="Best Put"
                  contract={item.bestPut}
                  onSelect={selectAndReview}
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
export default function CheapOptionsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black p-8 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              Loading AI Contract Selector...
            </div>
          </div>
        </main>
      }
    >
      <CheapOptionsContent />
    </Suspense>
  );
}

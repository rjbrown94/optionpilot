"use client";

import { useState } from "react";

export type DecisionTimeframe = "DAY_TRADE" | "SWING" | "LEAPS";

export type DecisionFlowTrade = {
  underlying: string;
  direction: "CALLS" | "PUTS";
  premium: number;
  timestamp: number;
};

type TechnicalResponse = {
  success: boolean;
  signal?: "CALL READY" | "PUT READY" | "WAIT";
  score?: number;
  price?: number;
  vwap?: number;
  ema9?: number;
  ema20?: number;
  relativeVolume?: number;
  latestCandleTime?: string | null;
  latestCandleAgeMinutes?: number | null;
  stale?: boolean;
  warnings?: string[];
  error?: string;
};

type GexResponse = {
  success: boolean;
  complete?: boolean;
  stale?: boolean;
  warning?: string | null;
  error?: string;
  gex?: {
    totalNetGex: number;
    largestConcentration: { strike: number } | null;
  };
};

type Decision = "CALL SETUP" | "PUT SETUP" | "WAIT";

type Analysis = {
  symbol: string;
  timeframe: DecisionTimeframe;
  decision: Decision;
  reasons: string[];
  technical: TechnicalResponse | null;
  gex: GexResponse | null;
  calls: number;
  puts: number;
};

function dollars(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

function regularMarketOpen(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (name: string) =>
    parts.find((part) => part.type === name)?.value ?? "";

  if (["Sat", "Sun"].includes(get("weekday"))) return false;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return minutes >= 570 && minutes < 960;
}

function timestampMs(value: number): number {
  return value < 1e12 ? value * 1000 : value;
}

export default function TradeDecisionPanel({
  trades,
  symbols,
  timeframe,
}: {
  trades: DecisionFlowTrade[];
  symbols: string[];
  timeframe: DecisionTimeframe;
}) {
  const [selected, setSelected] = useState("");
  const [manualTicker, setManualTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const symbol = selected || symbols[0] || "";
  const visibleAnalysis =
    analysis?.symbol === symbol && analysis.timeframe === timeframe
      ? analysis
      : null;

  async function analyze() {
    if (!symbol || loading) return;
    setLoading(true);
    setAnalysis(null);

    const reasons: string[] = [];
    let technical: TechnicalResponse | null = null;
    let gex: GexResponse | null = null;

    const now = Date.now();
    const recent = trades.filter((trade) => {
      const age = now - timestampMs(trade.timestamp);
      return (
        trade.underlying === symbol &&
        Number.isFinite(trade.premium) &&
        trade.premium > 0 &&
        age >= 0 &&
        age <= 30 * 60_000
      );
    });

    const calls = recent
      .filter((trade) => trade.direction === "CALLS")
      .reduce((sum, trade) => sum + trade.premium, 0);
    const puts = recent
      .filter((trade) => trade.direction === "PUTS")
      .reduce((sum, trade) => sum + trade.premium, 0);

    const mode = timeframe === "DAY_TRADE" ? "day" : "swing";

    const [technicalResult, gexResult] = await Promise.allSettled([
      fetch(`/api/trade-confirmation?symbol=${encodeURIComponent(symbol)}`, {
        cache: "no-store",
      }).then(async (response) => {
        const data = (await response.json()) as TechnicalResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Technical data unavailable");
        }
        return data;
      }),
      timeframe === "LEAPS"
        ? Promise.resolve(null)
        : fetch(
            `/api/gex?symbol=${encodeURIComponent(symbol)}&mode=${mode}`,
            { cache: "no-store" },
          ).then(async (response) => {
            const data = (await response.json()) as GexResponse;
            if (!response.ok || !data.success || !data.gex) {
              throw new Error(data.error || "GEX unavailable");
            }
            return data;
          }),
    ]);

    if (technicalResult.status === "fulfilled") {
      technical = technicalResult.value;
    } else {
      reasons.push("Technical confirmation is unavailable.");
    }

    if (gexResult.status === "fulfilled") {
      gex = gexResult.value;
    } else {
      reasons.push("GEX positioning data is unavailable.");
    }

    const isOpen = regularMarketOpen();
    if (!isOpen) reasons.push("Regular US stock-market hours are closed.");

    const candleAge = technical?.latestCandleAgeMinutes;
    const candleTime = technical?.latestCandleTime;
    const parsedCandleTime =
      typeof candleTime === "string" ? Date.parse(candleTime) : NaN;
    const actualAgeMs = Date.now() - parsedCandleTime;

    const candleFresh =
      typeof candleAge === "number" &&
      Number.isFinite(candleAge) &&
      candleAge >= 0 &&
      candleAge <= 10 &&
      Number.isFinite(parsedCandleTime) &&
      actualAgeMs >= -60_000 &&
      actualAgeMs <= 10 * 60_000 &&
      technical?.stale === false;

    if (technical && !candleFresh) {
      reasons.push("The latest 5-minute chart candle is missing or stale.");
    }

    const gexUsable =
      timeframe !== "LEAPS" &&
      gex?.success === true &&
      gex.complete === true &&
      gex.stale === false &&
      !!gex.gex &&
      !gex.warning;

    if (timeframe === "LEAPS") {
      reasons.push("LEAPS-specific GEX is not supported yet.");
    } else if (gex && !gexUsable) {
      reasons.push("GEX coverage is incomplete, stale, or has warnings.");
    }

    const callsLead = calls >= 10_000 && calls >= puts * 1.5;
    const putsLead = puts >= 10_000 && puts >= calls * 1.5;

    if (calls + puts === 0) {
      reasons.push("No recent captured options flow for this stock.");
    } else if (!callsLead && !putsLead) {
      reasons.push("Captured premiums lack a clear 1.5x directional lead.");
    }

    let decision: Decision = "WAIT";

    if (
      isOpen &&
      candleFresh &&
      gexUsable &&
      technical?.signal === "CALL READY" &&
      callsLead
    ) {
      decision = "CALL SETUP";
      reasons.push("Fresh bullish chart confirmation aligns with captured call premium.");
    } else if (
      isOpen &&
      candleFresh &&
      gexUsable &&
      technical?.signal === "PUT READY" &&
      putsLead
    ) {
      decision = "PUT SETUP";
      reasons.push("Fresh bearish chart confirmation aligns with captured put premium.");
    } else {
      reasons.push("The required chart, flow, and data-quality checks are not all aligned.");
    }

    setAnalysis({
      symbol,
      timeframe,
      decision,
      reasons,
      technical,
      gex,
      calls,
      puts,
    });
    setLoading(false);
  }

  return (
    <section
      className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-white"
      aria-label="Trade Decision Panel"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
        OptionPilot Intelligence
      </p>
      <h2 className="mt-2 text-2xl font-bold">Trade Decision Panel</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Review captured options flow, estimated gamma exposure, and
        5-minute technical confirmation for one stock.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = manualTicker.trim().toUpperCase();
            if (/^[A-Z]{1,6}$/.test(next)) {
              setSelected(next);
              setAnalysis(null);
            }
          }}
        >
          <input
            aria-label="Enter stock ticker"
            placeholder="Ticker (SPY, NVDA...)"
            value={manualTicker}
            onChange={(event) => setManualTicker(event.target.value.toUpperCase())}
            maxLength={6}
            className="w-52 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-white"
          />
          <button
            type="submit"
            disabled={!/^[A-Z]{1,6}$/.test(manualTicker.trim()) || loading}
            className="rounded-lg border border-emerald-500 px-4 py-2 font-semibold text-emerald-300 disabled:opacity-50"
          >
            Select Ticker
          </button>
        </form>
        <select
          aria-label="Select stock to analyze"
          value={symbol}
          onChange={(event) => {
            setSelected(event.target.value);
            setAnalysis(null);
          }}
          className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-white"
        >
          {symbols.length === 0 && !selected && (
            <option value="">No stocks captured yet</option>
          )}
          {selected && !symbols.includes(selected) && (
            <option value={selected}>{selected} (Manual)</option>
          )}
          {symbols.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={!symbol || loading}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze Stock"}
        </button>
      </div>

      {visibleAnalysis && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold">{visibleAnalysis.symbol}</h3>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                visibleAnalysis.decision === "CALL SETUP"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : visibleAnalysis.decision === "PUT SETUP"
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {visibleAnalysis.decision}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-black/40 p-4">
              <p className="text-xs text-zinc-400">Chart score</p>
              <p className="mt-1 text-xl font-bold">
                {visibleAnalysis.technical?.score ?? "—"}/100
              </p>
              <p className="text-xs text-zinc-400">
                {visibleAnalysis.technical?.signal ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-xl bg-black/40 p-4">
              <p className="text-xs text-zinc-400">Recent captured premium</p>
              <p className="mt-1 text-sm text-emerald-300">
                Calls: {dollars(visibleAnalysis.calls)}
              </p>
              <p className="text-sm text-rose-300">
                Puts: {dollars(visibleAnalysis.puts)}
              </p>
            </div>
            <div className="rounded-xl bg-black/40 p-4">
              <p className="text-xs text-zinc-400">Estimated net GEX</p>
              <p className="mt-1 text-xl font-bold">
                {visibleAnalysis.gex?.gex
                  ? dollars(visibleAnalysis.gex.gex.totalNetGex)
                  : "Unavailable"}
              </p>
              <p className="text-xs text-zinc-400">
                Largest strike:{" "}
                {visibleAnalysis.gex?.gex?.largestConcentration?.strike ?? "—"}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="font-semibold">Why this result?</h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
              {visibleAnalysis.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
            {!!visibleAnalysis.technical?.warnings?.length && (
              <p className="mt-3 text-xs text-amber-300">
                Chart warnings: {visibleAnalysis.technical.warnings.join("; ")}
              </p>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Options flow does not prove institutional trade intent.
            GEX is an open-interest-based estimate, not confirmed dealer
            positioning. A setup is not a recommendation to place an order.
          </p>
        </div>
      )}
    </section>
  );
}

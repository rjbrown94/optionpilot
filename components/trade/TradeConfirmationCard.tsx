"use client";

import { useEffect, useState } from "react";

type TradeConfirmation = {
  symbol: string;
  signal: "CALL READY" | "PUT READY" | "WAIT";
  direction: "Bullish" | "Bearish" | "Mixed";
  score: number;
  price: number;
  vwap: number;
  ema9: number;
  ema20: number;
  relativeVolume: number;
  confirmations: string[];
  warnings: string[];
};

type TradeConfirmationCardProps = {
  symbol: string;
};

function isBullishSignal(signal: string): boolean {
  const normalized = signal.toLowerCase();

  return (
    normalized.includes("above vwap") ||
    normalized.includes("higher high") ||
    normalized.includes("higher low") ||
    normalized.includes("9 ema above 20 ema")
  );
}

function isBearishSignal(signal: string): boolean {
  const normalized = signal.toLowerCase();

  return (
    normalized.includes("below vwap") ||
    normalized.includes("lower high") ||
    normalized.includes("lower low") ||
    normalized.includes("9 ema below 20 ema")
  );
}

function isVolumeSignal(signal: string): boolean {
  return signal.toLowerCase().includes("volume");
}

export default function TradeConfirmationCard({
  symbol,
}: TradeConfirmationCardProps) {
  const [trade, setTrade] = useState<TradeConfirmation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadConfirmation() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/trade-confirmation?symbol=${encodeURIComponent(symbol)}`,
          {
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load confirmation");
        }

        if (!cancelled) {
          setTrade(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setTrade(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load confirmation",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConfirmation();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
        Loading live trade confirmation...
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="mt-6 rounded-2xl border border-red-900/50 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white">
          Trade Confirmation Unavailable
        </h2>

        <p className="mt-2 text-sm text-red-400">
          {error || "No confirmation data was returned."}
        </p>
      </div>
    );
  }

  const bullishSignals = trade.confirmations.filter(isBullishSignal);
  const bearishSignals = trade.confirmations.filter(isBearishSignal);
  const volumeSignals = trade.confirmations.filter(isVolumeSignal);

  const signalClasses =
    trade.signal === "CALL READY"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : trade.signal === "PUT READY"
        ? "border-red-500/40 bg-red-500/10 text-red-400"
        : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400";

  const directionClasses =
    trade.direction === "Bullish"
      ? "text-emerald-400"
      : trade.direction === "Bearish"
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">Live 5-Minute Confirmation</p>

          <h2 className="mt-1 text-2xl font-bold">
            {trade.symbol} Confirmation
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            VWAP, market structure, EMA alignment, and relative volume
          </p>

          <p className={`mt-2 text-sm font-bold ${directionClasses}`}>
            Current direction: {trade.direction}
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-sm font-bold ${signalClasses}`}
        >
          {trade.signal}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-black/30 p-4">
          <p className="text-xs text-zinc-500">Current Price</p>
          <p className="mt-1 text-lg font-bold">${trade.price.toFixed(2)}</p>
        </div>

        <div className="rounded-xl bg-black/30 p-4">
          <p className="text-xs text-zinc-500">VWAP</p>
          <p className="mt-1 text-lg font-bold">${trade.vwap.toFixed(2)}</p>
        </div>

        <div className="rounded-xl bg-black/30 p-4">
          <p className="text-xs text-zinc-500">9 EMA / 20 EMA</p>
          <p className="mt-1 text-sm font-bold">
            {trade.ema9.toFixed(2)} / {trade.ema20.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-black/30 p-4">
          <p className="text-xs text-zinc-500">Relative Volume</p>
          <p className="mt-1 text-lg font-bold">
            {(trade.relativeVolume * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-bold text-emerald-400">Bullish Signals</h3>

          <div className="space-y-2">
            {bullishSignals.length > 0 ? (
              bullishSignals.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                >
                  <span className="font-bold text-emerald-400">✓</span>
                  <p className="text-sm text-zinc-200">{item}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                <p className="text-sm text-zinc-500">
                  No bullish confirmations detected.
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-red-400">Bearish Signals</h3>

          <div className="space-y-2">
            {bearishSignals.length > 0 ? (
              bearishSignals.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3"
                >
                  <span className="font-bold text-red-400">↓</span>
                  <p className="text-sm text-zinc-200">{item}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                <p className="text-sm text-zinc-500">
                  No bearish confirmations detected.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {volumeSignals.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-bold text-blue-400">Volume Confirmation</h3>

          <div className="space-y-2">
            {volumeSignals.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3"
              >
                <span className="font-bold text-blue-400">V</span>
                <p className="text-sm text-zinc-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {trade.warnings.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-bold text-yellow-400">Warnings</h3>

          <div className="space-y-2">
            {trade.warnings.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3"
              >
                <span className="font-bold text-yellow-400">!</span>
                <p className="text-sm text-zinc-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-black/40 p-5">
        <p className="text-sm text-zinc-500">Trade Score</p>

        <div className="mt-2 flex items-end justify-between gap-4">
          <p className="text-4xl font-bold">{trade.score}/100</p>

          <p className={`text-xl font-bold ${directionClasses}`}>
            {trade.signal}
          </p>
        </div>
      </div>
    </div>
  );
}

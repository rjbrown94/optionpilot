"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Mode = "day" | "swing" | "full";
type GexResponse = {
  success: boolean;
  symbol?: string;
  mode?: string;
  updatedAt?: string;
  complete?: boolean;
  stale?: boolean;
  pagesFetched?: number;
  contractsFetched?: number;
  warning?: string | null;
  error?: string;
  gex?: {
    underlyingPrice: number;
    totalNetGex: number;
    totalAbsoluteGex: number;
    eligibleContracts: number;
    excludedContracts: number;
    largestConcentration: { strike: number; netGex: number; absoluteGex: number } | null;
  };
};

function money(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  const unit = magnitude >= 1e12 ? "T" : magnitude >= 1e9 ? "B" : magnitude >= 1e6 ? "M" : magnitude >= 1e3 ? "K" : "";
  const divisor = unit === "T" ? 1e12 : unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1;
  return `${value < 0 ? "−" : ""}$${(magnitude / divisor).toFixed(unit ? 2 : 0)}${unit}`;
}

export default function GammaExposureRadar() {
  const [input, setInput] = useState("SPY");
  const [symbol, setSymbol] = useState("SPY");
  const [mode, setMode] = useState<Mode>("day");
  const [data, setData] = useState<GexResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const response = await fetch(`/api/gex?symbol=${encodeURIComponent(symbol)}&mode=${mode}`, {
        signal,
        cache: "no-store",
      });
      const result = (await response.json()) as GexResponse;
      if (!response.ok || !result.success || !result.gex) {
        throw new Error(result.error || "Unable to load GEX data.");
      }
      if (!signal.aborted) setData(result);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "GEX request failed.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [symbol, mode]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);

  function submitSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim().toUpperCase();
    if (!/^[A-Z]{1,6}$/.test(next)) {
      setError("Enter a stock ticker using 1–6 letters.");
      return;
    }
    if (next === symbol) setRevision((current) => current + 1);
    else setSymbol(next);
  }

  const gex = data?.gex;
  const concentration = gex?.largestConcentration;

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5" aria-label="Gamma Exposure Radar">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Options positioning context</p>
          <h2 className="mt-1 text-2xl font-bold">Gamma Exposure Radar</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Estimated exposure from Massive options snapshots. Call-positive / put-negative open-interest model, not verified dealer positioning.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form onSubmit={submitSymbol} className="flex gap-2">
            <input aria-label="GEX stock symbol" value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} maxLength={6} className="w-24 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white" />
            <button type="submit" className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-black">Load</button>
          </form>
          <button type="button" onClick={() => setRevision((current) => current + 1)} disabled={loading} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50">Refresh</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["day", "swing", "full"] as const).map((option) => (
          <button key={option} type="button" onClick={() => setMode(option)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode === option ? "border-emerald-400 bg-emerald-500 text-black" : "border-zinc-700 bg-black text-zinc-300"}`}>
            {option === "day" ? "Day · 0–7 DTE" : option === "swing" ? "Swing · 8–60 DTE" : "Full chain"}
          </button>
        ))}
      </div>

      {loading && <p className="mt-5 text-sm text-zinc-400" role="status">Loading {symbol} gamma exposure…</p>}
      {error && <p className="mt-5 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
      {data && gex && !loading && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Estimated net GEX" value={money(gex.totalNetGex)} note="USD per 1% underlying move" />
            <Metric label="Largest concentration" value={concentration ? `$${concentration.strike.toLocaleString()}` : "—"} note={concentration ? `Absolute GEX ${money(concentration.absoluteGex)}` : "No eligible strike"} />
            <Metric label="Chain coverage" value={data.complete ? "Complete" : "Partial"} note={`${data.pagesFetched ?? "—"} pages · ${(data.contractsFetched ?? 0).toLocaleString()} fetched`} />
            <Metric label="Eligible contracts" value={gex.eligibleContracts.toLocaleString()} note={`${gex.excludedContracts.toLocaleString()} excluded`} />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
            <span>{symbol} spot: {Number.isFinite(gex.underlyingPrice) ? `$${gex.underlyingPrice.toFixed(2)}` : "—"}</span>
            <span>Snapshot retrieved: {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "Unknown"}</span>
            {data.stale && <span className="font-semibold text-amber-300">Cached / stale</span>}
          </div>
          {(data.warning || !data.complete) && <p className="mt-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">{data.warning || "Options-chain coverage is incomplete. Do not treat these totals as full-window exposure."}</p>}
        </>
      )}
      <p className="mt-4 text-xs text-zinc-500">Negative GEX does not mean the stock will fall. A strike-profile zero crossing is not a dealer gamma flip. Verify prices and market timestamps before trading.</p>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

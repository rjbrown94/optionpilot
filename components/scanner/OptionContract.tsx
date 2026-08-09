"use client";

import { useLiveOption } from "@/hooks/useLiveOption";

type OptionContractProps = {
  available: boolean;
  symbol?: string | null;
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
};

function valueOrDash(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value)
    ? "--"
    : value.toFixed(decimals);
}

export default function OptionContract({
  available,
  symbol = null,
  type,
  strike,
  expiration,
  premium,
  bid,
  ask,
  spreadPercent,
  volume,
  openInterest,
  delta,
}: OptionContractProps) {
  const live = useLiveOption(symbol);

  const displayPremium = live.premium ?? premium;
  const displayBid = live.bid ?? bid;
  const displayAsk = live.ask ?? ask;
  const displaySpreadPercent = live.spreadPercent ?? spreadPercent;
  const displayVolume = live.volume ?? volume;

  const liveConnected =
    available && Boolean(symbol) && live.status === "connected";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Best Option Contract</h2>

          {symbol && <p className="mt-1 text-sm text-zinc-500">{symbol}</p>}
        </div>

        {available && symbol && (
          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
              liveConnected
                ? "border-emerald-700 bg-emerald-950/50 text-emerald-300"
                : live.status === "error"
                  ? "border-red-700 bg-red-950/50 text-red-300"
                  : "border-yellow-700 bg-yellow-950/50 text-yellow-300"
            }`}
          >
            {liveConnected
              ? "LIVE"
              : live.status === "error"
                ? "STREAM ERROR"
                : "CONNECTING"}
          </span>
        )}
      </div>

      {!available ? (
        <p className="mt-5 text-yellow-300">
          No liquid contract currently qualifies.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Type</p>
              <p className="mt-1 text-xl font-bold">{type ?? "--"}</p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Strike</p>
              <p className="mt-1 text-xl font-bold">${valueOrDash(strike)}</p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Expiration</p>
              <p className="mt-1 text-xl font-bold">{expiration || "--"}</p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Premium</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                ${valueOrDash(displayPremium)}
              </p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Bid / Ask</p>
              <p className="mt-1 text-xl font-bold">
                ${valueOrDash(displayBid)} / ${valueOrDash(displayAsk)}
              </p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Spread</p>
              <p className="mt-1 text-xl font-bold">
                {valueOrDash(displaySpreadPercent, 1)}%
              </p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Volume / OI</p>
              <p className="mt-1 text-xl font-bold">
                {(displayVolume ?? 0).toLocaleString()} /{" "}
                {(openInterest ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl bg-black p-4">
              <p className="text-sm text-zinc-500">Delta</p>
              <p className="mt-1 text-xl font-bold">{valueOrDash(delta, 3)}</p>
            </div>
          </div>

          {live.lastUpdatedAt && (
            <p className="mt-4 text-xs text-zinc-500">
              Live update: {new Date(live.lastUpdatedAt).toLocaleTimeString()}
            </p>
          )}

          {live.error && (
            <p className="mt-4 text-sm text-red-300">{live.error}</p>
          )}
        </>
      )}
    </section>
  );
}

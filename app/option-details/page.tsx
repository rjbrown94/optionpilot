"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTradeContext } from "@/components/providers/TradeContext";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function OptionDetailsContent() {
  const searchParams = useSearchParams();
  const tradeContext = useTradeContext();
  const saved = tradeContext.selectedContract;

  const stock =
    saved?.stock || searchParams.get("stock") || tradeContext.symbol || "SOFI";
  const type =
    saved?.type || searchParams.get("type") || tradeContext.direction || "CALL";
  const strike = saved?.strike ?? Number(searchParams.get("strike") || 0);
  const premium = saved?.premium ?? Number(searchParams.get("premium") || 0);
  const expiration =
    saved?.expiration || searchParams.get("expiration") || "--";
  const stockPrice =
    saved?.stockPrice ?? Number(searchParams.get("stockPrice") || 0);
  const volume = saved?.volume ?? Number(searchParams.get("volume") || 0);
  const openInterest =
    saved?.openInterest ?? Number(searchParams.get("openInterest") || 0);
  const score = saved?.score ?? Number(searchParams.get("score") || 0);
  const contractCost = premium * 100;
  const breakeven =
    saved?.breakEvenPrice ??
    (type === "CALL" ? strike + premium : strike - premium);
  const distanceToBreakeven =
    stockPrice > 0 ? ((breakeven - stockPrice) / stockPrice) * 100 : 0;
  const liquidityLabel =
    volume >= 5000 && openInterest >= 5000
      ? "Strong Liquidity"
      : volume >= 1000 && openInterest >= 1000
        ? "Good Liquidity"
        : "Weak Liquidity";

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link href="/cheap-options" className="font-bold text-green-400">
            ← Back to AI Contract Selector
          </Link>
          <h1 className="mt-6 text-5xl font-bold">Option Details</h1>
          <p className="mt-2 text-zinc-400">
            Final contract review before placing the trade.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
            Connected Trade Workflow
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span>
              Symbol: <strong>{stock}</strong>
            </span>
            <span>
              Direction: <strong>{type}</strong>
            </span>
            <span>
              Strategy:{" "}
              <strong className="capitalize">{tradeContext.strategy}</strong>
            </span>
            <span>
              Scanner:{" "}
              <strong>{tradeContext.scannerStatus || "Not checked"}</strong>
            </span>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-zinc-400">Contract</p>
                <h2 className="mt-2 text-4xl font-bold">{stock}</h2>
                <p
                  className={`mt-3 text-xl font-bold ${type === "CALL" ? "text-green-400" : "text-red-400"}`}
                >
                  {type} · {money(strike)} Strike
                </p>
                <p className="mt-2 text-zinc-400">Expires: {expiration}</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-400">Premium</p>
                <p className="mt-2 text-4xl font-bold text-green-400">
                  {money(premium)}
                </p>
                <p className="mt-2 text-zinc-400">
                  Cost: {money(contractCost)}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                ["Stock Price", money(stockPrice)],
                ["Breakeven Price", money(breakeven)],
                ["Move Needed", `${distanceToBreakeven.toFixed(2)}%`],
                ["Volume", volume.toLocaleString()],
                ["Open Interest", openInterest.toLocaleString()],
                ["Liquidity", liquidityLabel],
                ["Delta", saved?.delta?.toFixed(2) ?? "--"],
                [
                  "IV",
                  saved?.impliedVolatility
                    ? `${(saved.impliedVolatility * 100).toFixed(1)}%`
                    : "--",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-black p-5">
                  <p className="text-zinc-500">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-400">Contract Score</p>
            <p className="mt-3 text-5xl font-bold text-yellow-400">
              {score}/100
            </p>
            <div className="mt-8 space-y-4">
              <div className="rounded-xl bg-black p-4">
                <p className="text-zinc-500">Max Risk</p>
                <p className="text-xl font-bold">{money(contractCost)}</p>
              </div>
              <div className="rounded-xl bg-black p-4">
                <p className="text-zinc-500">Scanner Result</p>
                <p className="text-xl font-bold">
                  {tradeContext.scannerStatus || "Not checked"}
                </p>
              </div>
              <div className="rounded-xl bg-black p-4">
                <p className="text-zinc-500">Flow Direction</p>
                <p className="text-xl font-bold">{tradeContext.direction}</p>
              </div>
            </div>
            <Link
              href={`/scanner?symbol=${encodeURIComponent(stock)}`}
              className="mt-8 block rounded-xl bg-white px-5 py-3 text-center font-bold text-black"
            >
              Return to Scanner
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function OptionDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black p-8 text-white">
          Loading option details...
        </main>
      }
    >
      <OptionDetailsContent />
    </Suspense>
  );
}

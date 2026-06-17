"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function OptionDetailsContent() {
  const searchParams = useSearchParams();

  const stock = searchParams.get("stock") || "SOFI";
  const type = searchParams.get("type") || "CALL";
  const strike = Number(searchParams.get("strike") || 16.5);
  const premium = Number(searchParams.get("premium") || 0.34);
  const expiration = searchParams.get("expiration") || "2026-06-12";
  const stockPrice = Number(searchParams.get("stockPrice") || 16.03);
  const volume = Number(searchParams.get("volume") || 0);
  const openInterest = Number(searchParams.get("openInterest") || 0);
  const score = Number(searchParams.get("score") || 0);

  const contractCost = premium * 100;
  const breakeven =
    type.toUpperCase() === "CALL" ? strike + premium : strike - premium;

  const distanceToBreakeven =
    stockPrice > 0 ? ((breakeven - stockPrice) / stockPrice) * 100 : 0;

  const riskLabel =
    premium <= 0.5
      ? "Low Cost"
      : premium <= 1.5
        ? "Moderate Cost"
        : "Higher Cost";

  const liquidityLabel =
    volume >= 5000 && openInterest >= 5000
      ? "Strong Liquidity"
      : volume >= 1000 && openInterest >= 1000
        ? "Good Liquidity"
        : "Weak Liquidity";

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/cheap-options" className="text-green-400 font-bold">
            ← Back to Cheap Options
          </Link>

          <h1 className="text-5xl font-bold mt-6">Option Details</h1>

          <p className="text-zinc-400 mt-2">
            Review contract cost, breakeven, risk, liquidity, and setup quality
            before trading.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-zinc-400">Contract</p>
                <h2 className="text-4xl font-bold mt-2">{stock}</h2>

                <p
                  className={
                    type.toUpperCase() === "CALL"
                      ? "text-green-400 font-bold text-xl mt-3"
                      : "text-red-400 font-bold text-xl mt-3"
                  }
                >
                  {type.toUpperCase()} · {money(strike)} Strike
                </p>

                <p className="text-zinc-400 mt-2">Expires: {expiration}</p>
              </div>

              <div className="text-right">
                <p className="text-zinc-400">Premium</p>
                <p className="text-4xl font-bold text-green-400 mt-2">
                  {money(premium)}
                </p>
                <p className="text-zinc-400 mt-2">
                  Cost: {money(contractCost)}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <div className="bg-black rounded-xl p-5">
                <p className="text-zinc-500">Stock Price</p>
                <p className="text-2xl font-bold">{money(stockPrice)}</p>
              </div>

              <div className="bg-black rounded-xl p-5">
                <p className="text-zinc-500">Breakeven Price</p>
                <p className="text-2xl font-bold">{money(breakeven)}</p>
              </div>

              <div className="bg-black rounded-xl p-5">
                <p className="text-zinc-500">Move Needed</p>
                <p className="text-2xl font-bold">
                  {distanceToBreakeven.toFixed(2)}%
                </p>
              </div>

              <div className="bg-black rounded-xl p-5">
                <p className="text-zinc-500">Risk</p>
                <p className="text-2xl font-bold">{riskLabel}</p>
              </div>

              <div className="bg-black rounded-xl p-5">
                <p className="text-zinc-500">Volume</p>
                <p className="text-2xl font-bold">{volume.toLocaleString()}</p>
              </div>

              <div className="bg-black rounded-xl p-5">
                <p className="text-zinc-500">Open Interest</p>
                <p className="text-2xl font-bold">
                  {openInterest.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <p className="text-zinc-400">Opportunity Score</p>
            <p className="text-5xl font-bold text-yellow-400 mt-3">
              {score}/100
            </p>

            <div className="mt-8 space-y-4">
              <div className="bg-black rounded-xl p-4">
                <p className="text-zinc-500">Liquidity</p>
                <p className="text-xl font-bold">{liquidityLabel}</p>
              </div>

              <div className="bg-black rounded-xl p-4">
                <p className="text-zinc-500">Max Risk</p>
                <p className="text-xl font-bold">{money(contractCost)}</p>
              </div>

              <div className="bg-black rounded-xl p-4">
                <p className="text-zinc-500">Max Gain</p>
                <p className="text-xl font-bold">
                  {type.toUpperCase() === "CALL" ? "Unlimited" : "Limited"}
                </p>
              </div>
            </div>

            <Link
              href={`/scanner?symbol=${stock}`}
              className="block text-center bg-green-500 text-black font-bold rounded-xl px-5 py-3 mt-8"
            >
              Open Full Scanner
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OptionDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white p-8">
          Loading option details...
        </main>
      }
    >
      <OptionDetailsContent />
    </Suspense>
  );
}

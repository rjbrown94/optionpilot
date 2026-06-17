"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type GapStock = {
  symbol: string;
  currentPrice: string;
  previousClose: string;
  gapPercent: string;
  direction: string;
  optionsBias: string;
  score: number;
};

type GapResponse = {
  updatedAt: string;
  stocks: GapStock[];
};

export default function GapPage() {
  const [data, setData] = useState<GapResponse | null>(null);

  async function loadGapScanner() {
    const res = await fetch("/api/gap", {
      cache: "no-store",
    });

    const gapData = await res.json();

    setData(gapData);
  }

  useEffect(() => {
    loadGapScanner();

    const interval = setInterval(() => {
      loadGapScanner();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-5xl font-bold">Gap Scanner</h1>

            <p className="text-zinc-400 mt-2">
              Live gap scan for options bias.
            </p>
          </div>

          <p className="text-zinc-500 text-sm">
            Last Updated:{" "}
            {data?.updatedAt
              ? new Date(data.updatedAt).toLocaleTimeString()
              : "Loading..."}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="p-4">Symbol</th>
                <th className="p-4">Gap %</th>
                <th className="p-4">Direction</th>
                <th className="p-4">Options Bias</th>
                <th className="p-4">Score</th>
                <th className="p-4">Current</th>
                <th className="p-4">Previous</th>
                <th className="p-4">Open</th>
              </tr>
            </thead>

            <tbody>
              {data?.stocks?.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="border-t border-zinc-800 hover:bg-zinc-900 transition"
                >
                  <td className="p-4">
                    <Link
                      href={`/scanner?symbol=${stock.symbol}`}
                      className="font-bold text-xl hover:text-green-400"
                    >
                      {stock.symbol}
                    </Link>
                  </td>

                  <td
                    className={`p-4 font-bold text-xl ${
                      Number(stock.gapPercent) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {stock.gapPercent}%
                  </td>

                  <td className="p-4 text-zinc-300">{stock.direction}</td>

                  <td className="p-4 text-zinc-300">{stock.optionsBias}</td>

                  <td className="p-4 text-zinc-300">{stock.score}/100</td>

                  <td className="p-4 text-zinc-300">${stock.currentPrice}</td>

                  <td className="p-4 text-zinc-500">${stock.previousClose}</td>

                  <td className="p-4">
                    <Link
                      href={`/scanner?symbol=${stock.symbol}`}
                      className="text-green-400 hover:text-green-300 font-medium"
                    >
                      Scanner →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-xl font-bold mb-2">Gap Up</h2>
            <p className="text-zinc-400 text-sm">
              Gap up stocks may favor call setups if volume, trend, and news
              confirm.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-xl font-bold mb-2">Gap Down</h2>
            <p className="text-zinc-400 text-sm">
              Gap down stocks may favor put setups if price stays weak under key
              levels.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-xl font-bold mb-2">Options Rule</h2>
            <p className="text-zinc-400 text-sm">
              Gap alone is not enough. Confirm with chart, volume, RSI, EMA, and
              news catalyst.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

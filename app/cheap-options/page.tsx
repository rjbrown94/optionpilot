"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CheapOption = {
  stock: string;
  stockPrice?: number;
  contractSymbol: string;
  description: string;
  type: string;
  strike: number;
  expiration: string;
  expirationQuality?: string;
  dte: number;
  bid: number;
  ask: number;
  premium: number;
  volume: number;
  openInterest: number;
  spreadPercent: number;
  strikeDistancePercent?: number;
  score: number;
};

function qualityIcon(quality?: string) {
  if (quality === "Excellent") return "⭐";
  if (quality === "Good") return "✅";
  if (quality === "Moderate") return "⚠️";
  return "";
}

function optionDetailsUrl(item: CheapOption) {
  const params = new URLSearchParams({
    stock: item.stock,
    type: item.type,
    strike: String(item.strike),
    premium: String(item.premium),
    expiration: item.expiration,
    stockPrice: String(item.stockPrice || 0),
    volume: String(item.volume),
    openInterest: String(item.openInterest),
    score: String(item.score),
  });

  return `/option-details?${params.toString()}`;
}

export default function CheapOptionsPage() {
  const [results, setResults] = useState<CheapOption[]>([]);
  const [loading, setLoading] = useState(true);

  async function scanOptions() {
    setLoading(true);

    try {
      const res = await fetch("/api/cheap-options");
      const json = await res.json();
      setResults(json.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scanOptions();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-5xl font-bold">Cheap Options Scanner</h1>
            <p className="text-zinc-400 mt-2">
              Finds liquid option contracts with good price, expiration, volume,
              open interest, and spread.
            </p>
          </div>

          <button
            onClick={scanOptions}
            className="bg-green-500 text-black font-bold px-5 py-3 rounded-xl"
          >
            {loading ? "Scanning..." : "Scan Options"}
          </button>
        </div>

        {loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            Searching for cheap contracts...
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            No cheap contracts found right now.
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {results.map((item, index) => (
            <Link
              key={item.contractSymbol}
              href={optionDetailsUrl(item)}
              className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-green-500 transition"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-zinc-500 font-bold mb-2">
                    #{index + 1} Ranked Contract
                  </p>

                  <p className="text-3xl font-bold">{item.stock}</p>

                  {item.stockPrice && (
                    <p className="text-zinc-400 mt-1">
                      Stock Price: ${item.stockPrice.toFixed(2)}
                    </p>
                  )}

                  <p
                    className={
                      item.type === "CALL"
                        ? "text-green-400 font-bold mt-2"
                        : "text-red-400 font-bold mt-2"
                    }
                  >
                    {item.type} · ${item.strike} Strike
                  </p>

                  <p className="text-zinc-400 mt-1">
                    Expires: {item.expiration}
                  </p>

                  <p className="text-zinc-400 mt-1">
                    {item.dte} DTE {qualityIcon(item.expirationQuality)}{" "}
                    {item.expirationQuality || ""}
                  </p>

                  {typeof item.strikeDistancePercent === "number" && (
                    <p className="text-zinc-500 mt-1">
                      Strike Distance: {item.strikeDistancePercent.toFixed(1)}%
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-3xl font-bold text-green-400">
                    ${item.premium.toFixed(2)}
                  </p>

                  <p className="text-zinc-400">View details</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-black rounded-xl p-4">
                  <p className="text-zinc-500">Volume</p>
                  <p className="text-xl font-bold">
                    {item.volume.toLocaleString()}
                  </p>
                </div>

                <div className="bg-black rounded-xl p-4">
                  <p className="text-zinc-500">Open Interest</p>
                  <p className="text-xl font-bold">
                    {item.openInterest.toLocaleString()}
                  </p>
                </div>

                <div className="bg-black rounded-xl p-4">
                  <p className="text-zinc-500">Bid / Ask</p>
                  <p className="text-xl font-bold">
                    ${item.bid.toFixed(2)} / ${item.ask.toFixed(2)}
                  </p>
                </div>

                <div className="bg-black rounded-xl p-4">
                  <p className="text-zinc-500">Spread</p>
                  <p className="text-xl font-bold">
                    {item.spreadPercent.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-6 bg-black rounded-xl p-4">
                <p className="text-zinc-500">Opportunity Score</p>
                <p className="text-3xl font-bold text-yellow-400">
                  {item.score}/100
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

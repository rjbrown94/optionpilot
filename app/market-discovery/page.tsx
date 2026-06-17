"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MarketStock = {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changesPercentage: number;
  exchange?: string;
};

type MarketData = {
  topGainers: MarketStock[];
  topLosers: MarketStock[];
  relativeVolume: MarketStock[];
  premarket: MarketStock[];
  afterHours: MarketStock[];
};

function formatPercent(value: number) {
  if (!value && value !== 0) return "0.00%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function MarketCard({
  title,
  stocks,
  color,
}: {
  title: string;
  stocks: MarketStock[];
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h2 className={`text-2xl font-bold mb-6 ${color}`}>{title}</h2>

      <div className="space-y-4">
        {stocks.map((stock) => (
          <Link
            key={`${title}-${stock.symbol}`}
            href={`/scanner?symbol=${stock.symbol}`}
            className="block border border-zinc-800 rounded-xl p-4 hover:border-green-500"
          >
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-2xl font-bold">{stock.symbol}</p>
                <p className="text-zinc-400 text-sm line-clamp-1">
                  {stock.name || "No company name"}
                </p>
                <p className="text-zinc-500 text-sm">{stock.exchange || ""}</p>
              </div>

              <div className="text-right">
                <p className="text-white font-bold">${Number(stock.price).toFixed(2)}</p>
                <p
                  className={
                    Number(stock.changesPercentage) >= 0
                      ? "text-green-400 font-bold"
                      : "text-red-400 font-bold"
                  }
                >
                  {formatPercent(Number(stock.changesPercentage))}
                </p>
              </div>
            </div>
          </Link>
        ))}

        {stocks.length === 0 && (
          <p className="text-zinc-400">No stocks found.</p>
        )}
      </div>
    </div>
  );
}

export default function MarketDiscoveryPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const response = await fetch("/api/market-discovery");
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error(error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-5xl font-bold">Market Discovery</h1>
            <p className="text-zinc-400 mt-2">
              Find premarket movers, after-hours movers, gainers, losers, and active stocks.
            </p>
          </div>

          <button
            onClick={loadData}
            className="bg-green-500 text-black font-bold px-5 py-3 rounded-xl"
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
        </div>

        {loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            Scanning market movers...
          </div>
        )}

        {!loading && data && (
          <div className="grid lg:grid-cols-2 gap-6">
            <MarketCard
              title="🚀 Premarket Movers"
              stocks={data.premarket || []}
              color="text-green-400"
            />

            <MarketCard
              title="🌙 After-Hours Movers"
              stocks={data.afterHours || []}
              color="text-purple-400"
            />

            <MarketCard
              title="📈 Top Gainers"
              stocks={data.topGainers || []}
              color="text-green-400"
            />

            <MarketCard
              title="📉 Top Losers"
              stocks={data.topLosers || []}
              color="text-red-400"
            />

            <MarketCard
              title="🔥 Most Active / Relative Volume"
              stocks={data.relativeVolume || []}
              color="text-yellow-400"
            />
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { watchlistCategories } from "@/data/watchlistCategories";

type AutoScanResult = {
  symbol: string;
  price: string;
  previousClose: string;
  changePercent: string;
  bestPlay: string;
  pattern: string;
  candle: string;
  confidence: number;
  score: number;
  setupQuality: string;
  status: string;
  scannerUrl: string;
};

type AutoScanResponse = {
  updatedAt: string;
  results: AutoScanResult[];
};

function getTradeSignal(stock: AutoScanResult) {
  const change = Number(stock.changePercent);

  if (stock.score >= 90 && stock.bestPlay === "CALLS") return "🚀 STRONG CALL";
  if (stock.score >= 90 && stock.bestPlay === "PUTS") return "📉 STRONG PUT";
  if (stock.score >= 80 && stock.bestPlay === "CALLS") return "🔥 WATCH CALL";
  if (stock.score >= 80 && stock.bestPlay === "PUTS") return "🔥 WATCH PUT";
  if (change >= 2) return "👀 CALL WATCH";
  if (change <= -2) return "👀 PUT WATCH";

  return "WAIT";
}

export default function AutoScannerPage() {
  const [data, setData] = useState<AutoScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Core");

  async function loadAutoScanner(category = activeCategory) {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/auto-scan?category=${encodeURIComponent(category)}`,
        {
          cache: "no-store",
        },
      );

      const scanData = await res.json();
      setData(scanData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function changeCategory(category: string) {
    setActiveCategory(category);
    loadAutoScanner(category);
  }

  useEffect(() => {
    loadAutoScanner("Core");

    const interval = setInterval(() => {
      loadAutoScanner(activeCategory);
    }, 60000);

    return () => clearInterval(interval);
  }, [activeCategory]);

  const topTrade = data?.results?.[0];

  const tradeReady = data?.results?.filter(
    (stock) => stock.status === "TRADE READY",
  );

  const bestCall = data?.results
    ?.filter((stock) => stock.bestPlay === "CALLS")
    .sort((a, b) => b.score - a.score)?.[0];

  const bestPut = data?.results
    ?.filter((stock) => stock.bestPlay === "PUTS")
    .sort((a, b) => b.score - a.score)?.[0];

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-5xl font-bold">Auto Scanner</h1>
            <p className="text-zinc-400 mt-2">
              Automatically ranks your selected watchlist category.
            </p>
          </div>

          <div className="text-right">
            <p className="text-zinc-500 text-sm">
              Last Updated:{" "}
              {data?.updatedAt
                ? new Date(data.updatedAt).toLocaleTimeString()
                : "Loading..."}
            </p>

            <button
              onClick={() => loadAutoScanner(activeCategory)}
              className="mt-2 bg-green-500 hover:bg-green-600 text-black font-bold px-4 py-2 rounded-lg"
            >
              {loading ? "Scanning..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {Object.keys(watchlistCategories).map((category) => (
            <button
              key={category}
              onClick={() => changeCategory(category)}
              className={`px-5 py-3 rounded-xl font-bold text-white ${
                activeCategory === category
                  ? "bg-purple-600"
                  : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <p className="text-sm text-zinc-500 mb-6">
          Scanning: {activeCategory} •{" "}
          {watchlistCategories[activeCategory]?.length ?? 0} stocks
        </p>

        {topTrade && (
          <Link href={topTrade.scannerUrl}>
            <div className="mb-8 border border-green-500 bg-green-950/30 rounded-2xl p-6 hover:bg-green-950/50 transition cursor-pointer">
              <div className="flex justify-between items-start gap-6">
                <div>
                  <p className="text-green-400 font-bold mb-2">
                    OPTIONPILOT TOP TRADE
                  </p>

                  <h2 className="text-5xl font-bold">{topTrade.symbol}</h2>

                  <p className="text-zinc-400 mt-3">Price: ${topTrade.price}</p>

                  <p className="text-zinc-400">
                    Previous Close: ${topTrade.previousClose}
                  </p>

                  <p className="text-cyan-400 font-bold mt-3">
                    Pattern: {topTrade.pattern}
                  </p>

                  <p className="text-yellow-400 font-bold">
                    Candle: {topTrade.candle}
                  </p>

                  <p className="text-purple-400 font-bold">
                    Confidence: {topTrade.confidence}%
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`text-5xl font-bold ${
                      topTrade.bestPlay === "CALLS"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {topTrade.bestPlay}
                  </p>

                  <p
                    className={`text-3xl font-bold mt-2 ${
                      Number(topTrade.changePercent) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {topTrade.changePercent}%
                  </p>

                  <p className="text-zinc-300 mt-3">
                    Score: {topTrade.score}/100
                  </p>

                  <p className="text-zinc-400">
                    Quality: {topTrade.setupQuality}
                  </p>

                  <p className="text-green-400 font-bold mt-3">
                    {getTradeSignal(topTrade)}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {bestCall && (
            <Link href={bestCall.scannerUrl}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-green-500 transition cursor-pointer">
                <p className="text-zinc-400">Best Call Setup</p>

                <div className="flex justify-between items-center mt-3">
                  <div>
                    <h3 className="text-3xl font-bold">{bestCall.symbol}</h3>
                    <p className="text-green-400 mt-1">
                      {bestCall.changePercent}%
                    </p>
                    <p className="text-cyan-400 mt-2">{bestCall.pattern}</p>
                    <p className="text-yellow-400">{bestCall.candle}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-green-400 font-bold text-2xl">CALLS</p>
                    <p className="text-zinc-400">{bestCall.score}/100</p>
                    <p className="text-purple-400">{bestCall.confidence}%</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {bestPut && (
            <Link href={bestPut.scannerUrl}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-red-500 transition cursor-pointer">
                <p className="text-zinc-400">Best Put Setup</p>

                <div className="flex justify-between items-center mt-3">
                  <div>
                    <h3 className="text-3xl font-bold">{bestPut.symbol}</h3>
                    <p className="text-red-400 mt-1">
                      {bestPut.changePercent}%
                    </p>
                    <p className="text-cyan-400 mt-2">{bestPut.pattern}</p>
                    <p className="text-yellow-400">{bestPut.candle}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-red-400 font-bold text-2xl">PUTS</p>
                    <p className="text-zinc-400">{bestPut.score}/100</p>
                    <p className="text-purple-400">{bestPut.confidence}%</p>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        {tradeReady && tradeReady.length > 0 && (
          <div className="mb-8 border border-green-500 bg-green-950/30 rounded-2xl p-5">
            <h2 className="text-3xl font-bold text-green-400 mb-4">
              🔥 Trade Ready Alerts
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {tradeReady.map((stock) => (
                <Link
                  key={stock.symbol}
                  href={stock.scannerUrl}
                  className="block bg-zinc-900 border border-green-500 rounded-xl p-5 hover:bg-zinc-800 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-3xl font-bold">{stock.symbol}</h3>

                      <p className="text-zinc-400 mt-2">
                        Price: ${stock.price}
                      </p>

                      <p className="text-zinc-400">
                        Previous: ${stock.previousClose}
                      </p>

                      <p className="text-cyan-400 font-bold mt-2">
                        {stock.pattern}
                      </p>

                      <p className="text-yellow-400 font-bold">
                        {stock.candle}
                      </p>

                      <p className="text-green-400 font-bold mt-2">
                        {stock.status}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-3xl font-bold ${
                          stock.bestPlay === "CALLS"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {stock.bestPlay}
                      </p>

                      <p
                        className={`text-xl font-bold mt-2 ${
                          Number(stock.changePercent) >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {stock.changePercent}%
                      </p>

                      <p className="text-purple-400 mt-2">
                        {stock.confidence}%
                      </p>

                      <p className="text-zinc-300 mt-2">
                        Score: {stock.score}/100
                      </p>

                      <p className="text-zinc-500">{getTradeSignal(stock)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="p-4">Symbol</th>
                <th className="p-4">Best Play</th>
                <th className="p-4">Pattern</th>
                <th className="p-4">Candle</th>
                <th className="p-4">Confidence</th>
                <th className="p-4">Signal</th>
                <th className="p-4">Change</th>
                <th className="p-4">Price</th>
                <th className="p-4">Score</th>
                <th className="p-4">Quality</th>
                <th className="p-4">Status</th>
                <th className="p-4">Open</th>
              </tr>
            </thead>

            <tbody>
              {data?.results?.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="border-t border-zinc-800 hover:bg-zinc-900 transition"
                >
                  <td className="p-4">
                    <Link
                      href={stock.scannerUrl}
                      className="font-bold text-xl hover:text-green-400"
                    >
                      {stock.symbol}
                    </Link>
                  </td>

                  <td
                    className={`p-4 font-bold ${
                      stock.bestPlay === "CALLS"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {stock.bestPlay}
                  </td>

                  <td className="p-4 text-cyan-400 font-bold">
                    {stock.pattern}
                  </td>

                  <td className="p-4 text-yellow-400 font-bold">
                    {stock.candle}
                  </td>

                  <td className="p-4 text-purple-400 font-bold">
                    {stock.confidence}%
                  </td>

                  <td className="p-4 text-zinc-300">{getTradeSignal(stock)}</td>

                  <td
                    className={`p-4 font-bold ${
                      Number(stock.changePercent) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {stock.changePercent}%
                  </td>

                  <td className="p-4 text-zinc-300">${stock.price}</td>

                  <td className="p-4 text-zinc-300">{stock.score}/100</td>

                  <td className="p-4 text-zinc-300">{stock.setupQuality}</td>

                  <td
                    className={`p-4 font-bold ${
                      stock.status === "TRADE READY"
                        ? "text-green-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {stock.status}
                  </td>

                  <td className="p-4">
                    <Link
                      href={stock.scannerUrl}
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
      </section>
    </main>
  );
}

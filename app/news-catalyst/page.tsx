"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NewsItem = {
  symbol: string;
  title: string;
  description: string;
  link: string;
  source: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  catalystType: string;
  score: number;
  rating: string;
  reason: string;
  optionDirection: "CALLS" | "PUTS" | "WAIT";
  impact: string;
};

export default function NewsCatalystPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [topPlays, setTopPlays] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");

  async function loadNews() {
    setLoading(true);

    try {
      const res = await fetch("/api/news-catalyst");
      const data = await res.json();

      setItems(data.results || []);
      setTopPlays(data.topPlays || []);
      setUpdatedAt(data.updatedAt || "");
    } catch {
      setItems([]);
      setTopPlays([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
  }, []);

  const recentNews = items.slice(0, 20);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-5xl font-bold">News Catalyst Scanner</h1>
            <p className="text-zinc-400 mt-2">
              Finds real news that may move your watchlist stocks for options
              setups.
            </p>

            {updatedAt && (
              <p className="text-zinc-500 mt-2">
                Last updated: {new Date(updatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          <button
            onClick={loadNews}
            className="bg-green-500 text-black px-6 py-3 rounded-xl font-bold"
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
        </div>

        {loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            Scanning news catalysts...
          </div>
        )}

        {!loading && topPlays.length > 0 && (
          <>
            <h2 className="text-3xl font-bold mb-4 text-green-400">
              Top News Plays
            </h2>

            <div className="grid lg:grid-cols-3 gap-4 mb-10">
              {topPlays.map((item, index) => (
                <Link
                  key={`${item.symbol}-top-${index}`}
                  href={`/scanner?symbol=${item.symbol}`}
                  className="bg-zinc-900 border border-green-500 rounded-2xl p-5 hover:bg-zinc-800 transition"
                >
                  <div className="flex justify-between mb-3">
                    <p className="text-3xl font-bold">{item.symbol}</p>

                    <div className="text-right">
                      <p
                        className={
                          item.optionDirection === "CALLS"
                            ? "text-green-400 font-bold"
                            : item.optionDirection === "PUTS"
                              ? "text-red-400 font-bold"
                              : "text-yellow-400 font-bold"
                        }
                      >
                        {item.optionDirection}
                      </p>

                      <p className="text-zinc-400">
                        {item.rating} · {item.score}/100
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
                      {item.catalystType}
                    </span>

                    <span
                      className={
                        item.bias === "Bullish"
                          ? "bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm"
                          : item.bias === "Bearish"
                            ? "bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm"
                            : "bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm"
                      }
                    >
                      {item.bias}
                    </span>
                  </div>

                  <p className="font-bold line-clamp-2 mb-2">{item.title}</p>

                  <p className="text-zinc-400 text-sm">Reason: {item.reason}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading && recentNews.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            No watchlist news found right now.
          </div>
        )}

        {!loading && recentNews.length > 0 && (
          <>
            <h2 className="text-3xl font-bold mb-4">Recent Watchlist News</h2>

            <div className="grid lg:grid-cols-2 gap-6">
              {recentNews.map((item, index) => (
                <NewsCard key={`${item.symbol}-${index}`} item={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div className="flex justify-between gap-4 mb-4">
        <div>
          <p className="text-3xl font-bold">{item.symbol}</p>
          <p className="text-zinc-500">{item.source}</p>
        </div>

        <div className="text-right">
          <p
            className={
              item.optionDirection === "CALLS"
                ? "text-green-400 font-bold"
                : item.optionDirection === "PUTS"
                  ? "text-red-400 font-bold"
                  : "text-yellow-400 font-bold"
            }
          >
            {item.optionDirection}
          </p>

          <p className="text-zinc-400">
            {item.rating} · Score {item.score}/100
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
          {item.catalystType}
        </span>

        <span
          className={
            item.bias === "Bullish"
              ? "bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm"
              : item.bias === "Bearish"
                ? "bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm"
                : "bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm"
          }
        >
          {item.bias}
        </span>
      </div>

      <h3 className="text-xl font-bold mb-3">{item.title}</h3>

      <p className="text-zinc-400 mb-4 line-clamp-3">
        {item.description || "No summary available."}
      </p>

      <p className="text-green-400 font-bold mb-2">
        Options Impact: {item.impact}
      </p>

      <p className="text-zinc-400 mb-5">Reason: {item.reason}</p>

      <div className="flex gap-3">
        <Link
          href={`/scanner?symbol=${item.symbol}`}
          className="bg-green-500 text-black font-bold px-4 py-2 rounded-xl"
        >
          Open Scanner
        </Link>

        {item.link && (
          <a
            href={item.link}
            target="_blank"
            className="bg-zinc-800 text-white font-bold px-4 py-2 rounded-xl"
          >
            Read News
          </a>
        )}
      </div>
    </div>
  );
}

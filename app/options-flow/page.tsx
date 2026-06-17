"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OptionsFlowItem = {
  symbol: string;
  callVolume: number;
  putVolume: number;
  callPutRatio: string;
  signal: "Bullish" | "Bearish" | "Neutral";
  score: number;
  status: "TRADE READY" | "WATCH";
  scannerUrl: string;
};

type OptionsFlowResponse = {
  updatedAt: string;
  results: OptionsFlowItem[];
  note?: string;
};

function formatVolume(value: number) {
  return value.toLocaleString();
}

export default function OptionsFlowPage() {
  const [data, setData] = useState<OptionsFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadFlow() {
    try {
      setLoading(true);

      const res = await fetch("/api/options-flow", {
        cache: "no-store",
      });

      const json = await res.json();

      setData(json);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlow();

    const interval = setInterval(() => {
      loadFlow();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const tradeReady = data?.results?.filter(
    (item) => item.status === "TRADE READY",
  );

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <section className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-5xl font-bold">Options Flow</h1>

            <p className="text-zinc-400 mt-2">
              Track unusual call and put activity for options setups.
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
              onClick={loadFlow}
              className="mt-2 bg-green-500 hover:bg-green-600 text-black font-bold px-4 py-2 rounded-lg"
            >
              {loading ? "Scanning..." : "Refresh"}
            </button>
          </div>
        </div>

        {tradeReady && tradeReady.length > 0 && (
          <div className="mb-8 border border-green-500 bg-green-950/30 rounded-2xl p-6">
            <h2 className="text-3xl font-bold text-green-400 mb-5">
              🔥 Trade Ready Flow
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {tradeReady.map((item) => (
                <Link
                  key={item.symbol}
                  href={item.scannerUrl}
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-green-500 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-4xl font-bold">{item.symbol}</h3>

                      <p className="text-zinc-400 mt-3">
                        Calls: {formatVolume(item.callVolume)}
                      </p>

                      <p className="text-zinc-400">
                        Puts: {formatVolume(item.putVolume)}
                      </p>

                      <p className="text-zinc-400">
                        Ratio: {item.callPutRatio}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-2xl font-bold ${
                          item.signal === "Bullish"
                            ? "text-green-400"
                            : item.signal === "Bearish"
                              ? "text-red-400"
                              : "text-yellow-400"
                        }`}
                      >
                        {item.signal}
                      </p>

                      <p className="text-zinc-300 mt-3">
                        Score: {item.score}/100
                      </p>

                      <p className="text-green-400 font-bold mt-3">
                        {item.status}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="p-4">Symbol</th>
                <th className="p-4">Call Volume</th>
                <th className="p-4">Put Volume</th>
                <th className="p-4">Call/Put Ratio</th>
                <th className="p-4">Signal</th>
                <th className="p-4">Score</th>
                <th className="p-4">Status</th>
                <th className="p-4">Open</th>
              </tr>
            </thead>

            <tbody>
              {data?.results?.map((item) => (
                <tr
                  key={item.symbol}
                  className="border-t border-zinc-800 hover:bg-zinc-900 transition"
                >
                  <td className="p-4">
                    <Link
                      href={item.scannerUrl}
                      className="font-bold text-xl hover:text-green-400"
                    >
                      {item.symbol}
                    </Link>
                  </td>

                  <td className="p-4 text-green-400 font-bold">
                    {formatVolume(item.callVolume)}
                  </td>

                  <td className="p-4 text-red-400 font-bold">
                    {formatVolume(item.putVolume)}
                  </td>

                  <td className="p-4 text-zinc-300">{item.callPutRatio}</td>

                  <td
                    className={`p-4 font-bold ${
                      item.signal === "Bullish"
                        ? "text-green-400"
                        : item.signal === "Bearish"
                          ? "text-red-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {item.signal}
                  </td>

                  <td className="p-4 text-zinc-300">{item.score}/100</td>

                  <td
                    className={`p-4 font-bold ${
                      item.status === "TRADE READY"
                        ? "text-green-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {item.status}
                  </td>

                  <td className="p-4">
                    <Link
                      href={item.scannerUrl}
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

        {data?.note && (
          <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">{data.note}</p>
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function MomentumPage() {
  const [stocks, setStocks] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/momentum")
      .then((res) => res.json())
      .then((data) => setStocks(data));
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 text-white">
      <h1 className="text-6xl font-bold mb-4">Momentum Scanner</h1>

      <p className="text-zinc-400 mb-10">
        Live momentum stocks ranked by strength.
      </p>

      <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-800">
              <th className="text-left p-4">Symbol</th>
              <th className="text-left p-4">% Change</th>
              <th className="text-left p-4">Price</th>
              <th className="text-left p-4">RVOL</th>
              <th className="text-left p-4">Float</th>
            </tr>
          </thead>

          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.symbol} className="border-t border-zinc-800">
                <td className="p-4 font-bold">{stock.symbol}</td>

                <td className="p-4 text-green-400">
                  {stock.percentChange?.toFixed(2)}%
                </td>

                <td className="p-4">${stock.price}</td>

                <td className="p-4 text-green-400">{stock.rvol}x</td>

                <td className="p-4">{stock.float}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type WatchStock = {
  ticker: string;
  price: number | null;
};

type QuoteResponse = {
  price?: number;
};

const watchlistCategories: Record<string, string[]> = {
  Core: [
    "SPY",
    "QQQ",
    "AAPL",
    "MSFT",
    "META",
    "AMZN",
    "NVDA",
    "TSLA",
    "AMD",
    "NFLX",
    "GOOG",
  ],

  "Market ETFs": ["SPY", "QQQ", "DIA", "VOO"],

  Tech: [
    "AAPL",
    "MSFT",
    "MA",
    "META",
    "SQ",
    "V",
    "AMZN",
    "INTC",
    "CRM",
    "PYPL",
    "NVDA",
    "TSLA",
    "ATVI",
    "EA",
    "AMD",
    "MTCH",
    "ZG",
    "TTD",
    "YELP",
    "ADBE",
    "UTX",
    "CSCO",
    "VZ",
    "T",
    "ORCL",
    "MU",
    "SHOP",
    "BABA",
    "BIDU",
    "BAND",
    "MRVL",
    "IQ",
    "NFLX",
    "QCOM",
    "NXP",
    "STNE",
    "TWTR",
    "FTNT",
    "GOOG",
    "VMW",
  ],

  Marijuana: ["TLRY", "CGC", "CRON", "ACB", "NEPT", "MJ", "NBEV"],

  Pharma: [
    "JNJ",
    "CVS",
    "CNC",
    "ICLR",
    "ABBV",
    "ZTS",
    "ALGN",
    "BDX",
    "ANTM",
    "BMRN",
    "PFE",
    "MRK",
    "BMY",
    "VRX",
    "LLY",
    "LGND",
    "MED",
    "INGN",
  ],

  Banks: [
    "BAC",
    "CFG",
    "MS",
    "CME",
    "JPM",
    "GS",
    "BRK.B",
    "USB",
    "IBKR",
    "AXP",
  ],

  "Food & Beverage": [
    "KO",
    "PEP",
    "MCD",
    "STZ",
    "LW",
    "MDLZ",
    "TAP",
    "SBUX",
    "KR",
    "WMT",
  ],
};

function tickersToStocks(tickers: string[]): WatchStock[] {
  return tickers.map((ticker): WatchStock => {
    return {
      ticker,
      price: null,
    };
  });
}

export default function WatchlistPage() {
  const [stocks, setStocks] = useState<WatchStock[]>([]);
  const [newTicker, setNewTicker] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("Core");
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("watchlist");
    const tickers: string[] = saved
      ? JSON.parse(saved)
      : watchlistCategories.Core;

    setStocks(tickersToStocks(tickers));
  }, []);

  useEffect(() => {
    if (stocks.length === 0) return;

    localStorage.setItem(
      "watchlist",
      JSON.stringify(stocks.map((stock) => stock.ticker)),
    );
  }, [stocks]);

  function loadCategory(category: string) {
    setActiveCategory(category);
    setStocks(tickersToStocks(watchlistCategories[category]));
  }

  async function loadPrices() {
    setIsLoadingPrices(true);

    const updated: WatchStock[] = await Promise.all(
      stocks.map(async (stock): Promise<WatchStock> => {
        try {
          const res = await fetch(`/api/quote?symbol=${stock.ticker}`);
          const data = (await res.json()) as QuoteResponse;

          return {
            ticker: stock.ticker,
            price: typeof data.price === "number" ? data.price : null,
          };
        } catch {
          return stock;
        }
      }),
    );

    setStocks(updated);
    setIsLoadingPrices(false);
  }

  function addStock() {
    const ticker = newTicker.trim().toUpperCase();

    if (!ticker) return;

    const exists = stocks.some((stock) => stock.ticker === ticker);

    if (exists) {
      setNewTicker("");
      return;
    }

    setStocks([...stocks, { ticker, price: null }]);
    setNewTicker("");
  }

  function removeStock(ticker: string) {
    setStocks(stocks.filter((stock) => stock.ticker !== ticker));
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <section className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-4">Watchlist</h1>

        <p className="text-gray-400 mb-8">
          Track stocks by category and refresh prices faster.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          {Object.keys(watchlistCategories).map((category) => (
            <button
              key={category}
              onClick={() => loadCategory(category)}
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

        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <input
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addStock();
            }}
            placeholder="Type stock symbol like AAPL"
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white flex-1 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <button
            onClick={addStock}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-bold text-white"
          >
            Add Stock
          </button>

          <button
            onClick={loadPrices}
            disabled={isLoadingPrices}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-gray-400 px-6 py-3 rounded-xl font-bold text-white"
          >
            {isLoadingPrices ? "Loading..." : "Refresh Prices"}
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Showing: {activeCategory} • {stocks.length} stocks
        </p>

        <div className="grid gap-4">
          {stocks.map((stock) => (
            <div
              key={stock.ticker}
              className="border border-zinc-800 bg-zinc-900 rounded-2xl p-6 flex items-center justify-between gap-6"
            >
              <div>
                <p className="text-gray-400">Ticker</p>
                <p className="text-3xl font-bold text-white">{stock.ticker}</p>
              </div>

              <div>
                <p className="text-gray-400">Stock Price</p>
                <p
                  className={`text-3xl font-bold ${
                    stock.price === null ? "text-gray-400" : "text-green-400"
                  }`}
                >
                  {stock.price !== null ? `$${stock.price.toFixed(2)}` : "--"}
                </p>
              </div>

              <button
                onClick={() => removeStock(stock.ticker)}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white font-bold"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

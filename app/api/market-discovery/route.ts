import { NextResponse } from "next/server";

const FMP_API_KEY = process.env.FMP_API_KEY;

const OPTIONABLE_SYMBOLS = new Set([
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "META",
  "GOOGL",
  "GOOG",
  "AMD",
  "NFLX",
  "PLTR",
  "SOFI",
  "COIN",
  "MARA",
  "RIOT",
  "INTC",
  "MU",
  "AVGO",
  "QCOM",
  "SMCI",
  "BABA",
  "SHOP",
  "SQ",
  "PYPL",
  "UBER",
  "ROKU",
  "SNAP",
  "DIS",
  "BA",
  "CRM",
  "ORCL",
  "ADBE",
  "JPM",
  "BAC",
  "WFC",
  "C",
  "GS",
  "MS",
  "XOM",
  "CVX",
  "OXY",
  "WMT",
  "TGT",
  "COST",
  "NKE",
  "LULU",
  "HD",
  "LOW",
  "SBUX",
  "MCD",
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "TQQQ",
  "SQQQ",
  "SOXL",
  "SOXS",
  "TLT",
  "XLF",
  "XLE",
  "XLK",
  "XBI",
  "ARKK",
  "BITO",
]);

type FmpStock = {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changesPercentage?: number;
  exchange?: string;
};

function cleanStocks(stocks: FmpStock[]) {
  return stocks
    .filter((stock) => OPTIONABLE_SYMBOLS.has(stock.symbol))
    .filter((stock) => Number(stock.price) >= 5)
    .filter(
      (stock) =>
        stock.exchange === "NASDAQ" ||
        stock.exchange === "NYSE" ||
        stock.exchange === "AMEX",
    )
    .map((stock) => ({
      symbol: stock.symbol,
      name: stock.name || "",
      price: Number(stock.price || 0),
      change: Number(stock.change || 0),
      changesPercentage: Number(stock.changesPercentage || 0),
      exchange: stock.exchange || "",
      scannerUrl: `/scanner?symbol=${stock.symbol}`,
    }));
}

export async function GET() {
  if (!FMP_API_KEY) {
    return NextResponse.json(
      { error: "Missing FMP_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  try {
    const [gainersRes, losersRes, activeRes] = await Promise.all([
      fetch(
        `https://financialmodelingprep.com/stable/biggest-gainers?apikey=${FMP_API_KEY}`,
        {
          cache: "no-store",
        },
      ),
      fetch(
        `https://financialmodelingprep.com/stable/biggest-losers?apikey=${FMP_API_KEY}`,
        {
          cache: "no-store",
        },
      ),
      fetch(
        `https://financialmodelingprep.com/stable/most-actives?apikey=${FMP_API_KEY}`,
        {
          cache: "no-store",
        },
      ),
    ]);

    const gainers = await gainersRes.json();
    const losers = await losersRes.json();
    const active = await activeRes.json();

    const topGainers = cleanStocks(Array.isArray(gainers) ? gainers : []).slice(
      0,
      12,
    );
    const topLosers = cleanStocks(Array.isArray(losers) ? losers : []).slice(
      0,
      12,
    );
    const relativeVolume = cleanStocks(
      Array.isArray(active) ? active : [],
    ).slice(0, 12);

    return NextResponse.json({
      topGainers,
      topLosers,
      relativeVolume,
      premarket: topGainers.slice(0, 8),
      afterHours: topLosers.slice(0, 8),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load market discovery data" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

const TRADIER_ACCESS_TOKEN = process.env.TRADIER_ACCESS_TOKEN;
const TRADIER_BASE_URL =
  process.env.TRADIER_BASE_URL || "https://api.tradier.com/v1";

const WATCHLIST = [
  "PLTR",
  "SOFI",
  "AMD",
  "NVDA",
  "TSLA",
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL",
  "NFLX",
  "COIN",
  "MARA",
  "RIOT",
  "SPY",
  "QQQ",
];

type OptionContract = {
  symbol: string;
  description: string;
  option_type: "call" | "put";
  strike: number;
  expiration_date: string;
  bid: number;
  ask: number;
  last: number | null;
  volume: number | null;
  open_interest: number | null;
};

function getDte(expirationDate: string) {
  const today = new Date();
  const exp = new Date(expirationDate);
  const diff = exp.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getMidPrice(bid: number, ask: number, last: number | null) {
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  if (last && last > 0) return last;
  if (ask > 0) return ask;
  if (bid > 0) return bid;
  return 0;
}

function getSpreadPercent(bid: number, ask: number) {
  if (!bid || !ask) return 100;
  const mid = (bid + ask) / 2;
  if (mid <= 0) return 100;
  return ((ask - bid) / mid) * 100;
}

function getExpirationLabel(dte: number) {
  if (dte <= 4) return "Too Soon";
  if (dte >= 5 && dte <= 14) return "Excellent";
  if (dte >= 15 && dte <= 30) return "Good";
  if (dte >= 31 && dte <= 60) return "Moderate";
  return "Too Far";
}

function scoreContract(contract: {
  premium: number;
  volume: number;
  openInterest: number;
  spreadPercent: number;
  dte: number;
  strikeDistancePercent: number;
}) {
  let score = 0;

  if (contract.premium <= 0.25) score += 20;
  else if (contract.premium <= 0.5) score += 18;
  else if (contract.premium <= 1) score += 15;
  else if (contract.premium <= 2) score += 10;

  if (contract.openInterest >= 20000) score += 20;
  else if (contract.openInterest >= 10000) score += 18;
  else if (contract.openInterest >= 5000) score += 15;
  else if (contract.openInterest >= 1000) score += 10;
  else if (contract.openInterest >= 500) score += 7;

  if (contract.volume >= 20000) score += 20;
  else if (contract.volume >= 10000) score += 18;
  else if (contract.volume >= 5000) score += 15;
  else if (contract.volume >= 1000) score += 10;
  else if (contract.volume >= 500) score += 7;

  if (contract.spreadPercent <= 3) score += 20;
  else if (contract.spreadPercent <= 5) score += 18;
  else if (contract.spreadPercent <= 10) score += 15;
  else if (contract.spreadPercent <= 20) score += 10;
  else if (contract.spreadPercent <= 40) score += 5;

  if (contract.dte >= 7 && contract.dte <= 21) score += 10;
  else if (contract.dte >= 5 && contract.dte <= 30) score += 8;
  else if (contract.dte >= 31 && contract.dte <= 45) score += 5;

  if (contract.strikeDistancePercent <= 3) score += 10;
  else if (contract.strikeDistancePercent <= 5) score += 8;
  else if (contract.strikeDistancePercent <= 7) score += 5;

  return Math.round(score);
}

async function tradierFetch(path: string) {
  const res = await fetch(`${TRADIER_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${TRADIER_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return res.json();
}

export async function GET() {
  if (!TRADIER_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "Missing TRADIER_ACCESS_TOKEN in .env.local" },
      { status: 500 },
    );
  }

  try {
    const results = [];

    for (const symbol of WATCHLIST) {
      const quoteJson = await tradierFetch(`/markets/quotes?symbols=${symbol}`);
      const stockPrice = Number(quoteJson?.quotes?.quote?.last || 0);

      if (!stockPrice) continue;

      const expJson = await tradierFetch(
        `/markets/options/expirations?symbol=${symbol}`,
      );

      const expirations = expJson?.expirations?.date || [];
      const expirationList = Array.isArray(expirations)
        ? expirations
        : [expirations];

      const goodExpirations = expirationList.filter((date: string) => {
        const dte = getDte(date);
        return dte >= 5 && dte <= 45;
      });

      if (goodExpirations.length === 0) continue;

      const allContracts = [];

      for (const expiration of goodExpirations.slice(0, 4)) {
        const chainJson = await tradierFetch(
          `/markets/options/chains?symbol=${symbol}&expiration=${expiration}&greeks=false`,
        );

        const rawOptions = chainJson?.options?.option || [];
        const options: OptionContract[] = Array.isArray(rawOptions)
          ? rawOptions
          : [rawOptions];

        const contracts = options
          .map((contract) => {
            const bid = Number(contract.bid || 0);
            const ask = Number(contract.ask || 0);
            const last = contract.last ? Number(contract.last) : null;
            const premium = getMidPrice(bid, ask, last);
            const spreadPercent = getSpreadPercent(bid, ask);
            const dte = getDte(contract.expiration_date);
            const volume = Number(contract.volume || 0);
            const openInterest = Number(contract.open_interest || 0);
            const strike = Number(contract.strike);
            const strikeDistancePercent =
              (Math.abs(strike - stockPrice) / stockPrice) * 100;

            const mappedContract = {
              stock: symbol,
              stockPrice,
              contractSymbol: contract.symbol,
              description: contract.description,
              type: contract.option_type?.toUpperCase() || "OPTION",
              strike,
              expiration: contract.expiration_date,
              expirationQuality: getExpirationLabel(dte),
              dte,
              bid,
              ask,
              premium,
              volume,
              openInterest,
              spreadPercent,
              strikeDistancePercent,
              score: 0,
            };

            mappedContract.score = scoreContract(mappedContract);

            return mappedContract;
          })
          .filter((contract) => contract.premium > 0)
          .filter((contract) => contract.premium <= 2)
          .filter((contract) => contract.dte >= 5 && contract.dte <= 45)
          .filter((contract) => contract.strikeDistancePercent <= 7)
          .filter((contract) => contract.spreadPercent <= 60);

        allContracts.push(...contracts);
      }

      allContracts.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.volume !== a.volume) return b.volume - a.volume;
        return a.strikeDistancePercent - b.strikeDistancePercent;
      });

      if (allContracts.length > 0) {
        results.push(allContracts[0]);
      }
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      results: results.sort((a, b) => b.score - a.score),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to scan cheap options" },
      { status: 500 },
    );
  }
}

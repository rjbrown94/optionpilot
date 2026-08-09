import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StrategyProfile = "day" | "swing" | "leaps";

type MassiveOptionContract = {
  ticker: string;
  contractType: "call" | "put" | "other";
  expirationDate: string;
  strikePrice: number;
  underlyingPrice: number | null;
  breakEvenPrice: number | null;
  bid: number | null;
  ask: number | null;
  midpoint: number | null;
  spreadPercent: number | null;
  lastPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
};

type MassiveOptionsResponse = {
  success?: boolean;
  contracts?: MassiveOptionContract[];
  error?: string;
};

type OptimizedContract = {
  stock: string;
  stockPrice: number;
  contractSymbol: string;
  type: "CALL" | "PUT";
  strike: number;
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  premium: number;
  spreadPercent: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  breakEvenPrice: number | null;
  score: number;
  rating: "Excellent" | "Strong" | "Watch" | "Avoid";
  reasons: string[];
  warnings: string[];
};

const DEFAULT_WATCHLIST = [
  "SPY",
  "QQQ",
  "NVDA",
  "AMD",
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
  "TSLA",
  "PLTR",
];

function parseSymbols(value: string | null): string[] {
  if (!value) return DEFAULT_WATCHLIST;

  const symbols = value
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  return symbols.length
    ? Array.from(new Set(symbols)).slice(0, 20)
    : DEFAULT_WATCHLIST;
}

function parseStrategy(value: string | null): StrategyProfile {
  if (value === "day" || value === "leaps") return value;
  return "swing";
}

function getStrategyRules(strategy: StrategyProfile) {
  if (strategy === "day") {
    return {
      minimumDte: 0,
      maximumDte: 14,
      idealDteMinimum: 0,
      idealDteMaximum: 7,
      preferredDeltaMinimum: 0.45,
      preferredDeltaMaximum: 0.7,
      acceptableTheta: 0.25,
    };
  }

  if (strategy === "leaps") {
    return {
      minimumDte: 180,
      maximumDte: 900,
      idealDteMinimum: 270,
      idealDteMaximum: 730,
      preferredDeltaMinimum: 0.65,
      preferredDeltaMaximum: 0.85,
      acceptableTheta: 0.08,
    };
  }

  return {
    minimumDte: 7,
    maximumDte: 60,
    idealDteMinimum: 14,
    idealDteMaximum: 45,
    preferredDeltaMinimum: 0.55,
    preferredDeltaMaximum: 0.75,
    acceptableTheta: 0.15,
  };
}

function getDte(expirationDate: string): number {
  const expiration = new Date(`${expirationDate}T16:00:00-04:00`);

  return Math.max(
    0,
    Math.ceil((expiration.getTime() - Date.now()) / 86_400_000),
  );
}

function normalizeGreek(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || Math.abs(value) > 10) {
    return null;
  }

  return value;
}

function normalizeImpliedVolatility(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0 || value > 5) {
    return null;
  }

  return value;
}

function getPremium(contract: MassiveOptionContract): number {
  if (contract.midpoint !== null && contract.midpoint > 0) {
    return contract.midpoint;
  }

  if (contract.lastPrice !== null && contract.lastPrice > 0) {
    return contract.lastPrice;
  }

  if (contract.ask !== null && contract.ask > 0) {
    return contract.ask;
  }

  if (contract.bid !== null && contract.bid > 0) {
    return contract.bid;
  }

  return 0;
}

function scoreContract(
  contract: MassiveOptionContract,
  strategy: StrategyProfile,
): {
  score: number;
  reasons: string[];
  warnings: string[];
} {
  const rules = getStrategyRules(strategy);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const dte = getDte(contract.expirationDate);
  const delta = normalizeGreek(contract.delta);
  const theta = normalizeGreek(contract.theta);
  const iv = normalizeImpliedVolatility(contract.impliedVolatility);
  const absoluteDelta = delta === null ? null : Math.abs(delta);
  const spread =
    contract.spreadPercent !== null && Number.isFinite(contract.spreadPercent)
      ? contract.spreadPercent
      : null;

  if (spread !== null) {
    if (spread <= 3) {
      score += 20;
      reasons.push("Excellent bid/ask spread");
    } else if (spread <= 10) {
      score += 15;
      reasons.push("Tradable bid/ask spread");
    } else if (spread <= 20) {
      score += 7;
      warnings.push("Spread is wider than preferred");
    } else {
      warnings.push("Spread is very wide");
    }
  } else {
    warnings.push("Spread unavailable");
  }

  if (contract.openInterest >= 10_000) {
    score += 15;
    reasons.push("Strong open interest");
  } else if (contract.openInterest >= 1_000) {
    score += 10;
    reasons.push("Good open interest");
  } else if (contract.openInterest >= 250) {
    score += 5;
  } else {
    warnings.push("Low open interest");
  }

  if (contract.volume >= 5_000) {
    score += 15;
    reasons.push("Strong contract volume");
  } else if (contract.volume >= 500) {
    score += 10;
    reasons.push("Good contract volume");
  } else if (contract.volume >= 100) {
    score += 5;
  } else {
    warnings.push("Low contract volume");
  }

  if (dte >= rules.idealDteMinimum && dte <= rules.idealDteMaximum) {
    score += 15;
    reasons.push(`DTE fits the ${strategy} profile`);
  } else {
    score += 8;
  }

  if (absoluteDelta !== null) {
    if (
      absoluteDelta >= rules.preferredDeltaMinimum &&
      absoluteDelta <= rules.preferredDeltaMaximum
    ) {
      score += 20;
      reasons.push("Delta is in the preferred range");
    } else if (absoluteDelta >= 0.35 && absoluteDelta <= 0.9) {
      score += 11;
    } else {
      warnings.push("Delta is outside the preferred range");
    }
  } else {
    warnings.push("Delta unavailable");
  }

  if (iv !== null) {
    const ivPercent = iv * 100;

    if (ivPercent <= 40) {
      score += 10;
      reasons.push("IV is controlled");
    } else if (ivPercent <= 70) {
      score += 5;
    } else {
      warnings.push("IV is elevated");
    }
  } else {
    warnings.push("IV unavailable");
  }

  if (theta !== null && Math.abs(theta) <= rules.acceptableTheta) {
    score += 5;
    reasons.push("Theta decay is acceptable");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    warnings,
  };
}

function getRating(score: number): OptimizedContract["rating"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Watch";
  return "Avoid";
}

function mapContract(
  symbol: string,
  contract: MassiveOptionContract,
  strategy: StrategyProfile,
): OptimizedContract | null {
  if (contract.contractType !== "call" && contract.contractType !== "put") {
    return null;
  }

  const rules = getStrategyRules(strategy);
  const dte = getDte(contract.expirationDate);

  if (dte < rules.minimumDte || dte > rules.maximumDte) {
    return null;
  }

  const premium = getPremium(contract);

  if (premium <= 0) {
    return null;
  }

  const scoring = scoreContract(contract, strategy);

  return {
    stock: symbol,
    stockPrice: contract.underlyingPrice ?? 0,
    contractSymbol: contract.ticker,
    type: contract.contractType === "call" ? "CALL" : "PUT",
    strike: contract.strikePrice,
    expiration: contract.expirationDate,
    dte,
    bid: contract.bid ?? 0,
    ask: contract.ask ?? 0,
    premium,
    spreadPercent:
      contract.spreadPercent !== null && Number.isFinite(contract.spreadPercent)
        ? contract.spreadPercent
        : null,
    volume: contract.volume,
    openInterest: contract.openInterest,
    impliedVolatility: normalizeImpliedVolatility(contract.impliedVolatility),
    delta: normalizeGreek(contract.delta),
    gamma: normalizeGreek(contract.gamma),
    theta: normalizeGreek(contract.theta),
    vega: normalizeGreek(contract.vega),
    breakEvenPrice: contract.breakEvenPrice,
    score: scoring.score,
    rating: getRating(scoring.score),
    reasons: scoring.reasons,
    warnings: scoring.warnings,
  };
}

async function fetchSnapshot(
  origin: string,
  symbol: string,
): Promise<MassiveOptionContract[]> {
  const endpoint = new URL("/api/massive-options", origin);

  endpoint.searchParams.set("symbol", symbol);
  endpoint.searchParams.set("limit", "250");

  const response = await fetch(endpoint.toString(), {
    cache: "no-store",
  });

  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`${symbol} snapshot returned empty data.`);
  }

  const payload = JSON.parse(text) as MassiveOptionsResponse;

  if (!response.ok || payload.success === false || payload.error) {
    throw new Error(payload.error || `${symbol} snapshot failed.`);
  }

  return payload.contracts ?? [];
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const symbols = parseSymbols(requestUrl.searchParams.get("symbols"));
  const strategy = parseStrategy(requestUrl.searchParams.get("strategy"));

  const failures: Array<{
    symbol: string;
    error: string;
  }> = [];

  const results = [];

  for (const symbol of symbols) {
    try {
      const contracts = await fetchSnapshot(requestUrl.origin, symbol);

      const optimized = contracts
        .map((contract) => mapContract(symbol, contract, strategy))
        .filter((contract): contract is OptimizedContract => contract !== null);

      const bestCall =
        optimized
          .filter((contract) => contract.type === "CALL")
          .sort((first, second) => second.score - first.score)[0] ?? null;

      const bestPut =
        optimized
          .filter((contract) => contract.type === "PUT")
          .sort((first, second) => second.score - first.score)[0] ?? null;

      results.push({
        symbol,
        stockPrice: bestCall?.stockPrice ?? bestPut?.stockPrice ?? 0,
        bestCall,
        bestPut,
      });
    } catch (error) {
      failures.push({
        symbol,
        error:
          error instanceof Error ? error.message : "Unknown snapshot error.",
      });

      results.push({
        symbol,
        stockPrice: 0,
        bestCall: null,
        bestPut: null,
      });
    }
  }

  return NextResponse.json({
    success: true,
    source: "massive-options-snapshot",
    strategy,
    updatedAt: new Date().toISOString(),
    failures,
    results,
  });
}

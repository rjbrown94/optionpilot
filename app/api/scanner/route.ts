import { NextResponse } from "next/server";
import {
  calculateTradeConfirmation,
  type ConfirmationCandle,
  type TradeConfirmationResult,
} from "@/libs/scanner/tradeConfirmation";
import { getBestStrategy } from "@/libs/strategyEngine";
import { getMarketEngineResult } from "@/libs/market/marketEngine";
import {
  getMarketSnapshot,
  getSectorSnapshot,
} from "@/libs/market/marketService";
import { getScannerData } from "@/libs/market/scannerData";

type MarketStatus =
  | "OVERNIGHT"
  | "PREMARKET"
  | "MARKET OPEN"
  | "AFTER HOURS"
  | "MARKET CLOSED";

type FinalStatus = "TRADE READY" | "WATCH" | "CONFLICT" | "MARKET CLOSED";

type StockResponse = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  percentChange: number;

  trend?: string;
  bestPlay?: string;

  rsi14?: number | null;
  ema20?: number | null;
  ema50?: number | null;

  volume?: number;
  averageVolume?: number;
  relativeVolume?: number;

  support?: number | null;
  resistance?: number | null;

  candlePattern?: string;
  candleDirection?: string;
  candleConfidence?: number;

  momentumScore?: number;
  setupQuality?: string;
  score?: number;

  error?: string;
};

type Candle = {
  time: string;
  datetime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CandleResponse = {
  symbol?: string;
  interval?: string;
  candles?: Candle[];
  cached?: boolean;
  warning?: string;
  error?: string;
};

type NewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number | null;
  catalystType: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  catalystScore: number;
};

type NewsResponse = {
  symbol?: string;
  catalyst?: string;
  topCatalyst?: NewsItem | null;
  news?: NewsItem[];
  error?: string;
};

type MassiveContract = {
  ticker: string;
  contractType: "call" | "put";
  expirationDate: string;
  strikePrice: number;
  underlyingPrice: number;
  breakEvenPrice: number | null;

  bid: number;
  ask: number;
  midpoint: number;
  spread: number;
  spreadPercent: number;

  lastPrice: number | null;
  volume: number;
  openInterest: number;

  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
};

type MassiveResponse = {
  success?: boolean;
  symbol?: string;
  contractType?: string;
  contracts?: MassiveContract[];
  cached?: boolean;
  updatedAt?: string;
  error?: string;
};

type ScoreBreakdown = {
  trend: number;
  vwap: number;
  structure: number;
  ema: number;
  volume: number;
  rsi: number;
  news: number;
  market: number;
  contract: number;
};

type RecommendedContract = {
  available: boolean;
  symbol: string | null;
  type: "CALL" | "PUT" | null;
  strike: number | null;
  expiration: string | null;
  dte: number | null;

  premium: number | null;
  bid: number | null;
  ask: number | null;
  spreadPercent: number | null;

  volume: number | null;
  openInterest: number | null;

  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVolatility: number | null;
  breakEvenPrice: number | null;

  contractScore: number;
  warnings: string[];
};

const CACHE_TIME = 30_000;

type ScannerResult = {
  success: true;
  symbol: string;
  updatedAt: string;
  marketStatus: MarketStatus;
  cached: boolean;

  quote: {
    price: number;
    open: number;
    high: number;
    low: number;
    previousClose: number;
    change: number;
    percentChange: number;
  };

  technical: {
    signal: "CALL READY" | "PUT READY" | "WAIT";
    direction: "Bullish" | "Bearish" | "Mixed";
    score: number;

    price: number;
    vwap: number;
    ema9: number;
    ema20: number;
    ema50: number | null;
    rsi14: number | null;

    relativeVolume: number;
    volume: number;
    averageVolume: number;

    support: number | null;
    resistance: number | null;

    aboveVWAP: boolean;
    belowVWAP: boolean;

    higherHigh: boolean;
    higherLow: boolean;
    lowerHigh: boolean;
    lowerLow: boolean;

    bullishEMA: boolean;
    bearishEMA: boolean;
    strongVolume: boolean;

    pattern: string;
    confirmations: string[];
    warnings: string[];
  };

  news: {
    topCatalyst: NewsItem | null;
    recent: NewsItem[];
    score: number;
    bias: "Bullish" | "Bearish" | "Neutral";
  };

  market: {
    bias: string;
    capitalFlow: string;
    score: number;
    topSector: {
      name: string;
      symbol: string;
      changePercent: number;
    };
    prioritySymbols: string[];
    priorityStock: boolean;
  };

  trade: {
    bestPlay: "CALLS" | "PUTS" | "WAIT";
    status: FinalStatus;
    finalScore: number;
    setupQuality: string;
    scoreBreakdown: ScoreBreakdown;

    strategy: {
      name: string;
      score: string;
      riskLevel: string;
      reason: string;
      skip: string;
    };

    entry: string;
    stop: string;
    target: string;
    riskPlan: string;
    note: string;

    reasons: string[];
    warnings: string[];
  };

  option: RecommendedContract;
};

type CacheItem = {
  timestamp: number;
  data: ScannerResult;
};

const scannerCache = new Map<string, CacheItem>();

function getMarketStatus(): MarketStatus {
  const now = new Date();

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(now);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  const totalMinutes = hour * 60 + minute;

  if (weekday === "Sat" || weekday === "Sun") {
    return "MARKET CLOSED";
  }

  if (totalMinutes < 240) {
    return "OVERNIGHT";
  }

  if (totalMinutes < 510) {
    return "PREMARKET";
  }

  if (totalMinutes < 900) {
    return "MARKET OPEN";
  }

  if (totalMinutes < 1140) {
    return "AFTER HOURS";
  }

  return "MARKET CLOSED";
}

function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);

  let ema =
    values.slice(0, period).reduce((total, value) => total + value, 0) / period;

  for (let index = period; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(values: number[], period = 14): number | null {
  if (values.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const difference = values[index] - values[index - 1];

    if (difference >= 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let index = period + 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];

    const gain = difference > 0 ? difference : 0;

    const loss = difference < 0 ? Math.abs(difference) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;

    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;

  return 100 - 100 / (1 + relativeStrength);
}

function calculateAverage(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateDte(expiration: string): number {
  const today = new Date();
  const expirationDate = new Date(`${expiration}T12:00:00`);

  return Math.max(
    0,
    Math.ceil(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
}

function getSupport(candles: Candle[]): number | null {
  const recent = candles.slice(-20);

  if (!recent.length) {
    return null;
  }

  return Math.min(...recent.map((candle) => candle.low));
}

function getResistance(candles: Candle[]): number | null {
  const recent = candles.slice(-20);

  if (!recent.length) {
    return null;
  }

  return Math.max(...recent.map((candle) => candle.high));
}

function getPattern(confirmation: TradeConfirmationResult | null): string {
  if (!confirmation) {
    return "Not enough candle data";
  }

  if (confirmation.higherHigh && confirmation.higherLow) {
    return "Confirmed higher-high and higher-low structure";
  }

  if (confirmation.lowerHigh && confirmation.lowerLow) {
    return "Confirmed lower-high and lower-low structure";
  }

  if (confirmation.higherHigh || confirmation.higherLow) {
    return "Developing bullish structure";
  }

  if (confirmation.lowerHigh || confirmation.lowerLow) {
    return "Developing bearish structure";
  }

  return "No confirmed structure";
}

function normalizeNews(response: NewsResponse | null): {
  topCatalyst: NewsItem | null;
  recent: NewsItem[];
  score: number;
  bias: "Bullish" | "Bearish" | "Neutral";
} {
  const news = Array.isArray(response?.news) ? [...response.news] : [];

  news.sort((first, second) => {
    if (second.catalystScore !== first.catalystScore) {
      return second.catalystScore - first.catalystScore;
    }

    return (second.datetime ?? 0) - (first.datetime ?? 0);
  });

  const topCatalyst = news[0] ?? response?.topCatalyst ?? null;

  return {
    topCatalyst,
    recent: news.slice(0, 5),
    score: topCatalyst?.catalystScore ?? 0,
    bias: topCatalyst?.bias ?? "Neutral",
  };
}

function scoreContract(contract: MassiveContract): number {
  let score = 0;

  if (contract.openInterest >= 10_000) {
    score += 25;
  } else if (contract.openInterest >= 5_000) {
    score += 20;
  } else if (contract.openInterest >= 1_000) {
    score += 15;
  } else if (contract.openInterest >= 250) {
    score += 8;
  }

  if (contract.volume >= 5_000) {
    score += 20;
  } else if (contract.volume >= 1_000) {
    score += 15;
  } else if (contract.volume >= 250) {
    score += 10;
  }

  if (contract.spreadPercent <= 3) {
    score += 20;
  } else if (contract.spreadPercent <= 7) {
    score += 15;
  } else if (contract.spreadPercent <= 15) {
    score += 8;
  }

  const absoluteDelta = Math.abs(contract.delta ?? 0);

  if (absoluteDelta >= 0.5 && absoluteDelta <= 0.75) {
    score += 20;
  } else if (absoluteDelta >= 0.35 && absoluteDelta <= 0.85) {
    score += 12;
  }

  const strikeDistance =
    contract.underlyingPrice > 0
      ? (Math.abs(contract.strikePrice - contract.underlyingPrice) /
          contract.underlyingPrice) *
        100
      : 100;

  if (strikeDistance <= 2) {
    score += 15;
  } else if (strikeDistance <= 5) {
    score += 8;
  }

  return Math.min(100, score);
}

function pickBestContract(
  response: MassiveResponse | null,
  bestPlay: "CALLS" | "PUTS" | "WAIT",
): RecommendedContract {
  const contracts = response?.contracts ?? [];

  if (!contracts.length || bestPlay === "WAIT") {
    return {
      available: false,
      symbol: null,
      type: null,
      strike: null,
      expiration: null,
      dte: null,
      premium: null,
      bid: null,
      ask: null,
      spreadPercent: null,
      volume: null,
      openInterest: null,
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      impliedVolatility: null,
      breakEvenPrice: null,
      contractScore: 0,
      warnings: ["No live option contract passed the current filters."],
    };
  }

  const expectedType = bestPlay === "CALLS" ? "call" : "put";

  const ranked = contracts
    .filter((contract) => contract.contractType === expectedType)
    .filter(
      (contract) =>
        contract.bid > 0 && contract.ask > 0 && contract.ask >= contract.bid,
    )
    .map((contract) => ({
      contract,
      score: scoreContract(contract),
    }))
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return second.contract.openInterest - first.contract.openInterest;
    });

  const best = ranked[0];

  if (!best) {
    return {
      available: false,
      symbol: null,
      type: null,
      strike: null,
      expiration: null,
      dte: null,
      premium: null,
      bid: null,
      ask: null,
      spreadPercent: null,
      volume: null,
      openInterest: null,
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      impliedVolatility: null,
      breakEvenPrice: null,
      contractScore: 0,
      warnings: ["No liquid matching contract was found."],
    };
  }

  const contract = best.contract;
  const warnings: string[] = [];

  if (contract.spreadPercent > 10) {
    warnings.push("Bid/ask spread is wider than preferred.");
  }

  if (contract.volume < 100) {
    warnings.push("Option volume is currently low.");
  }

  if (contract.openInterest < 500) {
    warnings.push("Open interest is below the preferred level.");
  }

  return {
    available: true,
    symbol: contract.ticker,
    type: contract.contractType === "call" ? "CALL" : "PUT",
    strike: contract.strikePrice,
    expiration: contract.expirationDate,
    dte: calculateDte(contract.expirationDate),
    premium: contract.midpoint,
    bid: contract.bid,
    ask: contract.ask,
    spreadPercent: contract.spreadPercent,
    volume: contract.volume,
    openInterest: contract.openInterest,
    delta: contract.delta,
    gamma: contract.gamma,
    theta: contract.theta,
    vega: contract.vega,
    impliedVolatility: contract.impliedVolatility,
    breakEvenPrice: contract.breakEvenPrice,
    contractScore: best.score,
    warnings,
  };
}

function getBestPlay(input: {
  confirmation: TradeConfirmationResult | null;
  stock: StockResponse;
  newsBias: "Bullish" | "Bearish" | "Neutral";
  marketBias: string;
}): "CALLS" | "PUTS" | "WAIT" {
  const { confirmation, stock, newsBias, marketBias } = input;

  if (confirmation?.signal === "CALL READY") {
    return "CALLS";
  }

  if (confirmation?.signal === "PUT READY") {
    return "PUTS";
  }

  const bullishFactors = [
    confirmation?.direction === "Bullish",
    stock.percentChange > 0,
    newsBias === "Bullish",
    marketBias === "Bullish",
  ].filter(Boolean).length;

  const bearishFactors = [
    confirmation?.direction === "Bearish",
    stock.percentChange < 0,
    newsBias === "Bearish",
    marketBias === "Bearish",
  ].filter(Boolean).length;

  if (bullishFactors >= 3 && bullishFactors > bearishFactors) {
    return "CALLS";
  }

  if (bearishFactors >= 3 && bearishFactors > bullishFactors) {
    return "PUTS";
  }

  return "WAIT";
}

function buildScoreBreakdown(input: {
  confirmation: TradeConfirmationResult | null;
  rsi: number | null;
  newsScore: number;
  marketScore: number;
  optionScore: number;
}): ScoreBreakdown {
  const { confirmation, rsi, newsScore, marketScore, optionScore } = input;

  return {
    trend: confirmation?.direction === "Mixed" ? 5 : 10,

    vwap: confirmation?.aboveVWAP || confirmation?.belowVWAP ? 10 : 0,

    structure:
      (confirmation?.higherHigh && confirmation?.higherLow) ||
      (confirmation?.lowerHigh && confirmation?.lowerLow)
        ? 15
        : 5,

    ema: confirmation?.bullishEMA || confirmation?.bearishEMA ? 10 : 0,

    volume: confirmation?.strongVolume ? 10 : 0,

    rsi: rsi !== null && rsi >= 45 && rsi <= 70 ? 10 : 5,

    news: Math.round((newsScore / 100) * 10),

    market: Math.round((marketScore / 100) * 10),

    contract: Math.round((optionScore / 100) * 15),
  };
}

function totalScore(breakdown: ScoreBreakdown): number {
  return Math.min(
    100,
    Object.values(breakdown).reduce((total, score) => total + score, 0),
  );
}

function getSetupQuality(score: number): string {
  if (score >= 85) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 50) return "Developing";
  return "Wait";
}

function determineFinalStatus(input: {
  marketStatus: MarketStatus;
  bestPlay: "CALLS" | "PUTS" | "WAIT";
  confirmation: TradeConfirmationResult | null;
  finalScore: number;
  optionAvailable: boolean;
}): FinalStatus {
  const { marketStatus, bestPlay, confirmation, finalScore, optionAvailable } =
    input;

  if (
    marketStatus === "OVERNIGHT" ||
    marketStatus === "AFTER HOURS" ||
    marketStatus === "MARKET CLOSED"
  ) {
    return "MARKET CLOSED";
  }

  const callConflict =
    bestPlay === "CALLS" && confirmation?.direction === "Bearish";

  const putConflict =
    bestPlay === "PUTS" && confirmation?.direction === "Bullish";

  if (callConflict || putConflict) {
    return "CONFLICT";
  }

  const technicallyReady =
    confirmation?.signal === "CALL READY" ||
    confirmation?.signal === "PUT READY";

  if (
    marketStatus === "MARKET OPEN" &&
    technicallyReady &&
    optionAvailable &&
    finalScore >= 75
  ) {
    return "TRADE READY";
  }

  return "WATCH";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const symbol =
    requestUrl.searchParams.get("symbol")?.trim().toUpperCase() || "AAPL";

  const mode =
    requestUrl.searchParams.get("mode") === "swing" ? "swing" : "day";

  const forceRefresh = requestUrl.searchParams.get("refresh") === "1";

  const cacheKey = `${symbol}:${mode}`;
  const cached = scannerCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TIME) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  const marketStatus = getMarketStatus();

  let scannerData: Awaited<ReturnType<typeof getScannerData>>;

  try {
    scannerData = await getScannerData({
      symbol,
      forceRefresh,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load scanner market data.",
        symbol,
      },
      { status: 502 },
    );
  }

  const stock: StockResponse = {
    symbol,
    price: scannerData.quote.price,
    open: scannerData.quote.open,
    high: scannerData.quote.high,
    low: scannerData.quote.low,
    previousClose: scannerData.quote.previousClose,
    change: scannerData.quote.change,
    percentChange: scannerData.quote.percentChange,
    volume: scannerData.quote.volume,
    averageVolume: scannerData.quote.averageVolume,
    relativeVolume: scannerData.quote.relativeVolume,
  };

  const candleResponse: CandleResponse = {
    symbol,
    interval: "5min",
    candles: scannerData.candles,
  };

  const newsResponse: NewsResponse = {
    symbol,
    topCatalyst: scannerData.news.topCatalyst,
    news: scannerData.news.recent,
  };

  const [marketSnapshot, sectorSnapshot] = await Promise.all([
    getMarketSnapshot(),
    getSectorSnapshot(),
  ]);

  const candles = candleResponse?.candles ?? [];

  const confirmationCandles: ConfirmationCandle[] = candles.map((candle) => ({
    datetime: candle.datetime ?? candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));

  const confirmation = calculateTradeConfirmation(symbol, confirmationCandles);

  const closes = candles.map((candle) => candle.close);

  const volumes = candles.map((candle) => candle.volume);

  const rsi14 = calculateRSI(closes, 14) ?? stock.rsi14 ?? null;

  const ema20 = calculateEMA(closes, 20) ?? stock.ema20 ?? null;

  const ema50 = calculateEMA(closes, 50) ?? stock.ema50 ?? null;

  const volume = volumes[volumes.length - 1] ?? stock.volume ?? 0;

  const averageVolume =
    calculateAverage(volumes.slice(-20)) || stock.averageVolume || 0;

  const relativeVolume =
    averageVolume > 0 ? volume / averageVolume : (stock.relativeVolume ?? 0);

  const support = getSupport(candles) ?? stock.support ?? null;

  const resistance = getResistance(candles) ?? stock.resistance ?? null;

  const news = normalizeNews(newsResponse);

  const market = getMarketEngineResult(marketSnapshot, sectorSnapshot);

  const bestPlay = getBestPlay({
    confirmation,
    stock,
    newsBias: news.bias,
    marketBias: market.bias,
  });

  const massiveType = bestPlay === "PUTS" ? "put" : "call";

  let massiveResponse: MassiveResponse | null = null;

  if (bestPlay !== "WAIT") {
    try {
      const contracts = await scannerData.getOptions(massiveType);

      massiveResponse = {
        success: true,
        symbol,
        contractType: massiveType,
        contracts,
      };
    } catch {
      massiveResponse = null;
    }
  }

  const option = pickBestContract(massiveResponse, bestPlay);

  const scoreBreakdown = buildScoreBreakdown({
    confirmation,
    rsi: rsi14,
    newsScore: news.score,
    marketScore: market.score,
    optionScore: option.contractScore,
  });

  const finalScore = totalScore(scoreBreakdown);

  const status = determineFinalStatus({
    marketStatus,
    bestPlay,
    confirmation,
    finalScore,
    optionAvailable: option.available,
  });

  const direction = confirmation?.direction ?? "Mixed";

  const strategyResult = getBestStrategy({
    ticker: symbol,
    trend:
      direction === "Bullish"
        ? "bullish"
        : direction === "Bearish"
          ? "bearish"
          : "sideways",

    volatility: (option.impliedVolatility ?? 0) >= 0.6 ? "high" : "medium",

    premiumCost: (option.premium ?? 0) <= 1 ? "cheap" : "normal",

    volume: relativeVolume >= 1.5 ? "strong" : "normal",

    risk: "medium",
  });

  const reasons = [...(confirmation?.confirmations ?? [])];

  const warnings = [...(confirmation?.warnings ?? []), ...option.warnings];

  if (market.scannerPriority.includes(symbol)) {
    reasons.push("Stock belongs to the leading-sector watchlist");
  }

  if (news.topCatalyst) {
    reasons.push(`${news.topCatalyst.bias} news catalyst`);
  }

  if (marketStatus !== "MARKET OPEN") {
    warnings.push(
      "This is not a live entry signal. Reconfirm after the market opens.",
    );
  }

  if (!confirmation) {
    warnings.push(
      "Not enough valid 5-minute candles for complete technical confirmation.",
    );
  }

  if (!option.available) {
    warnings.push("No live option contract is currently recommended.");
  }

  const entry =
    bestPlay === "CALLS"
      ? resistance !== null
        ? `Above $${resistance.toFixed(2)} with volume confirmation`
        : "Wait for resistance breakout"
      : bestPlay === "PUTS"
        ? support !== null
          ? `Below $${support.toFixed(2)} with volume confirmation`
          : "Wait for support breakdown"
        : "No entry until direction confirms";

  const stop =
    bestPlay === "CALLS"
      ? support !== null
        ? `Below $${support.toFixed(2)} or below VWAP`
        : "Below VWAP or recent swing low"
      : bestPlay === "PUTS"
        ? resistance !== null
          ? `Above $${resistance.toFixed(2)} or above VWAP`
          : "Above VWAP or recent swing high"
        : "No stop until a trade setup exists";

  const target =
    bestPlay === "CALLS"
      ? "Next resistance or prior session high"
      : bestPlay === "PUTS"
        ? "Next support or prior session low"
        : "No target until direction confirms";

  const result: ScannerResult = {
    success: true,
    symbol,
    updatedAt: new Date().toISOString(),
    marketStatus,
    cached: false,

    quote: {
      price: stock.price,
      open: stock.open,
      high: stock.high,
      low: stock.low,
      previousClose: stock.previousClose,
      change: stock.change,
      percentChange: stock.percentChange,
    },

    technical: {
      signal: confirmation?.signal ?? "WAIT",

      direction: confirmation?.direction ?? "Mixed",

      score: confirmation?.score ?? 0,

      price: confirmation?.price ?? stock.price,

      vwap: confirmation?.vwap ?? 0,

      ema9: confirmation?.ema9 ?? 0,

      ema20: confirmation?.ema20 ?? ema20 ?? 0,

      ema50,

      rsi14,

      relativeVolume,
      volume,
      averageVolume,

      support,
      resistance,

      aboveVWAP: confirmation?.aboveVWAP ?? false,

      belowVWAP: confirmation?.belowVWAP ?? false,

      higherHigh: confirmation?.higherHigh ?? false,

      higherLow: confirmation?.higherLow ?? false,

      lowerHigh: confirmation?.lowerHigh ?? false,

      lowerLow: confirmation?.lowerLow ?? false,

      bullishEMA: confirmation?.bullishEMA ?? false,

      bearishEMA: confirmation?.bearishEMA ?? false,

      strongVolume: confirmation?.strongVolume ?? false,

      pattern: getPattern(confirmation),

      confirmations: confirmation?.confirmations ?? [],

      warnings: confirmation?.warnings ?? [],
    },

    news,

    market: {
      bias: market.bias,
      capitalFlow: market.capitalFlow,
      score: market.score,
      topSector: market.topSector,
      prioritySymbols: market.scannerPriority,
      priorityStock: market.scannerPriority.includes(symbol),
    },

    trade: {
      bestPlay,
      status,
      finalScore,
      setupQuality: getSetupQuality(finalScore),
      scoreBreakdown,

      strategy: {
        name: strategyResult.strategy,
        score: strategyResult.score,
        riskLevel: strategyResult.riskLevel,
        reason: strategyResult.reason,
        skip: strategyResult.skip,
      },

      entry,
      stop,
      target,

      riskPlan:
        "Risk only 1–2% of the account and verify the broker quote before entering.",

      note:
        status === "TRADE READY"
          ? "The market, technical direction, and option contract are aligned."
          : "Wait until market direction, technical confirmation, and option liquidity align.",

      reasons: Array.from(new Set(reasons)),

      warnings: Array.from(new Set(warnings)),
    },

    option,
  };

  scannerCache.set(cacheKey, {
    timestamp: Date.now(),
    data: result,
  });

  return NextResponse.json(result);
}

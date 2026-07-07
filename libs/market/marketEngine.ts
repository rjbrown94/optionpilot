import type {
  CapitalFlow,
  MarketBias,
  MarketEngineResult,
  MacroIndicator,
  SectorSignal,
} from "./types";

import type { LiveQuote } from "./marketService";

import { mockMacroIndicators } from "./mockData";

function quoteToMacro(quote: LiveQuote): MacroIndicator {
  return {
    name: quote.symbol,
    symbol: quote.symbol,
    value: `${quote.percentChange.toFixed(2)}%`,
    changePercent: quote.percentChange,
    direction:
      quote.percentChange > 0
        ? "up"
        : quote.percentChange < 0
          ? "down"
          : "flat",
  };
}

function calculateLiveScore(quotes: LiveQuote[]) {
  let score = 50;

  const get = (symbol: string) => quotes.find((q) => q.symbol === symbol);

  const spy = get("SPY");
  const qqq = get("QQQ");
  const dia = get("DIA");
  const iwm = get("IWM");
  const vixy = get("VIXY");

  if (spy?.percentChange! > 0) score += 15;
  if (spy?.percentChange! < 0) score -= 15;

  if (qqq?.percentChange! > 0) score += 20;
  if (qqq?.percentChange! < 0) score -= 20;

  if (dia?.percentChange! > 0) score += 10;
  if (dia?.percentChange! < 0) score -= 10;

  if (iwm?.percentChange! > 0) score += 10;
  if (iwm?.percentChange! < 0) score -= 10;

  // Lower VIXY = Risk On
  if (vixy?.percentChange! < 0) score += 15;
  if (vixy?.percentChange! > 0) score -= 15;

  return Math.max(0, Math.min(score, 100));
}

function getBias(score: number): MarketBias {
  if (score >= 70) return "Bullish";
  if (score <= 35) return "Bearish";
  return "Neutral";
}

function getCapitalFlow(score: number): CapitalFlow {
  if (score >= 70) return "Risk-On";
  if (score <= 35) return "Risk-Off";
  return "Mixed";
}

function getScannerPriority(capitalFlow: CapitalFlow) {
  if (capitalFlow === "Risk-On") {
    return ["NVDA", "AMD", "AVGO", "TSM", "MU"];
  }

  if (capitalFlow === "Risk-Off") {
    return ["GLD", "XLU", "SQQQ"];
  }

  return ["SPY", "QQQ", "IWM"];
}

function buildSummary(
  bias: MarketBias,
  capitalFlow: CapitalFlow,
  score: number,
) {
  return `Live market conditions are currently ${bias.toLowerCase()} with ${capitalFlow.toLowerCase()} behavior. The market score is ${score}/100 based on SPY, QQQ, DIA, IWM, and VIXY movement.`;
}

export function getMarketEngineResult(
  liveQuotes: LiveQuote[],
  sectorQuotes: LiveQuote[] = [],
): MarketEngineResult {
  if (!liveQuotes.length) {
    return {
      bias: "Neutral",
      capitalFlow: "Mixed",
      score: 50,
      topSector: {
        name: "Unknown",
        symbol: "--",
        changePercent: 0,
      },
      macro: mockMacroIndicators,
      sectors: [],
      scannerPriority: ["SPY", "QQQ"],
      summary:
        "Live market data is unavailable, so OptionPilot is using a neutral market view.",
    };
  }

  const score = calculateLiveScore(liveQuotes);

  const bias = getBias(score);

  const capitalFlow = getCapitalFlow(score);

  const strongestSector =
    sectorQuotes.length > 0
      ? [...sectorQuotes].sort((a, b) => b.percentChange - a.percentChange)[0]
      : undefined;

  const topSector: SectorSignal = {
    name: strongestSector?.symbol ?? "Unknown",
    symbol: strongestSector?.symbol ?? "--",
    changePercent: strongestSector?.percentChange ?? 0,
  };

  return {
    bias,
    capitalFlow,
    score,
    topSector,
    macro: liveQuotes.map(quoteToMacro),
    sectors: [],
    scannerPriority: getScannerPriority(capitalFlow),
    summary: buildSummary(bias, capitalFlow, score),
  };
}

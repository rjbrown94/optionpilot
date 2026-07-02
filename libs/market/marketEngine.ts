import {
  CapitalFlow,
  MarketBias,
  MarketEngineResult,
  MacroIndicator,
  SectorSignal,
} from "./types";
import { mockMacroIndicators, mockSectorStrength } from "./mockData";

function getIndicator(symbol: string, macro: MacroIndicator[]) {
  return macro.find((item) => item.symbol === symbol);
}

function calculateScore(macro: MacroIndicator[], sectors: SectorSignal[]) {
  let score = 50;

  const spy = getIndicator("SPY", macro);
  const qqq = getIndicator("QQQ", macro);
  const dxy = getIndicator("DXY", macro);
  const vix = getIndicator("VIX", macro);
  const yield10 = getIndicator("10Y", macro);

  if (spy && spy.changePercent > 0) score += 10;
  if (qqq && qqq.changePercent > 0) score += 15;
  if (dxy && dxy.changePercent < 0) score += 10;
  if (vix && vix.changePercent < 0) score += 10;
  if (yield10 && yield10.changePercent < 0) score += 10;

  const topSector = [...sectors].sort(
    (a, b) => b.changePercent - a.changePercent,
  )[0];

  if (topSector?.symbol === "SMH" || topSector?.symbol === "XLK") {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
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

function getScannerPriority(topSector: SectorSignal) {
  if (topSector.symbol === "SMH") {
    return ["NVDA", "AMD", "AVGO", "MU", "TSM"];
  }

  if (topSector.symbol === "XLK") {
    return ["MSFT", "AAPL", "META", "PLTR", "CRM"];
  }

  if (topSector.symbol === "XLE") {
    return ["XOM", "CVX", "OXY", "SLB"];
  }

  if (topSector.symbol === "XLF") {
    return ["JPM", "BAC", "GS", "MS"];
  }

  return ["SPY", "QQQ", "IWM"];
}

function buildSummary(
  bias: MarketBias,
  capitalFlow: CapitalFlow,
  topSector: SectorSignal,
) {
  return `Market conditions are currently ${bias.toLowerCase()} with ${capitalFlow.toLowerCase()} behavior. ${topSector.name} is showing the strongest relative strength, so scanner priority should focus on stocks connected to ${topSector.name.toLowerCase()} first.`;
}

export function getMarketEngineResult(): MarketEngineResult {
  const macro = mockMacroIndicators;
  const sectors = mockSectorStrength;

  const topSector = [...sectors].sort(
    (a, b) => b.changePercent - a.changePercent,
  )[0];

  const score = calculateScore(macro, sectors);
  const bias = getBias(score);
  const capitalFlow = getCapitalFlow(score);
  const scannerPriority = getScannerPriority(topSector);
  const summary = buildSummary(bias, capitalFlow, topSector);

  return {
    bias,
    capitalFlow,
    score,
    topSector,
    macro,
    sectors,
    scannerPriority,
    summary,
  };
}

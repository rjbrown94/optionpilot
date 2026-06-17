export interface StrategyInputs {
  ticker: string;
  trend: string;
  volatility: string;
  premiumCost: string;
  volume: string;
  risk: string;
}

export interface StrategyResult {
  strategy: string;
  score: string;
  riskLevel: string;
  reason: string;
  skip: string;
}

export function getBestStrategy(inputs: StrategyInputs): StrategyResult {
  const { trend, volatility, premiumCost, volume, risk } = inputs;

  if (trend === "bullish" && volume === "strong") {
    return {
      strategy: "Bull Call Spread",
      score: "85/100",
      riskLevel: "Defined",
      reason:
        "Bullish trend with strong volume favors a bullish options setup.",
      skip: "Skip if price is near major resistance.",
    };
  }

  if (trend === "bearish" && volume === "strong") {
    return {
      strategy: "Bear Put Spread",
      score: "84/100",
      riskLevel: "Defined",
      reason: "Bearish trend with strong volume favors a bearish spread setup.",
      skip: "Skip if support is nearby.",
    };
  }

  if (volatility === "high" && risk === "high") {
    return {
      strategy: "Long Straddle",
      score: "82/100",
      riskLevel: "High",
      reason: "High volatility can create large moves in either direction.",
      skip: "Skip if options are extremely expensive.",
    };
  }

  if (volatility === "high" && premiumCost === "cheap") {
    return {
      strategy: "Long Strangle",
      score: "80/100",
      riskLevel: "High",
      reason: "High volatility with cheaper premiums favors a strangle.",
      skip: "Skip if volatility already expanded.",
    };
  }

  if (trend === "sideways" && volatility === "low") {
    return {
      strategy: "Iron Condor",
      score: "78/100",
      riskLevel: "Defined",
      reason:
        "Low volatility and range-bound price action favor premium selling.",
      skip: "Skip before earnings or major news.",
    };
  }

  return {
    strategy: "No Trade",
    score: "45/100",
    riskLevel: "Avoid",
    reason:
      "The setup is not clean enough yet. The app needs a stronger trend, better volume, or better premium setup.",
    skip: "Wait for a clearer breakout, breakdown, stronger volume, or better risk/reward.",
  };
}

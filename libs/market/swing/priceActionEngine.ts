import type { SwingCandle } from "./twelveDataSwing";

export type PriceActionResult = {
  bullishRejection: boolean;
  bearishRejection: boolean;

  strongBullishBody: boolean;
  strongBearishBody: boolean;

  bullishMomentum: boolean;
  bearishMomentum: boolean;

  volumeIncreasing: boolean;

  score: number;
  reasons: string[];
};

export function analyzePriceAction(
  candles: SwingCandle[],
): PriceActionResult {
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  if (!latest || !previous) {
    return {
      bullishRejection: false,
      bearishRejection: false,
      strongBullishBody: false,
      strongBearishBody: false,
      bullishMomentum: false,
      bearishMomentum: false,
      volumeIncreasing: false,
      score: 50,
      reasons: ["Not enough candles for price-action analysis."],
    };
  }

  const range = Math.max(latest.high - latest.low, 0.0001);
  const body = Math.abs(latest.close - latest.open);

  const upperWick =
    latest.high - Math.max(latest.open, latest.close);

  const lowerWick =
    Math.min(latest.open, latest.close) - latest.low;

  const bodyRatio = body / range;

  const bullishRejection =
    lowerWick > body * 1.5 &&
    latest.close > latest.open;

  const bearishRejection =
    upperWick > body * 1.5 &&
    latest.close < latest.open;

  const strongBullishBody =
    latest.close > latest.open &&
    bodyRatio >= 0.6;

  const strongBearishBody =
    latest.close < latest.open &&
    bodyRatio >= 0.6;

  const bullishMomentum =
    latest.close > previous.close &&
    latest.high >= previous.high;

  const bearishMomentum =
    latest.close < previous.close &&
    latest.low <= previous.low;

  const volumeIncreasing =
    latest.volume > 0 &&
    previous.volume > 0 &&
    latest.volume > previous.volume;

  let score = 50;

  const reasons: string[] = [];

  if (bullishRejection) {
    score += 15;
    reasons.push("Long lower wick shows bullish rejection.");
  }

  if (bearishRejection) {
    score -= 15;
    reasons.push("Long upper wick shows bearish rejection.");
  }

  if (strongBullishBody) {
    score += 15;
    reasons.push("Strong bullish candle body shows buyer commitment.");
  }

  if (strongBearishBody) {
    score -= 15;
    reasons.push("Strong bearish candle body shows seller commitment.");
  }

  if (bullishMomentum) {
    score += 10;
    reasons.push("Recent candle shows bullish follow-through.");
  }

  if (bearishMomentum) {
    score -= 10;
    reasons.push("Recent candle shows bearish follow-through.");
  }

  if (volumeIncreasing) {
    reasons.push("Volume increased versus the previous candle.");
  }

  return {
    bullishRejection,
    bearishRejection,
    strongBullishBody,
    strongBearishBody,
    bullishMomentum,
    bearishMomentum,
    volumeIncreasing,
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

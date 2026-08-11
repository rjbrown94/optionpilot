import type { SwingCandle } from "./twelveDataSwing";
import type { TrendResult } from "./trendEngine";

export type FibonacciLevels = {
  high: number;
  low: number;

  level382: number;
  level500: number;
  level618: number;
  level786: number;
};

export type ZoneResult = {
  fibonacci: FibonacciLevels | null;

  location:
    | "SHALLOW_PULLBACK"
    | "EQUILIBRIUM"
    | "GOLDEN_ZONE"
    | "DEEP_RETRACEMENT"
    | "EXTENDED"
    | "UNKNOWN";

  nearSupport: boolean;
  nearResistance: boolean;

  reasons: string[];
};

function withinPercent(
  price: number,
  level: number,
  percent = 1.5,
): boolean {
  if (level === 0) return false;

  return Math.abs((price - level) / level) * 100 <= percent;
}

export function analyzeZones(
  candles: SwingCandle[],
  trend: TrendResult,
): ZoneResult {
  const current = candles[candles.length - 1];

  if (!current) {
    return {
      fibonacci: null,
      location: "UNKNOWN",
      nearSupport: false,
      nearResistance: false,
      reasons: ["No daily candles are available."],
    };
  }

  const latestHigh =
    trend.swingHighs.length > 0
      ? trend.swingHighs[trend.swingHighs.length - 1].price
      : null;

  const latestLow =
    trend.swingLows.length > 0
      ? trend.swingLows[trend.swingLows.length - 1].price
      : null;

  const reasons: string[] = [];

  if (latestHigh === null || latestLow === null || latestHigh <= latestLow) {
    return {
      fibonacci: null,
      location: "UNKNOWN",
      nearSupport:
        trend.support !== null &&
        withinPercent(current.close, trend.support),
      nearResistance:
        trend.resistance !== null &&
        withinPercent(current.close, trend.resistance),
      reasons: ["A confirmed swing high and swing low are required for Fibonacci."],
    };
  }

  const range = latestHigh - latestLow;

  let level382: number;
  let level500: number;
  let level618: number;
  let level786: number;

  if (trend.trend === "DOWNTREND") {
    level382 = latestLow + range * 0.382;
    level500 = latestLow + range * 0.5;
    level618 = latestLow + range * 0.618;
    level786 = latestLow + range * 0.786;
  } else {
    level382 = latestHigh - range * 0.382;
    level500 = latestHigh - range * 0.5;
    level618 = latestHigh - range * 0.618;
    level786 = latestHigh - range * 0.786;
  }

  const fibonacci: FibonacciLevels = {
    high: latestHigh,
    low: latestLow,
    level382,
    level500,
    level618,
    level786,
  };

  let location: ZoneResult["location"] = "EXTENDED";

  if (withinPercent(current.close, level382, 1.25)) {
    location = "SHALLOW_PULLBACK";
    reasons.push("Price is near the 0.382 Fibonacci retracement.");
  } else if (withinPercent(current.close, level500, 1.25)) {
    location = "EQUILIBRIUM";
    reasons.push("Price is near the 0.500 equilibrium retracement.");
  } else if (withinPercent(current.close, level618, 1.5)) {
    location = "GOLDEN_ZONE";
    reasons.push("Price is near the 0.618 Fibonacci golden zone.");
  } else if (withinPercent(current.close, level786, 1.5)) {
    location = "DEEP_RETRACEMENT";
    reasons.push("Price is near the deep 0.786 retracement.");
  }

  const nearSupport =
    trend.support !== null &&
    withinPercent(current.close, trend.support);

  const nearResistance =
    trend.resistance !== null &&
    withinPercent(current.close, trend.resistance);

  if (nearSupport) {
    reasons.push("Price is near a confirmed swing support.");
  }

  if (nearResistance) {
    reasons.push("Price is near a confirmed swing resistance.");
  }

  return {
    fibonacci,
    location,
    nearSupport,
    nearResistance,
    reasons,
  };
}

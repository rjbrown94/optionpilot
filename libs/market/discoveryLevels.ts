import {
  getSwingCandles,
  type SwingCandle,
} from "./swing/twelveDataSwing";

import {
  analyzeTrend,
  type TrendDirection,
} from "./swing/trendEngine";

import {
  analyzeZones,
  type ZoneResult,
} from "./swing/zoneEngine";

export type DiscoveryLevelSetup =
  | "NEAR_SUPPORT"
  | "NEAR_RESISTANCE"
  | "BREAKOUT"
  | "BREAKDOWN"
  | "NO_KEY_LEVEL";

export type DiscoveryLevelResult = {
  symbol: string;

  currentPrice: number | null;

  support: number | null;
  resistance: number | null;

  distanceToSupportPercent: number | null;
  distanceToResistancePercent: number | null;

  nearSupport: boolean;
  nearResistance: boolean;

  bullishBreakout: boolean;
  bearishBreakdown: boolean;

  trend: TrendDirection;
  trendConfidence: number;

  setup: DiscoveryLevelSetup;

  zoneLocation: ZoneResult["location"];

  reasons: string[];
};

function round(
  value: number,
  digits = 2,
): number {
  const multiplier = 10 ** digits;

  return Math.round(value * multiplier) / multiplier;
}

function distancePercent(
  price: number | null,
  level: number | null,
): number | null {
  if (
    price === null ||
    level === null ||
    level === 0
  ) {
    return null;
  }

  return round(
    Math.abs((price - level) / level) * 100,
  );
}

export async function analyzeDiscoveryLevels({
  symbol,
}: {
  symbol: string;
}): Promise<DiscoveryLevelResult> {
  /*
   * Reuse the existing Twelve Data swing engine.
   *
   * Daily candles establish the important
   * support/resistance levels.
   *
   * The 5-minute scanner still handles
   * actual entry confirmation.
   */
  const candles: SwingCandle[] =
    await getSwingCandles(
      symbol,
      "1day",
      60,
    );

  if (candles.length < 10) {
    throw new Error(
      `Not enough daily candles for ${symbol}.`,
    );
  }

  const trend =
    analyzeTrend(candles);

  const zones =
    analyzeZones(
      candles,
      trend,
    );

  const currentPrice =
    trend.currentPrice;

  const distanceToSupportPercent =
    distancePercent(
      currentPrice,
      trend.support,
    );

  const distanceToResistancePercent =
    distancePercent(
      currentPrice,
      trend.resistance,
    );

  let setup: DiscoveryLevelSetup =
    "NO_KEY_LEVEL";

  /*
   * A confirmed break of structure takes
   * priority over simple proximity.
   */
  if (trend.bullishBreakout) {
    setup = "BREAKOUT";
  } else if (trend.bearishBreakdown) {
    setup = "BREAKDOWN";
  } else if (
    zones.nearSupport &&
    zones.nearResistance
  ) {
    const supportDistance =
      distanceToSupportPercent ??
      Number.POSITIVE_INFINITY;

    const resistanceDistance =
      distanceToResistancePercent ??
      Number.POSITIVE_INFINITY;

    setup =
      supportDistance <=
      resistanceDistance
        ? "NEAR_SUPPORT"
        : "NEAR_RESISTANCE";
  } else if (zones.nearSupport) {
    setup = "NEAR_SUPPORT";
  } else if (zones.nearResistance) {
    setup = "NEAR_RESISTANCE";
  }

  const reasons = [
    ...trend.reasons,
    ...zones.reasons,
  ];

  if (
    setup === "NEAR_SUPPORT" &&
    trend.support !== null
  ) {
    reasons.unshift(
      `Price is ${distanceToSupportPercent?.toFixed(
        2,
      )}% from confirmed support at $${trend.support.toFixed(
        2,
      )}.`,
    );
  }

  if (
    setup === "NEAR_RESISTANCE" &&
    trend.resistance !== null
  ) {
    reasons.unshift(
      `Price is ${distanceToResistancePercent?.toFixed(
        2,
      )}% from confirmed resistance at $${trend.resistance.toFixed(
        2,
      )}.`,
    );
  }

  if (
    setup === "BREAKOUT" &&
    trend.resistance !== null
  ) {
    reasons.unshift(
      `Price has broken above confirmed resistance near $${trend.resistance.toFixed(
        2,
      )}.`,
    );
  }

  if (
    setup === "BREAKDOWN" &&
    trend.support !== null
  ) {
    reasons.unshift(
      `Price has broken below confirmed support near $${trend.support.toFixed(
        2,
      )}.`,
    );
  }

  return {
    symbol,

    currentPrice,

    support:
      trend.support,

    resistance:
      trend.resistance,

    distanceToSupportPercent,

    distanceToResistancePercent,

    nearSupport:
      zones.nearSupport,

    nearResistance:
      zones.nearResistance,

    bullishBreakout:
      trend.bullishBreakout,

    bearishBreakdown:
      trend.bearishBreakdown,

    trend:
      trend.trend,

    trendConfidence:
      trend.confidence,

    setup,

    zoneLocation:
      zones.location,

    reasons,
  };
}

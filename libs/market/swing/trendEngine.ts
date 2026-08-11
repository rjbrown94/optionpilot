import type { SwingCandle } from "./twelveDataSwing";

export type SwingPoint = {
  index: number;
  datetime: string;
  price: number;
};

export type TrendDirection = "UPTREND" | "DOWNTREND" | "RANGE" | "UNKNOWN";

export type TrendResult = {
  trend: TrendDirection;

  higherHigh: boolean;
  higherLow: boolean;

  lowerHigh: boolean;
  lowerLow: boolean;

  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];

  resistance: number | null;
  support: number | null;

  confidence: number;

  structureScore: number;
  highTrendScore: number;
  lowTrendScore: number;
  closeSlopePercent: number;

  bullishBreakout: boolean;
  bearishBreakdown: boolean;

  currentPrice: number | null;

  reasons: string[];
};

const RECENT_SWING_COUNT = 6;
const RECENT_CLOSE_COUNT = 12;

/*
 * Price must move slightly beyond the level
 * so tiny moves above/below a swing do not
 * automatically count as a breakout.
 */
const BREAKOUT_BUFFER_PERCENT = 0.15;

function findSwingHighs(candles: SwingCandle[], width = 2): SwingPoint[] {
  const points: SwingPoint[] = [];

  for (let index = width; index < candles.length - width; index += 1) {
    const current = candles[index];

    let highest = true;

    for (let offset = 1; offset <= width; offset += 1) {
      if (
        current.high <= candles[index - offset].high ||
        current.high <= candles[index + offset].high
      ) {
        highest = false;
        break;
      }
    }

    if (highest) {
      points.push({
        index,
        datetime: current.datetime,
        price: current.high,
      });
    }
  }

  return points;
}

function findSwingLows(candles: SwingCandle[], width = 2): SwingPoint[] {
  const points: SwingPoint[] = [];

  for (let index = width; index < candles.length - width; index += 1) {
    const current = candles[index];

    let lowest = true;

    for (let offset = 1; offset <= width; offset += 1) {
      if (
        current.low >= candles[index - offset].low ||
        current.low >= candles[index + offset].low
      ) {
        lowest = false;
        break;
      }
    }

    if (lowest) {
      points.push({
        index,
        datetime: current.datetime,
        price: current.low,
      });
    }
  }

  return points;
}

function calculateSwingDirectionScore(points: SwingPoint[]): number {
  const recent = points.slice(-RECENT_SWING_COUNT);

  if (recent.length < 2) {
    return 0;
  }

  let rising = 0;
  let falling = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1].price;
    const current = recent[index].price;

    if (current > previous) {
      rising += 1;
    } else if (current < previous) {
      falling += 1;
    }
  }

  const comparisons = recent.length - 1;

  if (comparisons <= 0) {
    return 0;
  }

  return (rising - falling) / comparisons;
}

function calculateCloseSlopePercent(candles: SwingCandle[]): number {
  const recent = candles.slice(-RECENT_CLOSE_COUNT);

  if (recent.length < 2) {
    return 0;
  }

  const first = recent[0].close;
  const last = recent[recent.length - 1].close;

  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return 0;
  }

  return ((last - first) / first) * 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function percentAbove(price: number, level: number): number {
  if (level === 0) {
    return 0;
  }

  return ((price - level) / level) * 100;
}

function percentBelow(price: number, level: number): number {
  if (level === 0) {
    return 0;
  }

  return ((level - price) / level) * 100;
}

export function analyzeTrend(candles: SwingCandle[]): TrendResult {
  const swingHighs = findSwingHighs(candles);
  const swingLows = findSwingLows(candles);

  const latestHighs = swingHighs.slice(-2);
  const latestLows = swingLows.slice(-2);

  const higherHigh =
    latestHighs.length === 2 && latestHighs[1].price > latestHighs[0].price;

  const lowerHigh =
    latestHighs.length === 2 && latestHighs[1].price < latestHighs[0].price;

  const higherLow =
    latestLows.length === 2 && latestLows[1].price > latestLows[0].price;

  const lowerLow =
    latestLows.length === 2 && latestLows[1].price < latestLows[0].price;

  const highTrendScore = calculateSwingDirectionScore(swingHighs);

  const lowTrendScore = calculateSwingDirectionScore(swingLows);

  const closeSlopePercent = calculateCloseSlopePercent(candles);

  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  const currentPrice = latestCandle?.close ?? null;

  const resistance =
    swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;

  const support =
    swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null;

  /*
   * BREAKOUT / BREAKDOWN
   *
   * This is the big refinement.
   *
   * A stock can have:
   *
   * Higher Low ✓
   * Lower High ✓
   *
   * but then CURRENT PRICE can break above
   * that lower high.
   *
   * In that situation, we should not blindly
   * label the market RANGE.
   */
  const bullishBreakout =
    currentPrice !== null &&
    resistance !== null &&
    percentAbove(currentPrice, resistance) >= BREAKOUT_BUFFER_PERCENT;

  const bearishBreakdown =
    currentPrice !== null &&
    support !== null &&
    percentBelow(currentPrice, support) >= BREAKOUT_BUFFER_PERCENT;

  let structureScore = 0;

  /*
   * Broader swing structure.
   */
  structureScore += highTrendScore * 35;
  structureScore += lowTrendScore * 40;

  /*
   * Recent close direction.
   */
  if (closeSlopePercent >= 5) {
    structureScore += 15;
  } else if (closeSlopePercent >= 2) {
    structureScore += 10;
  } else if (closeSlopePercent > 0) {
    structureScore += 5;
  } else if (closeSlopePercent <= -5) {
    structureScore -= 15;
  } else if (closeSlopePercent <= -2) {
    structureScore -= 10;
  } else if (closeSlopePercent < 0) {
    structureScore -= 5;
  }

  /*
   * Most recent confirmed pivots.
   */
  if (higherHigh) {
    structureScore += 8;
  }

  if (higherLow) {
    structureScore += 12;
  }

  if (lowerHigh) {
    structureScore -= 8;
  }

  if (lowerLow) {
    structureScore -= 12;
  }

  /*
   * BREAK OF STRUCTURE
   *
   * A confirmed move through the latest
   * swing level receives significant weight.
   */
  if (bullishBreakout) {
    structureScore += 25;
  }

  if (bearishBreakdown) {
    structureScore -= 25;
  }

  /*
   * Higher low + bullish breakout is especially
   * meaningful for continuation.
   */
  if (higherLow && bullishBreakout) {
    structureScore += 10;
  }

  /*
   * Lower high + bearish breakdown is especially
   * meaningful for bearish continuation.
   */
  if (lowerHigh && bearishBreakdown) {
    structureScore -= 10;
  }

  structureScore = clamp(structureScore, -100, 100);

  let trend: TrendDirection = "UNKNOWN";
  let confidence = 50;

  const reasons: string[] = [];

  /*
   * BULLISH CLASSIFICATION
   */
  if (structureScore >= 20) {
    trend = "UPTREND";

    confidence = clamp(
      Math.round(60 + Math.abs(structureScore) * 0.35),
      60,
      95,
    );

    reasons.push("The broader swing structure is bullish.");

    if (highTrendScore > 0) {
      reasons.push("Recent swing highs are rising overall.");
    }

    if (lowTrendScore > 0) {
      reasons.push("Recent swing lows are rising overall.");
    }

    if (closeSlopePercent > 0) {
      reasons.push(
        `Recent closes have a positive slope of ${closeSlopePercent.toFixed(
          2,
        )}%.`,
      );
    }

    if (higherHigh) {
      reasons.push("The latest confirmed swing high is a higher high.");
    }

    if (higherLow) {
      reasons.push("The latest confirmed swing low is a higher low.");
    }

    if (bullishBreakout && resistance !== null && currentPrice !== null) {
      reasons.push(
        `Price at $${currentPrice.toFixed(
          2,
        )} has broken above the latest confirmed swing resistance near $${resistance.toFixed(
          2,
        )}.`,
      );
    }

    if (higherLow && bullishBreakout) {
      reasons.push(
        "Higher-low structure plus a breakout supports bullish continuation.",
      );
    }
  } else if (structureScore <= -20) {

  /*
   * BEARISH CLASSIFICATION
   */
    trend = "DOWNTREND";

    confidence = clamp(
      Math.round(60 + Math.abs(structureScore) * 0.35),
      60,
      95,
    );

    reasons.push("The broader swing structure is bearish.");

    if (highTrendScore < 0) {
      reasons.push("Recent swing highs are falling overall.");
    }

    if (lowTrendScore < 0) {
      reasons.push("Recent swing lows are falling overall.");
    }

    if (closeSlopePercent < 0) {
      reasons.push(
        `Recent closes have a negative slope of ${closeSlopePercent.toFixed(
          2,
        )}%.`,
      );
    }

    if (lowerHigh) {
      reasons.push("The latest confirmed swing high is a lower high.");
    }

    if (lowerLow) {
      reasons.push("The latest confirmed swing low is a lower low.");
    }

    if (bearishBreakdown && support !== null && currentPrice !== null) {
      reasons.push(
        `Price at $${currentPrice.toFixed(
          2,
        )} has broken below the latest confirmed swing support near $${support.toFixed(
          2,
        )}.`,
      );
    }

    if (lowerHigh && bearishBreakdown) {
      reasons.push(
        "Lower-high structure plus a support breakdown supports bearish continuation.",
      );
    }
  } else if (

  /*
   * TRUE RANGE
   *
   * We only call RANGE when:
   * - structure score remains weak
   * - no breakout exists
   * - no breakdown exists
   */
    swingHighs.length >= 2 &&
    swingLows.length >= 2 &&
    !bullishBreakout &&
    !bearishBreakdown
  ) {
    trend = "RANGE";

    confidence = clamp(Math.round(65 - Math.abs(structureScore)), 50, 70);

    reasons.push(
      "Broader swing highs and swing lows remain mixed without a confirmed breakout or breakdown.",
    );

    if (Math.abs(closeSlopePercent) < 2) {
      reasons.push("Recent closes are relatively flat.");
    }
  } else if (bullishBreakout && !bearishBreakdown) {

  /*
   * Transitional structure.
   *
   * If price has broken structure but the score
   * is still just under our normal trend threshold,
   * let the breakout direction resolve the trend
   * rather than falsely calling RANGE.
   */
    trend = "UPTREND";

    confidence = 60;

    reasons.push(
      "Price has broken above confirmed swing resistance, shifting weekly structure bullish.",
    );
  } else if (bearishBreakdown && !bullishBreakout) {
    trend = "DOWNTREND";

    confidence = 60;

    reasons.push(
      "Price has broken below confirmed swing support, shifting weekly structure bearish.",
    );
  } else {
    reasons.push(
      "Not enough confirmed evidence is available to classify the trend.",
    );
  }

  return {
    trend,

    higherHigh,
    higherLow,

    lowerHigh,
    lowerLow,

    swingHighs,
    swingLows,

    resistance,
    support,

    confidence,

    structureScore: Math.round(structureScore),

    highTrendScore: Number(highTrendScore.toFixed(2)),

    lowTrendScore: Number(lowTrendScore.toFixed(2)),

    closeSlopePercent: Number(closeSlopePercent.toFixed(2)),

    bullishBreakout,
    bearishBreakdown,

    currentPrice,

    reasons,
  };
}

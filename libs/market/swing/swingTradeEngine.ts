import { analyzePriceAction } from "./priceActionEngine";
import { analyzeTrend } from "./trendEngine";
import type { SwingCandle } from "./twelveDataSwing";
import { analyzeZones } from "./zoneEngine";

export type SwingBias = "CALL" | "PUT" | "NEUTRAL";

export type EntryStatus = "READY" | "WAIT";

export type SwingDecision = "CALL" | "PUT" | "WAIT";

export type SwingTradeResult = {
  symbol: string;

  /*
   * Direction we want to stalk.
   *
   * CALL = bullish swing thesis
   * PUT = bearish swing thesis
   * NEUTRAL = no clean directional thesis
   */
  bias: SwingBias;

  /*
   * Whether the actual trade is ready.
   */
  entryStatus: EntryStatus;

  /*
   * Final actionable result.
   *
   * CALL / PUT only when entry is confirmed.
   * Otherwise WAIT.
   */
  decision: SwingDecision;

  score: number;

  weekly: ReturnType<typeof analyzeTrend>;
  daily: ReturnType<typeof analyzeTrend>;
  hourly: ReturnType<typeof analyzeTrend>;

  zones: ReturnType<typeof analyzeZones>;

  dailyPriceAction: ReturnType<typeof analyzePriceAction>;
  hourlyPriceAction: ReturnType<typeof analyzePriceAction>;

  alignment: {
    weeklyDaily: boolean;
    weeklyHourly: boolean;
    allAligned: boolean;
  };

  reasons: string[];
  warnings: string[];

  nextAction: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function analyzeSwingTrade({
  symbol,
  weeklyCandles,
  dailyCandles,
  hourlyCandles,
}: {
  symbol: string;
  weeklyCandles: SwingCandle[];
  dailyCandles: SwingCandle[];
  hourlyCandles: SwingCandle[];
}): SwingTradeResult {
  /*
   * ------------------------------------------------------
   * 1. ANALYZE EACH TIMEFRAME
   * ------------------------------------------------------
   */

  const weekly = analyzeTrend(weeklyCandles);

  const daily = analyzeTrend(dailyCandles);

  const hourly = analyzeTrend(hourlyCandles);

  /*
   * Daily location / Fibonacci.
   */
  const zones = analyzeZones(dailyCandles, daily);

  /*
   * Daily = setup behavior.
   * Hourly = execution behavior.
   */
  const dailyPriceAction = analyzePriceAction(dailyCandles);

  const hourlyPriceAction = analyzePriceAction(hourlyCandles);

  /*
   * ------------------------------------------------------
   * 2. TIMEFRAME ALIGNMENT
   * ------------------------------------------------------
   */

  const weeklyDaily =
    weekly.trend === daily.trend &&
    weekly.trend !== "UNKNOWN" &&
    weekly.trend !== "RANGE";

  const weeklyHourly =
    weekly.trend === hourly.trend &&
    weekly.trend !== "UNKNOWN" &&
    weekly.trend !== "RANGE";

  const allAligned = weeklyDaily && weeklyHourly;

  /*
   * ------------------------------------------------------
   * 3. BUILD BULLISH / BEARISH CONVICTION
   * ------------------------------------------------------
   */

  let bullishScore = 50;
  let bearishScore = 50;

  const reasons: string[] = [];
  const warnings: string[] = [];

  /*
   * ======================================================
   * WEEKLY = HEAD COACH
   * ======================================================
   */

  if (weekly.trend === "UPTREND") {
    bullishScore += 20;
    bearishScore -= 20;

    reasons.push(
      `Weekly trend is bullish with a structure score of ${weekly.structureScore}.`,
    );
  } else if (weekly.trend === "DOWNTREND") {
    bearishScore += 20;
    bullishScore -= 20;

    reasons.push(
      `Weekly trend is bearish with a structure score of ${weekly.structureScore}.`,
    );
  } else if (weekly.trend === "RANGE") {
    warnings.push("Weekly structure is ranging.");
  } else {
    warnings.push("Weekly trend is not confirmed.");
  }

  /*
   * Latest weekly structure.
   */

  if (weekly.higherHigh) {
    bullishScore += 5;

    reasons.push("Weekly structure has a higher high.");
  }

  if (weekly.higherLow) {
    bullishScore += 7;

    reasons.push("Weekly structure has a higher low.");
  }

  if (weekly.lowerHigh) {
    bearishScore += 5;

    reasons.push("Weekly structure has a lower high.");
  }

  if (weekly.lowerLow) {
    bearishScore += 7;

    reasons.push("Weekly structure has a lower low.");
  }

  /*
   * Break of structure.
   */

  if (weekly.bullishBreakout) {
    bullishScore += 8;

    reasons.push("Weekly price has broken above confirmed swing resistance.");
  }

  if (weekly.bearishBreakdown) {
    bearishScore += 8;

    reasons.push("Weekly price has broken below confirmed swing support.");
  }

  /*
   * ======================================================
   * DAILY = SWING SETUP
   * ======================================================
   */

  if (weekly.trend === "UPTREND" && daily.trend === "UPTREND") {
    bullishScore += 12;

    reasons.push("Daily timeframe is aligned with the bullish weekly trend.");
  } else if (weekly.trend === "DOWNTREND" && daily.trend === "DOWNTREND") {
    bearishScore += 12;

    reasons.push("Daily timeframe is aligned with the bearish weekly trend.");
  } else {
    warnings.push(
      "Daily timeframe is not fully aligned with the weekly trend.",
    );
  }

  /*
   * ======================================================
   * HOURLY = ENTRY
   * ======================================================
   */

  if (weekly.trend === "UPTREND" && hourly.trend === "UPTREND") {
    bullishScore += 10;

    reasons.push("Hourly timeframe confirms the bullish swing direction.");
  }

  if (weekly.trend === "DOWNTREND" && hourly.trend === "DOWNTREND") {
    bearishScore += 10;

    reasons.push("Hourly timeframe confirms the bearish swing direction.");
  }

  if (!weeklyHourly) {
    warnings.push("Hourly entry timeframe is not fully aligned.");
  }

  /*
   * ======================================================
   * FIBONACCI / PRICE LOCATION
   * ======================================================
   */

  if (zones.location === "SHALLOW_PULLBACK") {
    if (weekly.trend === "UPTREND") {
      bullishScore += 5;
    }

    if (weekly.trend === "DOWNTREND") {
      bearishScore += 5;
    }

    reasons.push("Price is near the 0.382 Fibonacci retracement.");
  }

  if (zones.location === "EQUILIBRIUM") {
    if (weekly.trend === "UPTREND") {
      bullishScore += 6;
    }

    if (weekly.trend === "DOWNTREND") {
      bearishScore += 6;
    }

    reasons.push("Price is near the 0.500 equilibrium retracement.");
  }

  if (zones.location === "GOLDEN_ZONE") {
    if (weekly.trend === "UPTREND") {
      bullishScore += 8;
    }

    if (weekly.trend === "DOWNTREND") {
      bearishScore += 8;
    }

    reasons.push("Price is near the 0.618 Fibonacci golden zone.");
  }

  if (zones.location === "DEEP_RETRACEMENT") {
    warnings.push("Price is near the deep 0.786 Fibonacci retracement.");
  }

  /*
   * EXTENDED is not automatically bearish.
   *
   * It means the stock may have a good trend,
   * but the pullback location is not ideal.
   */

  if (zones.location === "EXTENDED") {
    warnings.push(
      "Price is extended from the preferred Fibonacci pullback area.",
    );
  }

  /*
   * ======================================================
   * SUPPORT / RESISTANCE
   * ======================================================
   */

  if (zones.nearSupport && weekly.trend === "UPTREND") {
    bullishScore += 6;

    reasons.push("Price is near support inside a bullish weekly trend.");
  }

  if (zones.nearResistance && weekly.trend === "DOWNTREND") {
    bearishScore += 6;

    reasons.push("Price is near resistance inside a bearish weekly trend.");
  }

  if (zones.nearResistance && weekly.trend === "UPTREND") {
    warnings.push("Price is near resistance despite the bullish weekly trend.");
  }

  if (zones.nearSupport && weekly.trend === "DOWNTREND") {
    warnings.push("Price is near support despite the bearish weekly trend.");
  }

  /*
   * ======================================================
   * DAILY PRICE ACTION
   * ======================================================
   */

  if (dailyPriceAction.bullishRejection) {
    bullishScore += 6;

    reasons.push("Daily candle shows bullish rejection.");
  }

  if (dailyPriceAction.bearishRejection) {
    bearishScore += 6;

    reasons.push("Daily candle shows bearish rejection.");
  }

  if (dailyPriceAction.strongBullishBody) {
    bullishScore += 5;

    reasons.push("Daily candle shows strong bullish commitment.");
  }

  if (dailyPriceAction.strongBearishBody) {
    bearishScore += 5;

    reasons.push("Daily candle shows strong bearish commitment.");
  }

  if (dailyPriceAction.bullishMomentum) {
    bullishScore += 5;

    reasons.push("Daily price action shows bullish follow-through.");
  }

  if (dailyPriceAction.bearishMomentum) {
    bearishScore += 5;

    reasons.push("Daily price action shows bearish follow-through.");
  }

  /*
   * ======================================================
   * HOURLY PRICE ACTION
   * ======================================================
   */

  if (hourlyPriceAction.bullishRejection) {
    bullishScore += 4;

    reasons.push("Hourly candle shows bullish rejection.");
  }

  if (hourlyPriceAction.bearishRejection) {
    bearishScore += 4;

    reasons.push("Hourly candle shows bearish rejection.");
  }

  if (hourlyPriceAction.bullishMomentum) {
    bullishScore += 5;

    reasons.push("Hourly price action shows bullish entry momentum.");
  }

  if (hourlyPriceAction.bearishMomentum) {
    bearishScore += 5;

    reasons.push("Hourly price action shows bearish entry momentum.");
  }

  /*
   * ======================================================
   * VOLUME
   * ======================================================
   */

  if (dailyPriceAction.volumeIncreasing) {
    reasons.push("Daily volume increased versus the previous candle.");

    if (weekly.trend === "UPTREND") {
      bullishScore += 3;
    }

    if (weekly.trend === "DOWNTREND") {
      bearishScore += 3;
    }
  }

  if (hourlyPriceAction.volumeIncreasing) {
    reasons.push("Hourly volume increased versus the previous candle.");

    if (weekly.trend === "UPTREND") {
      bullishScore += 2;
    }

    if (weekly.trend === "DOWNTREND") {
      bearishScore += 2;
    }
  }

  /*
   * ------------------------------------------------------
   * 4. NORMALIZE SCORE
   * ------------------------------------------------------
   */

  bullishScore = clamp(Math.round(bullishScore), 0, 100);

  bearishScore = clamp(Math.round(bearishScore), 0, 100);

  /*
   * Higher score = bullish.
   * Lower score = bearish.
   */
  const score = clamp(
    Math.round((bullishScore + (100 - bearishScore)) / 2),
    0,
    100,
  );

  /*
   * ------------------------------------------------------
   * 5. DETERMINE DIRECTIONAL BIAS
   * ------------------------------------------------------
   *
   * Weekly + Daily determine WHAT direction
   * we should be interested in.
   */

  let bias: SwingBias = "NEUTRAL";

  if (weekly.trend === "UPTREND" && daily.trend === "UPTREND" && score >= 60) {
    bias = "CALL";
  }

  if (
    weekly.trend === "DOWNTREND" &&
    daily.trend === "DOWNTREND" &&
    score <= 40
  ) {
    bias = "PUT";
  }

  /*
   * Weekly RANGE or UNKNOWN means no
   * directional swing bias.
   */

  if (weekly.trend === "RANGE" || weekly.trend === "UNKNOWN") {
    bias = "NEUTRAL";
  }

  /*
   * ------------------------------------------------------
   * 6. DETERMINE ENTRY READINESS
   * ------------------------------------------------------
   *
   * Hourly determines WHEN.
   */

  let entryStatus: EntryStatus = "WAIT";

  /*
   * Bullish entry confirmation.
   */
  const bullishHourlyConfirmation =
    hourly.trend === "UPTREND" &&
    (hourlyPriceAction.bullishMomentum ||
      hourlyPriceAction.bullishRejection ||
      hourlyPriceAction.strongBullishBody);

  /*
   * Bearish entry confirmation.
   */
  const bearishHourlyConfirmation =
    hourly.trend === "DOWNTREND" &&
    (hourlyPriceAction.bearishMomentum ||
      hourlyPriceAction.bearishRejection ||
      hourlyPriceAction.strongBearishBody);

  if (bias === "CALL" && bullishHourlyConfirmation) {
    entryStatus = "READY";
  }

  if (bias === "PUT" && bearishHourlyConfirmation) {
    entryStatus = "READY";
  }

  /*
   * ------------------------------------------------------
   * 7. FINAL ACTIONABLE DECISION
   * ------------------------------------------------------
   */

  let decision: SwingDecision = "WAIT";

  if (bias === "CALL" && entryStatus === "READY") {
    decision = "CALL";
  }

  if (bias === "PUT" && entryStatus === "READY") {
    decision = "PUT";
  }

  /*
   * ------------------------------------------------------
   * 8. WARNINGS / NEXT ACTION
   * ------------------------------------------------------
   */

  if (bias === "CALL" && entryStatus === "WAIT") {
    warnings.push(
      "Bullish swing thesis exists, but the hourly entry has not confirmed yet.",
    );
  }

  if (bias === "PUT" && entryStatus === "WAIT") {
    warnings.push(
      "Bearish swing thesis exists, but the hourly entry has not confirmed yet.",
    );
  }

  if (weekly.trend === "RANGE") {
    warnings.push("Weekly range conditions prevent a directional swing bias.");
  }

  if (weekly.trend === "UNKNOWN") {
    warnings.push(
      "OptionPilot will not create a swing bias without a confirmed weekly trend.",
    );
  }

  let nextAction = "Wait for a clearer weekly and daily swing setup.";

  if (bias === "CALL" && entryStatus === "WAIT") {
    nextAction =
      "Keep CALL bias, but wait for the 1-hour chart to confirm bullish momentum or rejection before entering.";
  }

  if (bias === "PUT" && entryStatus === "WAIT") {
    nextAction =
      "Keep PUT bias, but wait for the 1-hour chart to confirm bearish momentum or rejection before entering.";
  }

  if (bias === "CALL" && entryStatus === "READY") {
    nextAction =
      "Bullish swing direction and hourly entry are aligned. Confirm Smart Money flow before selecting a CALL contract.";
  }

  if (bias === "PUT" && entryStatus === "READY") {
    nextAction =
      "Bearish swing direction and hourly entry are aligned. Confirm Smart Money flow before selecting a PUT contract.";
  }

  return {
    symbol,

    bias,
    entryStatus,
    decision,

    score,

    weekly,
    daily,
    hourly,

    zones,

    dailyPriceAction,
    hourlyPriceAction,

    alignment: {
      weeklyDaily,
      weeklyHourly,
      allAligned,
    },

    reasons,
    warnings,

    nextAction,
  };
}

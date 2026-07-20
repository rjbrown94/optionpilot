export type ConfirmationCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TradeSignal = "CALL READY" | "PUT READY" | "WAIT";

export type TradeConfirmationResult = {
  symbol: string;
  signal: TradeSignal;
  direction: "Bullish" | "Bearish" | "Mixed";
  score: number;

  price: number;
  vwap: number;
  ema9: number;
  ema20: number;
  relativeVolume: number;

  aboveVWAP: boolean;
  belowVWAP: boolean;

  higherHigh: boolean;
  higherLow: boolean;
  lowerHigh: boolean;
  lowerLow: boolean;

  bullishEMA: boolean;
  bearishEMA: boolean;
  strongVolume: boolean;

  confirmations: string[];
  warnings: string[];
};

function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const emaValues: number[] = [values[0]];

  for (let index = 1; index < values.length; index += 1) {
    const previousEMA = emaValues[index - 1];

    emaValues.push(values[index] * multiplier + previousEMA * (1 - multiplier));
  }

  return emaValues;
}

function calculateSessionVWAP(candles: ConfirmationCandle[]): number {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = Number.isFinite(candle.volume)
      ? Math.max(candle.volume, 0)
      : 0;

    cumulativePriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;
  }

  if (cumulativeVolume === 0) {
    return candles[candles.length - 1]?.close ?? 0;
  }

  return cumulativePriceVolume / cumulativeVolume;
}

function calculateRelativeVolume(
  candles: ConfirmationCandle[],
  averagePeriod = 20,
): number {
  if (candles.length < 2) {
    return 0;
  }

  const latest = candles[candles.length - 1];

  const previousCandles = candles.slice(
    Math.max(0, candles.length - averagePeriod - 1),
    candles.length - 1,
  );

  if (previousCandles.length === 0) {
    return 0;
  }

  const averageVolume =
    previousCandles.reduce((total, candle) => total + candle.volume, 0) /
    previousCandles.length;

  if (averageVolume <= 0) {
    return 0;
  }

  return latest.volume / averageVolume;
}

function normalizeCandles(candles: ConfirmationCandle[]): ConfirmationCandle[] {
  return candles
    .filter(
      (candle) =>
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume),
    )
    .sort(
      (first, second) =>
        new Date(first.datetime).getTime() -
        new Date(second.datetime).getTime(),
    );
}

export function calculateTradeConfirmation(
  symbol: string,
  rawCandles: ConfirmationCandle[],
): TradeConfirmationResult | null {
  const candles = normalizeCandles(rawCandles);

  /*
   * We need at least 20 candles for a meaningful 20 EMA.
   * Thirty completed 5-minute candles is preferred.
   */
  if (candles.length < 20) {
    return null;
  }

  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  const closingPrices = candles.map((candle) => candle.close);

  const ema9Values = calculateEMA(closingPrices, 9);
  const ema20Values = calculateEMA(closingPrices, 20);

  const ema9 = ema9Values[ema9Values.length - 1];
  const ema20 = ema20Values[ema20Values.length - 1];

  const vwap = calculateSessionVWAP(candles);
  const relativeVolume = calculateRelativeVolume(candles);

  const aboveVWAP = latest.close > vwap;
  const belowVWAP = latest.close < vwap;

  const higherHigh = latest.high > previous.high;
  const higherLow = latest.low > previous.low;

  const lowerHigh = latest.high < previous.high;
  const lowerLow = latest.low < previous.low;

  const bullishEMA = ema9 > ema20;
  const bearishEMA = ema9 < ema20;

  const strongVolume = relativeVolume >= 1.5;

  let bullishScore = 0;
  let bearishScore = 0;

  /*
   * VWAP alignment: 25 points
   */
  if (aboveVWAP) {
    bullishScore += 25;
  }

  if (belowVWAP) {
    bearishScore += 25;
  }

  /*
   * Market structure: 40 points
   */
  if (higherHigh) {
    bullishScore += 20;
  }

  if (higherLow) {
    bullishScore += 20;
  }

  if (lowerHigh) {
    bearishScore += 20;
  }

  if (lowerLow) {
    bearishScore += 20;
  }

  /*
   * EMA alignment: 20 points
   */
  if (bullishEMA) {
    bullishScore += 20;
  }

  if (bearishEMA) {
    bearishScore += 20;
  }

  /*
   * Relative volume: 15 points
   */
  if (strongVolume) {
    bullishScore += 15;
    bearishScore += 15;
  }

  const bullishSetup =
    aboveVWAP && higherHigh && higherLow && bullishEMA && strongVolume;

  const bearishSetup =
    belowVWAP && lowerHigh && lowerLow && bearishEMA && strongVolume;

  let signal: TradeSignal = "WAIT";
  let direction: "Bullish" | "Bearish" | "Mixed" = "Mixed";
  let score = Math.max(bullishScore, bearishScore);

  if (bullishSetup && bullishScore >= 80) {
    signal = "CALL READY";
    direction = "Bullish";
    score = bullishScore;
  } else if (bearishSetup && bearishScore >= 80) {
    signal = "PUT READY";
    direction = "Bearish";
    score = bearishScore;
  } else if (bullishScore > bearishScore) {
    direction = "Bullish";
    score = bullishScore;
  } else if (bearishScore > bullishScore) {
    direction = "Bearish";
    score = bearishScore;
  }

  score = Math.max(0, Math.min(score, 100));

  const confirmations: string[] = [];
  const warnings: string[] = [];

  if (aboveVWAP) confirmations.push("Above VWAP");
  if (belowVWAP) confirmations.push("Below VWAP");

  if (higherHigh) confirmations.push("Higher high");
  if (higherLow) confirmations.push("Higher low");

  if (lowerHigh) confirmations.push("Lower high");
  if (lowerLow) confirmations.push("Lower low");

  if (bullishEMA) confirmations.push("9 EMA above 20 EMA");
  if (bearishEMA) confirmations.push("9 EMA below 20 EMA");

  if (strongVolume) {
    confirmations.push(
      `Volume ${(relativeVolume * 100).toFixed(0)}% of average`,
    );
  } else {
    warnings.push(
      `Volume only ${(relativeVolume * 100).toFixed(0)}% of average`,
    );
  }

  if (!aboveVWAP && !belowVWAP) {
    warnings.push("Price is sitting directly on VWAP");
  }

  if (signal === "WAIT") {
    warnings.push("All entry confirmations are not aligned");
  }

  return {
    symbol,
    signal,
    direction,
    score,

    price: latest.close,
    vwap,
    ema9,
    ema20,
    relativeVolume,

    aboveVWAP,
    belowVWAP,

    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow,

    bullishEMA,
    bearishEMA,
    strongVolume,

    confirmations,
    warnings,
  };
}

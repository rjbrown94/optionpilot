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

function getNewYorkDateTime(datetime: string): {
  dateKey: string;
  minutes: number;
} | null {
  const date = new Date(datetime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  const hour = Number(getPart("hour"));
  const minute = Number(getPart("minute"));

  if (
    !year ||
    !month ||
    !day ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
  };
}

function calculateSessionVWAP(candles: ConfirmationCandle[]): number {
  const REGULAR_SESSION_OPEN = 9 * 60 + 30;
  const REGULAR_SESSION_CLOSE = 16 * 60;

  const regularSessionCandles = candles
    .map((candle) => ({
      candle,
      session: getNewYorkDateTime(candle.datetime),
    }))
    .filter(
      (
        item,
      ): item is {
        candle: ConfirmationCandle;
        session: {
          dateKey: string;
          minutes: number;
        };
      } =>
        item.session !== null &&
        item.session.minutes >= REGULAR_SESSION_OPEN &&
        item.session.minutes < REGULAR_SESSION_CLOSE,
    );

  if (regularSessionCandles.length === 0) {
    return candles[candles.length - 1]?.close ?? 0;
  }

  /*
   * VWAP resets every regular trading session.
   * Use only the most recent U.S. market session
   * represented in the candle data.
   */
  const latestSessionDate =
    regularSessionCandles[regularSessionCandles.length - 1].session.dateKey;

  const latestSessionCandles = regularSessionCandles.filter(
    (item) => item.session.dateKey === latestSessionDate,
  );

  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  for (const { candle } of latestSessionCandles) {
    const typicalPrice =
      (candle.high + candle.low + candle.close) / 3;

    const volume = Number.isFinite(candle.volume)
      ? Math.max(candle.volume, 0)
      : 0;

    cumulativePriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;
  }

  if (cumulativeVolume === 0) {
    return latestSessionCandles[
      latestSessionCandles.length - 1
    ]?.candle.close ?? 0;
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

  const closingPrices = candles.map((candle) => candle.close);

  const ema9Values = calculateEMA(closingPrices, 9);
  const ema20Values = calculateEMA(closingPrices, 20);

  const ema9 = ema9Values[ema9Values.length - 1];
  const ema20 = ema20Values[ema20Values.length - 1];

  const vwap = calculateSessionVWAP(candles);
  const relativeVolume = calculateRelativeVolume(candles);

  const aboveVWAP = latest.close > vwap;
  const belowVWAP = latest.close < vwap;

  const bullishEMA = ema9 > ema20;
  const bearishEMA = ema9 < ema20;

  const strongVolume = relativeVolume >= 1.5;

  let bullishScore = 0;
  let bearishScore = 0;

  /*
   * DAY TRADE CONFIRMATION
   *
   * Core setup:
   * - VWAP alignment: 35 points
   * - EMA 9/20 alignment: 35 points
   * - Relative volume: 30 points
   *
   * HH / HL / LH / LL market-structure requirements
   * are intentionally not used by the Day Trade Scanner.
   */

  if (aboveVWAP) {
    bullishScore += 35;
  }

  if (belowVWAP) {
    bearishScore += 35;
  }

  if (bullishEMA) {
    bullishScore += 35;
  }

  if (bearishEMA) {
    bearishScore += 35;
  }

  if (strongVolume) {
    bullishScore += 30;
    bearishScore += 30;
  }

  const bullishSetup =
    aboveVWAP && bullishEMA && strongVolume;

  const bearishSetup =
    belowVWAP && bearishEMA && strongVolume;

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

    bullishEMA,
    bearishEMA,
    strongVolume,

    confirmations,
    warnings,
  };
}

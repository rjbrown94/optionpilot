export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleScanResult = {
  candle: string;
  direction: "CALLS" | "PUTS" | "WAIT";
  confidence: number;
};

export function scanCandles(candles: Candle[]): CandleScanResult {
  if (candles.length < 2) {
    return {
      candle: "No confirmed candle",
      direction: "WAIT",
      confidence: 0,
    };
  }

  if (detectBullishEngulfing(candles)) {
    return {
      candle: "Bullish Engulfing",
      direction: "CALLS",
      confidence: 85,
    };
  }

  if (detectBearishEngulfing(candles)) {
    return {
      candle: "Bearish Engulfing",
      direction: "PUTS",
      confidence: 85,
    };
  }

  if (detectHammer(candles)) {
    return {
      candle: "Hammer",
      direction: "CALLS",
      confidence: 75,
    };
  }

  if (detectShootingStar(candles)) {
    return {
      candle: "Shooting Star",
      direction: "PUTS",
      confidence: 75,
    };
  }

  return {
    candle: "No confirmed candle",
    direction: "WAIT",
    confidence: 0,
  };
}

export function detectBullishEngulfing(candles: Candle[]) {
  if (candles.length < 2) return false;

  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];

  return (
    prev.close < prev.open &&
    current.close > current.open &&
    current.open < prev.close &&
    current.close > prev.open
  );
}

export function detectBearishEngulfing(candles: Candle[]) {
  if (candles.length < 2) return false;

  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];

  return (
    prev.close > prev.open &&
    current.close < current.open &&
    current.open > prev.close &&
    current.close < prev.open
  );
}

export function detectHammer(candles: Candle[]) {
  const candle = candles[candles.length - 1];

  if (!candle) return false;

  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);

  if (range === 0) return false;

  return lowerShadow >= body * 2 && upperShadow <= body && body / range <= 0.4;
}

export function detectShootingStar(candles: Candle[]) {
  const candle = candles[candles.length - 1];

  if (!candle) return false;

  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;

  if (range === 0) return false;

  return upperShadow >= body * 2 && lowerShadow <= body && body / range <= 0.4;
}

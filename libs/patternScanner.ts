import { Candle } from "./candleScanner";

export type PatternScanResult = {
  pattern: string;
  direction: "CALLS" | "PUTS" | "WAIT";
  confidence: number;
};

export function scanPatterns(candles: Candle[]): PatternScanResult {
  if (candles.length < 20) {
    return {
      pattern: "No confirmed pattern",
      direction: "WAIT",
      confidence: 0,
    };
  }

  if (detectBullFlag(candles)) {
    return {
      pattern: "Bull Flag",
      direction: "CALLS",
      confidence: 90,
    };
  }

  if (detectBearFlag(candles)) {
    return {
      pattern: "Bear Flag",
      direction: "PUTS",
      confidence: 90,
    };
  }

  if (detectCupAndHandle(candles)) {
    return {
      pattern: "Cup & Handle",
      direction: "CALLS",
      confidence: 88,
    };
  }

  if (detectDoubleBottom(candles)) {
    return {
      pattern: "Double Bottom",
      direction: "CALLS",
      confidence: 86,
    };
  }

  if (detectAscendingTriangle(candles)) {
    return {
      pattern: "Ascending Triangle",
      direction: "CALLS",
      confidence: 85,
    };
  }

  if (detectDescendingTriangle(candles)) {
    return {
      pattern: "Descending Triangle",
      direction: "PUTS",
      confidence: 85,
    };
  }

  return {
    pattern: "No confirmed pattern",
    direction: "WAIT",
    confidence: 0,
  };
}

function detectBullFlag(candles: Candle[]) {
  const recent = candles.slice(-10);

  const firstClose = recent[0].close;
  const lastClose = recent[recent.length - 1].close;

  return lastClose > firstClose * 1.05;
}

function detectBearFlag(candles: Candle[]) {
  const recent = candles.slice(-10);

  const firstClose = recent[0].close;
  const lastClose = recent[recent.length - 1].close;

  return lastClose < firstClose * 0.95;
}

function detectAscendingTriangle(candles: Candle[]) {
  const recent = candles.slice(-15);

  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);

  const maxHigh = Math.max(...highs);
  const minHigh = Math.min(...highs);

  const risingLows = lows[lows.length - 1] > lows[0];

  return (maxHigh - minHigh) / maxHigh < 0.02 && risingLows;
}

function detectDescendingTriangle(candles: Candle[]) {
  const recent = candles.slice(-15);

  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);

  const maxLow = Math.max(...lows);
  const minLow = Math.min(...lows);

  const fallingHighs = highs[highs.length - 1] < highs[0];

  return (maxLow - minLow) / maxLow < 0.02 && fallingHighs;
}

function detectCupAndHandle(candles: Candle[]) {
  if (candles.length < 40) return false;

  const recent = candles.slice(-40);

  const left = recent.slice(0, 12);
  const middle = recent.slice(12, 28);
  const right = recent.slice(28, 36);
  const handle = recent.slice(36);

  const leftHigh = Math.max(...left.map((c) => c.high));
  const middleLow = Math.min(...middle.map((c) => c.low));
  const rightHigh = Math.max(...right.map((c) => c.high));

  const handleLow = Math.min(...handle.map((c) => c.low));
  const lastClose = recent[recent.length - 1].close;

  const cupDepth = (leftHigh - middleLow) / leftHigh;
  const rightNearLeftHigh = Math.abs(rightHigh - leftHigh) / leftHigh < 0.06;
  const handlePullback = (rightHigh - handleLow) / rightHigh;

  return (
    cupDepth >= 0.08 &&
    cupDepth <= 0.35 &&
    rightNearLeftHigh &&
    handlePullback > 0 &&
    handlePullback <= 0.12 &&
    lastClose >= handleLow
  );
}

function detectDoubleBottom(candles: Candle[]) {
  if (candles.length < 30) return false;

  const recent = candles.slice(-30);

  const firstHalf = recent.slice(0, 15);
  const secondHalf = recent.slice(15);

  const firstBottom = Math.min(...firstHalf.map((c) => c.low));
  const secondBottom = Math.min(...secondHalf.map((c) => c.low));

  const bottomsClose =
    Math.abs(firstBottom - secondBottom) / firstBottom < 0.04;

  const neckline = Math.max(...recent.map((c) => c.high));
  const lastClose = recent[recent.length - 1].close;

  const recoveredFromBottom = (lastClose - secondBottom) / secondBottom > 0.05;

  return bottomsClose && recoveredFromBottom && lastClose < neckline * 1.03;
}

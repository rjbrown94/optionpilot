export type GexContract = {
  ticker: string;
  contractType: "call" | "put" | "other";
  strikePrice: number;
  expirationDate: string;
  gamma: number | null;
  openInterest: number;
  underlyingPrice: number | null;
};

export type GexStrike = {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
  absoluteGex: number;
  contracts: number;
};

export type GexResult = {
  underlyingPrice: number;
  model: "calls-positive-puts-negative";
  unit: "USD per 1% underlying move";
  totalNetGex: number;
  totalAbsoluteGex: number;
  largestConcentration: GexStrike | null;
  closestZeroCrossing: number | null;
  strikes: GexStrike[];
  eligibleContracts: number;
  excludedContracts: number;
};

export function calculateGex(
  contracts: GexContract[],
  underlyingPrice: number,
): GexResult {
  if (!Number.isFinite(underlyingPrice) || underlyingPrice <= 0) {
    throw new Error("A valid underlying price is required for GEX.");
  }

  const byStrike = new Map<number, GexStrike>();
  let eligibleContracts = 0;

  for (const contract of contracts) {
    const { gamma, openInterest, strikePrice, contractType } = contract;
    if (
      (contractType !== "call" && contractType !== "put") ||
      gamma === null || !Number.isFinite(gamma) || gamma < 0 ||
      !Number.isFinite(openInterest) || openInterest <= 0 ||
      !Number.isFinite(strikePrice) || strikePrice <= 0
    ) continue;

    const dollarsPerOnePercent = gamma * openInterest * 100 * underlyingPrice ** 2 * 0.01;
    const signed = contractType === "call" ? dollarsPerOnePercent : -dollarsPerOnePercent;
    const row = byStrike.get(strikePrice) ?? {
      strike: strikePrice, callGex: 0, putGex: 0,
      netGex: 0, absoluteGex: 0, contracts: 0,
    };
    if (contractType === "call") row.callGex += dollarsPerOnePercent;
    else row.putGex -= dollarsPerOnePercent;
    row.netGex += signed;
    row.absoluteGex += dollarsPerOnePercent;
    row.contracts += 1;
    byStrike.set(strikePrice, row);
    eligibleContracts += 1;
  }

  const strikes = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  const largestConcentration = [...strikes].sort((a, b) => b.absoluteGex - a.absoluteGex)[0] ?? null;
  const totalNetGex = strikes.reduce((sum, row) => sum + row.netGex, 0);
  const totalAbsoluteGex = strikes.reduce((sum, row) => sum + row.absoluteGex, 0);

  // A zero crossing across strike-level net GEX is not a dealer gamma flip.
  // It is a descriptive strike-profile crossing only.
  const crossings: number[] = [];
  for (let i = 1; i < strikes.length; i++) {
    const left = strikes[i - 1];
    const right = strikes[i];
    if (left.netGex * right.netGex < 0) {
      const weight = Math.abs(left.netGex) / (Math.abs(left.netGex) + Math.abs(right.netGex));
      crossings.push(left.strike + weight * (right.strike - left.strike));
    }
  }
  const closestZeroCrossing = crossings.sort((a, b) => Math.abs(a - underlyingPrice) - Math.abs(b - underlyingPrice))[0] ?? null;

  return {
    underlyingPrice, model: "calls-positive-puts-negative",
    unit: "USD per 1% underlying move",
    totalNetGex, totalAbsoluteGex, largestConcentration,
    closestZeroCrossing, strikes, eligibleContracts,
    excludedContracts: contracts.length - eligibleContracts,
  };
}

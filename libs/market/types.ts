export type MarketDirection = "up" | "down" | "flat";

export type MarketBias = "Bullish" | "Bearish" | "Neutral";

export type CapitalFlow = "Risk-On" | "Risk-Off" | "Mixed";

export type SectorSignal = {
  name: string;
  symbol: string;
  changePercent: number;
};

export type MacroIndicator = {
  name: string;
  symbol: string;
  value: string;
  changePercent: number;
  direction: MarketDirection;
};

export type MarketEngineResult = {
  bias: MarketBias;
  capitalFlow: CapitalFlow;
  score: number;
  topSector: SectorSignal;
  macro: MacroIndicator[];
  sectors: SectorSignal[];
  scannerPriority: string[];
  summary: string;
};

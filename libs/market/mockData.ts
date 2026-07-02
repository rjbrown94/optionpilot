import { MacroIndicator, SectorSignal } from "./types";

export const mockMacroIndicators: MacroIndicator[] = [
  {
    name: "S&P 500",
    symbol: "SPY",
    value: "+0.72%",
    changePercent: 0.72,
    direction: "up",
  },
  {
    name: "Nasdaq 100",
    symbol: "QQQ",
    value: "+1.10%",
    changePercent: 1.1,
    direction: "up",
  },
  {
    name: "U.S. Dollar Index",
    symbol: "DXY",
    value: "-0.35%",
    changePercent: -0.35,
    direction: "down",
  },
  {
    name: "Volatility Index",
    symbol: "VIX",
    value: "-4.82%",
    changePercent: -4.82,
    direction: "down",
  },
  {
    name: "10-Year Yield",
    symbol: "10Y",
    value: "4.21%",
    changePercent: -0.15,
    direction: "down",
  },
];

export const mockSectorStrength: SectorSignal[] = [
  { name: "Semiconductors", symbol: "SMH", changePercent: 1.25 },
  { name: "Technology", symbol: "XLK", changePercent: 0.92 },
  { name: "Industrials", symbol: "XLI", changePercent: 0.34 },
  { name: "Financials", symbol: "XLF", changePercent: 0.12 },
  { name: "Energy", symbol: "XLE", changePercent: -0.45 },
  { name: "Utilities", symbol: "XLU", changePercent: -0.62 },
];

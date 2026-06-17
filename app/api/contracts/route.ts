import { NextResponse } from "next/server";

type ContractResponse = {
  symbol: string;
  bestPlay: "CALLS" | "PUTS";
  contractType: "Call Contract" | "Put Contract";
  expiration: string;
  strikeIdea: string;
  riskLevel: "Low" | "Medium" | "High";
  maxRisk: string;
  target: string;
  reason: string;
};

function getContractPlan(symbol: string, play: string): ContractResponse {
  const bestPlay = play === "PUTS" ? "PUTS" : "CALLS";

  if (bestPlay === "CALLS") {
    return {
      symbol,
      bestPlay,
      contractType: "Call Contract",
      expiration: "14-30 DTE",
      strikeIdea: "Near-the-money or slightly out-the-money call",
      riskLevel: "Medium",
      maxRisk: "Only risk 1-2% of account",
      target: "Take profit around 30-50% gain",
      reason:
        "Calls are preferred when the scanner shows bullish price action, strong volume, bullish options flow, or a positive catalyst.",
    };
  }

  return {
    symbol,
    bestPlay,
    contractType: "Put Contract",
    expiration: "14-30 DTE",
    strikeIdea: "Near-the-money or slightly out-the-money put",
    riskLevel: "Medium",
    maxRisk: "Only risk 1-2% of account",
    target: "Take profit around 30-50% gain",
    reason:
      "Puts are preferred when the scanner shows bearish price action, weak trend, bearish options flow, or negative catalyst.",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const symbol = searchParams.get("symbol")?.toUpperCase() || "AAPL";
  const play = searchParams.get("play")?.toUpperCase() || "CALLS";

  const contractPlan = getContractPlan(symbol, play);

  return NextResponse.json(contractPlan);
}

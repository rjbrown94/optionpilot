import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type {
  CapitalFlow,
  MarketBias,
  SectorSignal,
} from "@/libs/market/types";

type MarketStatusProps = {
  bias: MarketBias;
  score: number;
  capitalFlow: CapitalFlow;
  topSector: SectorSignal;
};

export default function MarketStatus({
  bias,
  score,
  capitalFlow,
  topSector,
}: MarketStatusProps) {
  const tone =
    bias === "Bullish" ? "bullish" : bias === "Bearish" ? "bearish" : "neutral";

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Market Status</p>
          <h2 className="text-2xl font-bold text-white">{bias}</h2>
        </div>

        <Badge tone={tone}>{capitalFlow}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Market Score</p>
          <p className="font-semibold text-white">{score}/100</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Best Sector</p>
          <p className="font-semibold text-white">{topSector.name}</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Capital Flow</p>
          <p className="font-semibold text-emerald-400">{capitalFlow}</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Sector ETF</p>
          <p className="font-semibold text-white">{topSector.symbol}</p>
        </div>
      </div>
    </Card>
  );
}

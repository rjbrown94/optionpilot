import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function MarketStatus() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Market Status</p>
          <h2 className="text-2xl font-bold text-white">Bullish</h2>
        </div>
        <Badge tone="bullish">Risk-On</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Best Sector</p>
          <p className="font-semibold text-white">Semiconductors</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Fear Level</p>
          <p className="font-semibold text-emerald-400">Low</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Capital Flow</p>
          <p className="font-semibold text-emerald-400">Risk-On</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-zinc-500">Market</p>
          <p className="font-semibold text-white">Open Soon</p>
        </div>
      </div>
    </Card>
  );
}

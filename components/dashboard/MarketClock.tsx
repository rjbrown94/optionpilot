import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function MarketClock() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">Market Clock</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Premarket</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Market opens soon. Prepare your watchlist.
          </p>
        </div>

        <Badge tone="bullish">Open Soon</Badge>
      </div>
    </Card>
  );
}

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function ScannerStatus() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Scanner Status</h2>
        <Badge tone="bullish">Ready</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-xs text-zinc-500">Watching</p>
          <p className="mt-1 text-lg font-bold text-white">236</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-xs text-zinc-500">Ready</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">8</p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-xs text-zinc-500">Mode</p>
          <p className="mt-1 text-lg font-bold text-white">Live</p>
        </div>
      </div>
    </Card>
  );
}

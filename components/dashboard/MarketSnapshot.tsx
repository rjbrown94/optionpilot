import Card from "@/components/ui/Card";

const snapshot = [
  { symbol: "SPY", value: "+0.72%", tone: "text-emerald-400" },
  { symbol: "QQQ", value: "+1.10%", tone: "text-emerald-400" },
  { symbol: "DXY", value: "-0.35%", tone: "text-emerald-400" },
  { symbol: "VIX", value: "-4.82%", tone: "text-emerald-400" },
  { symbol: "10Y", value: "4.21%", tone: "text-zinc-300" },
];

export default function MarketSnapshot() {
  return (
    <Card className="p-4">
      <div className="grid grid-cols-5 gap-3 text-center">
        {snapshot.map((item) => (
          <div key={item.symbol}>
            <p className="text-xs text-zinc-500">{item.symbol}</p>
            <p className={`mt-1 text-sm font-bold ${item.tone}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

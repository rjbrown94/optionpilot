import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

const earnings = [
  { ticker: "NVDA", session: "After Close" },
  { ticker: "PLTR", session: "After Close" },
  { ticker: "DAL", session: "Before Open" },
];

export default function EarningsToday() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Earnings Today</h2>
        <Badge tone="neutral">Watch</Badge>
      </div>

      <div className="space-y-3">
        {earnings.map((item) => (
          <div
            key={item.ticker}
            className="flex items-center justify-between rounded-xl bg-black/30 p-3"
          >
            <p className="text-sm font-bold text-white">{item.ticker}</p>
            <p className="text-xs text-zinc-500">{item.session}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

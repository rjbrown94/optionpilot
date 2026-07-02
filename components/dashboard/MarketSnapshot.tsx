import Card from "@/components/ui/Card";
import type { LiveQuote } from "@/libs/market/marketService";

type MarketSnapshotProps = {
  quotes: LiveQuote[];
};

export default function MarketSnapshot({ quotes }: MarketSnapshotProps) {
  if (!quotes.length) {
    return (
      <Card className="p-4">
        <p className="text-center text-sm text-zinc-400">
          Market snapshot unavailable.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
        {quotes.map((quote) => {
          const isPositive = quote.percentChange >= 0;

          return (
            <div key={quote.symbol}>
              <p className="text-xs text-zinc-500">{quote.symbol}</p>
              <p
                className={`mt-1 text-sm font-bold ${
                  isPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {quote.percentChange.toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

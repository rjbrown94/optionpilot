type StockOverviewProps = {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
};

function formatPrice(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "--"
    : `$${value.toFixed(2)}`;
}

export default function StockOverview({
  symbol,
  price,
  change,
  percentChange,
  previousClose,
  open,
  high,
  low,
}: StockOverviewProps) {
  const positive = (change ?? 0) >= 0;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm text-zinc-500">Symbol</p>
          <h2 className="mt-1 text-4xl font-bold">{symbol}</h2>
        </div>

        <div className="md:text-right">
          <p className="text-sm text-zinc-500">Current Price</p>
          <p className="mt-1 text-4xl font-bold">{formatPrice(price)}</p>

          {change !== null && percentChange !== null && (
            <p
              className={`mt-1 font-bold ${
                positive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {positive ? "+" : ""}
              {change.toFixed(2)} ({positive ? "+" : ""}
              {percentChange.toFixed(2)}%)
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Previous Close</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(previousClose)}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Open</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(open)}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">High</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(high)}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Low</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(low)}</p>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

type Direction = "CALLS" | "PUTS" | "WAIT";

export type MarketOpportunity = {
  symbol: string;
  price: number;
  changesPercentage: number;
  direction: Direction;
  score: number;
};

type Props = {
  stock: MarketOpportunity;
};

function directionColor(direction: Direction) {
  if (direction === "CALLS") return "text-emerald-400";
  if (direction === "PUTS") return "text-red-400";
  return "text-yellow-400";
}

export default function OpportunityCard({ stock }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{stock.symbol}</h2>

          <p className={`mt-2 font-bold ${directionColor(stock.direction)}`}>
            {stock.direction}
          </p>
        </div>

        <div className="text-right">
          <p className="text-3xl font-bold">{stock.score}</p>

          <p className="text-zinc-500">Score</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-4xl font-bold">${stock.price.toFixed(2)}</p>

        <p
          className={
            stock.changesPercentage >= 0
              ? "text-emerald-400 font-bold"
              : "text-red-400 font-bold"
          }
        >
          {stock.changesPercentage >= 0 ? "+" : ""}
          {stock.changesPercentage.toFixed(2)}%
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href={`/scanner?symbol=${stock.symbol}`}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-center font-bold text-black"
        >
          Open Scanner
        </Link>

        <Link
          href={`/cheap-options?symbol=${stock.symbol}`}
          className="rounded-xl border border-zinc-700 px-4 py-3 font-bold"
        >
          Options
        </Link>
      </div>
    </div>
  );
}

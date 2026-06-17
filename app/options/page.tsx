import Link from "next/link";

export default function OptionsPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold">Options Center</h1>

        <p className="text-zinc-400 mt-3 text-lg">
          Your main hub for options trading tools.
        </p>

        <div className="grid lg:grid-cols-2 gap-6 mt-10">
          <Link
            href="/cheap-options"
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">
              🔥 Cheap Options Scanner
            </h2>
            <p className="text-zinc-400 mt-2">
              Find the best low-cost contracts.
            </p>
          </Link>

          <Link
            href="/market-discovery"
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">
              🚀 Market Discovery
            </h2>
            <p className="text-zinc-400 mt-2">
              Find stocks moving in the market.
            </p>
          </Link>

          <Link
            href="/scanner"
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">
              📊 Full Scanner
            </h2>
            <p className="text-zinc-400 mt-2">
              Analyze any stock.
            </p>
          </Link>

          <Link
            href="/watchlist"
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">
              👀 Watchlist
            </h2>
            <p className="text-zinc-400 mt-2">
              Track your favorite stocks.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-8 py-24">
        <div className="max-w-3xl">
          <h1 className="text-6xl font-bold mb-6">OptionPilot</h1>

          <p className="text-xl text-gray-400 mb-10">
            Find the best options strategy, scan stocks, track your watchlist,
            and build higher-quality trades.
          </p>

          <div className="flex gap-4 mb-20">
            <Link
              href="/scanner"
              className="bg-green-500 hover:bg-green-600 text-black font-bold px-6 py-4 rounded-xl"
            >
              Open Scanner
            </Link>

            <Link
              href="/strategies"
              className="border border-zinc-700 hover:border-green-500 px-6 py-4 rounded-xl"
            >
              Strategy Library
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-3">Scanner</h2>

            <p className="text-gray-400">
              Scan stocks and identify the best options strategy.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-3">Strategy Library</h2>

            <p className="text-gray-400">
              Learn when to use every options strategy.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-3">Watchlist</h2>

            <p className="text-gray-400">
              Track your best trade ideas in one place.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

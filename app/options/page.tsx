import Link from "next/link";

export default function OptionsPage() {
  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-5xl font-bold">Options Center</h1>

        <p className="mt-3 text-lg text-zinc-400">
          Your main hub for options trading tools.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Link
            href="/cheap-options"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">🔥 Cheap Options Scanner</h2>

            <p className="mt-2 text-zinc-400">
              Find the best low-cost contracts.
            </p>
          </Link>

          <Link
            href="/market-discovery"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">🚀 Market Discovery</h2>

            <p className="mt-2 text-zinc-400">
              Find stocks moving in the market.
            </p>
          </Link>

          <Link
            href="/scanner"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">📊 Full Scanner</h2>

            <p className="mt-2 text-zinc-400">Analyze any stock.</p>
          </Link>

          <Link
            href="/watchlist"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-green-500"
          >
            <h2 className="text-2xl font-bold">👀 Watchlist</h2>

            <p className="mt-2 text-zinc-400">Track your favorite stocks.</p>
          </Link>

          <Link
            href="/swing-analysis"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-emerald-500 lg:col-span-2"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">📈 Swing Trade Analysis</h2>

                <p className="mt-2 max-w-3xl text-zinc-400">
                  Find CALL or PUT swing bias using weekly trend, daily setup,
                  1-hour entry confirmation, Fibonacci, and price action.
                </p>
              </div>

              <span className="w-fit rounded-full border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm font-bold text-emerald-400">
                Weekly → Daily → 1H
              </span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}

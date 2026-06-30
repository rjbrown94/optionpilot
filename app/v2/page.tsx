import Link from "next/link";

const stats = [
  {
    label: "Best Sector",
    value: "Semiconductors",
  },
  {
    label: "Scanner",
    value: "12 Setups",
  },
  {
    label: "Top Stock",
    value: "NVDA",
  },
  {
    label: "Best Strategy",
    value: "Long Call",
  },
];

export default function V2HomePage() {
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between pb-6 md:max-w-5xl">
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold text-green-400">
              OptionPilot V2
            </p>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Trading Assistant
            </h1>
            <p className="max-w-xl text-sm text-zinc-400 md:text-base">
              Mobile-first trading workspace for market bias, scanners,
              watchlists, and option trade planning.
            </p>
          </header>

          <div className="rounded-3xl border border-green-500/30 bg-zinc-950 p-5 shadow-lg shadow-green-500/5 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-400">Market Bias</p>
                <h2 className="mt-2 text-4xl font-bold text-green-400 md:text-6xl">
                  Risk On
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 md:text-base">
                  Capital flow favors growth, tech, and momentum setups. Start
                  with the strongest sectors, then scan for clean entries.
                </p>
              </div>

              <div className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">
                LIVE
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:p-5"
              >
                <p className="text-xs text-zinc-500 md:text-sm">{item.label}</p>
                <p className="mt-2 text-lg font-bold md:text-xl">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 md:p-6">
            <p className="text-sm font-semibold text-white">Today’s Flow</p>
            <div className="mt-4 space-y-3">
              <FlowRow label="DXY" status="Down" bullish />
              <FlowRow label="VIX" status="Down" bullish />
              <FlowRow label="10Y Yield" status="Down" bullish />
              <FlowRow label="QQQ" status="Up" bullish />
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <Link
            href="/scanner"
            className="block rounded-2xl bg-green-500 px-5 py-4 text-center font-bold text-black transition hover:bg-green-400"
          >
            Open Current Scanner
          </Link>

          <p className="text-center text-xs text-zinc-500">
            V2 is safely separate from your live app.
          </p>
        </div>
      </section>
    </main>
  );
}

function FlowRow({
  label,
  status,
  bullish,
}: {
  label: string;
  status: string;
  bullish: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3">
      <span className="font-medium text-white">{label}</span>
      <span
        className={
          bullish
            ? "text-sm font-semibold text-green-400"
            : "text-sm font-semibold text-red-400"
        }
      >
        {status}
      </span>
    </div>
  );
}

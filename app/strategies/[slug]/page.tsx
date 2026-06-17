import Link from "next/link";

const strategies = {
  "long-call": {
    title: "Long Call",
    description:
      "A bullish options strategy used when you expect the stock price to move higher.",
  },
  "long-put": {
    title: "Long Put",
    description:
      "A bearish options strategy used when you expect the stock price to move lower.",
  },
  "covered-call": {
    title: "Covered Call",
    description:
      "A strategy where you own shares and sell a call option to collect premium.",
  },
  "cash-secured-put": {
    title: "Cash-Secured Put",
    description:
      "A strategy where you sell a put option while holding enough cash to buy the shares if assigned.",
  },
};

export default async function StrategyDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const strategy = strategies[slug as keyof typeof strategies];

  if (!strategy) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <Link href="/strategies" className="text-red-500 hover:text-red-400">
          ← Back to Strategies
        </Link>

        <h1 className="text-4xl font-bold mt-8">Strategy Not Found</h1>
        <p className="text-gray-400 mt-4">This strategy does not exist yet.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <Link href="/strategies" className="text-red-500 hover:text-red-400">
        ← Back to Strategies
      </Link>

      <section className="mt-8 max-w-3xl">
        <h1 className="text-4xl font-bold">{strategy.title}</h1>
        <p className="text-gray-300 mt-4 text-lg leading-relaxed">
          {strategy.description}
        </p>
      </section>
    </main>
  );
}

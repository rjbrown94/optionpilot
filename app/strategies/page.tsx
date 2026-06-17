import { optionStrategies } from "@/data/optionStrategies";

export default function StrategiesPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <section className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">Strategy Library</h1>

        <p className="text-gray-400 mb-10">
          PDF-based options strategy database for OptionsRocket.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {optionStrategies.map((strategy) => (
            <a
              key={strategy.slug}
              href={`/strategies/${strategy.slug}`}
              className="block border border-zinc-800 bg-zinc-900 rounded-2xl p-6 hover:border-green-500 hover:scale-[1.02] transition"
            >
              <h2 className="text-2xl font-bold mb-2">{strategy.name}</h2>
              <p className="text-green-400 mb-2">{strategy.market}</p>
              <p className="text-sm text-gray-500 mb-3">{strategy.type}</p>
              <p className="text-gray-400">{strategy.description}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

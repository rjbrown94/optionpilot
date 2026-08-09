"use client";

type MarketHeaderProps = {
  loading: boolean;
  onRefresh: () => void;
};

export default function MarketHeader({
  loading,
  onRefresh,
}: MarketHeaderProps) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div>
        <h1 className="text-5xl font-bold text-white">Market Discovery</h1>

        <p className="mt-2 text-zinc-400">
          Scan the market for the strongest option trading opportunities.
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Scanning..." : "Run Scan"}
      </button>
    </div>
  );
}

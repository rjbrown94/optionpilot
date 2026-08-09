type MarketStatsProps = {
  scanned: number;
  qualified: number;
  updated: string;
  marketStatus: string;
};

export default function MarketStats({
  scanned,
  qualified,
  updated,
  marketStatus,
}: MarketStatsProps) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-4">
      <div className="rounded-xl bg-zinc-900 p-5">
        <p className="text-zinc-400">Market</p>
        <h2 className="text-2xl font-bold">{marketStatus}</h2>
      </div>

      <div className="rounded-xl bg-zinc-900 p-5">
        <p className="text-zinc-400">Scanned</p>
        <h2 className="text-2xl font-bold">{scanned}</h2>
      </div>

      <div className="rounded-xl bg-zinc-900 p-5">
        <p className="text-zinc-400">Qualified</p>
        <h2 className="text-2xl font-bold">{qualified}</h2>
      </div>

      <div className="rounded-xl bg-zinc-900 p-5">
        <p className="text-zinc-400">Updated</p>
        <h2 className="text-lg font-bold">{updated}</h2>
      </div>
    </div>
  );
}

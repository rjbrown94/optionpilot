type TradePlanProps = {
  entry: string;
  stop: string;
  target: string;
  contractType: string;
  expiration: string;
  riskPlan: string;
};

export default function TradePlan({
  entry,
  stop,
  target,
  contractType,
  expiration,
  riskPlan,
}: TradePlanProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-2xl font-bold">Trade Plan</h2>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Entry</p>
          <p className="mt-1 text-xl font-bold">{entry}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Stop</p>
          <p className="mt-1 text-xl font-bold">{stop}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Target</p>
          <p className="mt-1 text-xl font-bold">{target}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Contract</p>
          <p className="mt-1 text-xl font-bold">{contractType}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Expiration</p>
          <p className="mt-1 text-xl font-bold">{expiration}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Risk Plan</p>
          <p className="mt-1 text-xl font-bold">{riskPlan}</p>
        </div>
      </div>
    </section>
  );
}

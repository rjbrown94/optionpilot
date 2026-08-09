type TechnicalSummaryProps = {
  trend: string;
  rsi: string;
  ema20: string;
  ema50: string;
  support: string;
  resistance: string;
  relativeVolume: string;
  candlePattern: string;
};

export default function TechnicalSummary({
  trend,
  rsi,
  ema20,
  ema50,
  support,
  resistance,
  relativeVolume,
  candlePattern,
}: TechnicalSummaryProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-2xl font-bold">Technical Summary</h2>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Trend</p>
          <p className="mt-1 text-xl font-bold capitalize">{trend}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">RSI 14</p>
          <p className="mt-1 text-xl font-bold">{rsi}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">EMA 20</p>
          <p className="mt-1 text-xl font-bold">${ema20}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">EMA 50</p>
          <p className="mt-1 text-xl font-bold">${ema50}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Support</p>
          <p className="mt-1 text-xl font-bold">${support}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Resistance</p>
          <p className="mt-1 text-xl font-bold">${resistance}</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Relative Volume</p>
          <p className="mt-1 text-xl font-bold">{relativeVolume}x</p>
        </div>

        <div className="rounded-xl bg-black p-4">
          <p className="text-sm text-zinc-500">Pattern</p>
          <p className="mt-1 text-xl font-bold">{candlePattern}</p>
        </div>
      </div>
    </section>
  );
}

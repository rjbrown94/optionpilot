type TradeScoreProps = {
  bestPlay: "CALLS" | "PUTS" | "WAIT";
  score: number;
  setupQuality: string;
};

export default function TradeScore({
  bestPlay,
  score,
  setupQuality,
}: TradeScoreProps) {
  const playClass =
    bestPlay === "CALLS"
      ? "text-emerald-400"
      : bestPlay === "PUTS"
        ? "text-red-400"
        : "text-yellow-400";

  const qualityClass =
    setupQuality === "Elite" || setupQuality === "Strong"
      ? "text-emerald-400"
      : setupQuality === "Good"
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-2xl font-bold">Trade Score</h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-black p-5">
          <p className="text-sm text-zinc-500">Best Play</p>
          <p className={`mt-2 text-3xl font-bold ${playClass}`}>{bestPlay}</p>
        </div>

        <div className="rounded-xl bg-black p-5">
          <p className="text-sm text-zinc-500">Confidence</p>
          <p className="mt-2 text-3xl font-bold">{score}/100</p>
        </div>

        <div className="rounded-xl bg-black p-5">
          <p className="text-sm text-zinc-500">Setup Quality</p>
          <p className={`mt-2 text-3xl font-bold ${qualityClass}`}>
            {setupQuality}
          </p>
        </div>
      </div>
    </section>
  );
}

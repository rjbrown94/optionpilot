"use client";

type ScannerHeaderProps = {
  ticker: string;
  loading: boolean;
  onTickerChange: (ticker: string) => void;
  onScan: () => void;
};

export default function ScannerHeader({
  ticker,
  loading,
  onTickerChange,
  onScan,
}: ScannerHeaderProps) {
  return (
    <>
      <h1 className="mb-4 text-4xl font-bold md:text-5xl">Stock Scanner</h1>

      <p className="mb-8 text-zinc-400">
        Confirm the chart, momentum, news, and option setup before entering.
      </p>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <input
          value={ticker}
          onChange={(event) => onTickerChange(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !loading) {
              onScan();
            }
          }}
          placeholder="AAPL"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-white outline-none focus:border-emerald-500"
        />

        <button
          type="button"
          onClick={onScan}
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-7 py-4 font-bold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>
    </>
  );
}

export type MarketTab =
  | "opportunities"
  | "gainers"
  | "losers"
  | "premarket"
  | "afterHours";

type MarketTabsProps = {
  active: MarketTab;
  onChange: (tab: MarketTab) => void;
};

const tabs = [
  { key: "opportunities", label: "Best Trades" },
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "premarket", label: "Premarket" },
  { key: "afterHours", label: "After Hours" },
] as const;

export default function MarketTabs({ active, onChange }: MarketTabsProps) {
  return (
    <div className="mt-8 flex gap-3">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-xl px-5 py-3 font-bold ${
            active === tab.key
              ? "bg-emerald-500 text-black"
              : "bg-zinc-900 text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

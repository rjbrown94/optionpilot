import OpportunityCard, { MarketOpportunity } from "./OpportunityCard";
import EmptyState from "./EmptyState";

type Props = {
  stocks: MarketOpportunity[];
};

export default function MarketGrid({ stocks }: Props) {
  if (stocks.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      {stocks.map((stock) => (
        <OpportunityCard key={stock.symbol} stock={stock} />
      ))}
    </div>
  );
}

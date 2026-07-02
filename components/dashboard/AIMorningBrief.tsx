import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function AIMorningBrief() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">AI Morning Brief</h2>
        <Badge tone="neutral">Market Brief</Badge>
      </div>

      <p className="text-sm leading-6 text-zinc-300">
        Market conditions currently favor growth stocks as volatility remains
        controlled and capital is flowing toward technology and semiconductor
        sectors. Focus on stocks showing strong relative strength, increasing
        volume, and clear technical confirmation before entering a trade.
        Monitor today's economic events and earnings releases for potential
        catalysts that could shift market sentiment.
      </p>
    </Card>
  );
}

import Card from "./Card";
import Badge from "./Badge";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: string;
  tone?: "bullish" | "bearish" | "neutral" | "warning";
}

export default function MetricCard({
  title,
  value,
  subtitle,
  badge,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{value}</h3>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </div>

        {badge && <Badge tone={tone}>{badge}</Badge>}
      </div>
    </Card>
  );
}

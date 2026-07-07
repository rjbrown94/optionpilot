import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type AIMorningBriefProps = {
  summary: string;
};

export default function AIMorningBrief({ summary }: AIMorningBriefProps) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">AI Morning Brief</h2>
        <Badge tone="neutral">Market Brief</Badge>
      </div>

      <p className="text-sm leading-6 text-zinc-300">{summary}</p>
    </Card>
  );
}

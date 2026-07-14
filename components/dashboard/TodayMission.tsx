import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type TodayMissionProps = {
  missions: string[];
};

export default function TodayMission({ missions }: TodayMissionProps) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Today&apos;s Mission</h2>
        <Badge tone="warning">Plan</Badge>
      </div>

      <div className="space-y-3">
        {missions.map((mission) => (
          <div
            key={mission}
            className="flex items-center gap-3 rounded-xl bg-black/30 p-3"
          >
            <span className="text-emerald-400">✓</span>
            <p className="text-sm text-zinc-300">{mission}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

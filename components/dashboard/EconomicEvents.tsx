import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

const events = [
  { time: "8:30 AM", name: "Jobless Claims", impact: "High" },
  { time: "10:00 AM", name: "Manufacturing Data", impact: "Medium" },
];

export default function EconomicEvents() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Economic Events</h2>
        <Badge tone="warning">Today</Badge>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={`${event.time}-${event.name}`}
            className="flex items-center justify-between rounded-xl bg-black/30 p-3"
          >
            <div>
              <p className="text-sm font-semibold text-white">{event.name}</p>
              <p className="text-xs text-zinc-500">{event.time}</p>
            </div>

            <p className="text-sm text-zinc-300">{event.impact}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

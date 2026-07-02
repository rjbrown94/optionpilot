import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import MarketSnapshot from "@/components/dashboard/MarketSnapshot";
import MarketClock from "@/components/dashboard/MarketClock";
import MarketStatus from "@/components/dashboard/MarketStatus";
import TodayMission from "@/components/dashboard/TodayMission";
import AIMorningBrief from "@/components/dashboard/AIMorningBrief";
import EconomicEvents from "@/components/dashboard/EconomicEvents";
import EarningsToday from "@/components/dashboard/EarningsToday";
import ScannerStatus from "@/components/dashboard/ScannerStatus";

export default function V2DashboardPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="OptionPilot 2.0"
          title="Trading Command Center"
          description="Your mobile-first dashboard for market bias, capital flow, scanner direction, and trade preparation."
        />

        <div className="mb-6">
          <MarketClock />
        </div>

        <div className="mb-6">
          <MarketSnapshot />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Market Bias"
            value="Bullish"
            subtitle="QQQ leading, VIX falling"
            badge="85 Score"
            tone="bullish"
          />

          <MetricCard
            title="Capital Flow"
            value="Risk-On"
            subtitle="Growth sectors showing strength"
            badge="Strong"
            tone="bullish"
          />

          <MetricCard
            title="Top Sector"
            value="Semis"
            subtitle="AI and chips leading"
            badge="Leading"
            tone="bullish"
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <MarketStatus />
          <TodayMission />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <EconomicEvents />
          <EarningsToday />
          <ScannerStatus />
        </div>

        <div className="mt-6">
          <AIMorningBrief />
        </div>
      </div>
    </main>
  );
}

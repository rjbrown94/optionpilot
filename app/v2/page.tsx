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
import { getMarketEngineResult } from "@/libs/market/marketEngine";

export default function V2DashboardPage() {
  const market = getMarketEngineResult();

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
            value={market.bias}
            subtitle="Calculated from macro signals"
            badge={`${market.score} Score`}
            tone={
              market.bias === "Bullish"
                ? "bullish"
                : market.bias === "Bearish"
                  ? "bearish"
                  : "neutral"
            }
          />

          <MetricCard
            title="Capital Flow"
            value={market.capitalFlow}
            subtitle="Based on risk appetite"
            badge={market.capitalFlow}
            tone={
              market.capitalFlow === "Risk-On"
                ? "bullish"
                : market.capitalFlow === "Risk-Off"
                  ? "bearish"
                  : "neutral"
            }
          />

          <MetricCard
            title="Top Sector"
            value={market.topSector.name}
            subtitle={`${market.topSector.symbol} ${market.topSector.changePercent}%`}
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

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-xl font-bold text-white">
            Market Engine Summary
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            {market.summary}
          </p>
        </div>
      </div>
    </main>
  );
}

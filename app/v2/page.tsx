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
import {
  getMarketSnapshot,
  getSectorSnapshot,
} from "@/libs/market/marketService";

export default async function V2DashboardPage() {
  const snapshot = await getMarketSnapshot();
  const sectorSnapshot = await getSectorSnapshot();

  const market = getMarketEngineResult(snapshot, sectorSnapshot);

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
          <MarketSnapshot quotes={snapshot} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Market Bias"
            value={market.bias}
            subtitle="Calculated from live market data"
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
            subtitle="Based on live market conditions"
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
            subtitle={`${market.topSector.symbol} ${market.topSector.changePercent.toFixed(
              2,
            )}%`}
            badge="Leading"
            tone={market.topSector.changePercent >= 0 ? "bullish" : "bearish"}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <MarketStatus
            bias={market.bias}
            score={market.score}
            capitalFlow={market.capitalFlow}
            topSector={market.topSector}
          />

          <TodayMission
            missions={[
              `Market bias is ${market.bias}`,
              `Capital flow is ${market.capitalFlow}`,
              `Strongest sector ETF is ${market.topSector.symbol}`,
              `Watch: ${market.scannerPriority.slice(0, 3).join(", ")}`,
            ]}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <EconomicEvents />
          <EarningsToday />
          <ScannerStatus />
        </div>

        <div className="mt-6">
          <AIMorningBrief summary={market.summary} />
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

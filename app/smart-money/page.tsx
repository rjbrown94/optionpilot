"use client";

import { useEffect, useMemo, useState } from "react";

import SmartMoneyCard from "@/components/smart-money/SmartMoneyCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import MetricCard from "@/components/ui/MetricCard";
import SectionHeader from "@/components/ui/SectionHeader";

type ConnectionStatus = "connecting" | "connected" | "error" | "closed";
type InstitutionalSide = "ASK" | "BID" | "MID" | "UNKNOWN";

type SmartMoneyTrade = {
  id: string;
  contractSymbol: string;
  underlying: string;
  direction: "CALLS" | "PUTS";
  strike: number | null;
  expiration: string | null;
  price: number;
  size: number;
  premium: number;
  timestamp: number;
  side: InstitutionalSide;
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  spreadPercent: number | null;
  classification: "SWEEP_LIKE" | "BLOCK" | "LARGE_PREMIUM" | "STANDARD";
  labels: string[];
  confidence: number;
};

type AggregatedFlow = {
  symbol: string;
  direction: "CALLS" | "PUTS";
  premium: number;
  tradePrice: number;
  volume: number;
  confidence: number;
  contractSymbol: string;
  strike: number | null;
  expiration: string | null;
  timestamp: number;
  side: InstitutionalSide;
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  spreadPercent: number | null;
  classification: SmartMoneyTrade["classification"];
  labels: string[];
};

const MAX_TRADES = 500;
const MINIMUM_PREMIUM = 10_000;

function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absoluteValue >= 1_000_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000_000).toFixed(1)}B`;
  }
  if (absoluteValue >= 1_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000).toFixed(1)}M`;
  }
  if (absoluteValue >= 1_000) {
    return `${sign}$${(absoluteValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${absoluteValue.toFixed(0)}`;
}

function getStatusClasses(status: ConnectionStatus): string {
  if (status === "connected") {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
  }
  if (status === "error") {
    return "border-red-700 bg-red-950/50 text-red-300";
  }
  return "border-yellow-700 bg-yellow-950/50 text-yellow-300";
}

function getStatusLabel(status: ConnectionStatus): string {
  if (status === "connected") return "LIVE OPTIONS STREAM";
  if (status === "error") return "RECONNECTING";
  if (status === "closed") return "STREAM CLOSED";
  return "CONNECTING";
}

export default function SmartMoneyPage() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<SmartMoneyTrade[]>([]);

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;

      setStatus("connecting");

      source?.close();

      source = new EventSource("/api/smart-money-stream");

      source.addEventListener("ready", () => {
        setStatus("connected");
        setError(null);
      });

      source.addEventListener("status", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as {
            status?: string;
            message?: string;
          };

          if (payload.status === "auth_success") {
            setStatus("connected");
            setError(null);
          }

          if (payload.status === "auth_failed") {
            setStatus("error");
            setError(
              payload.message || "Massive options authentication failed.",
            );
          }
        } catch {
          // Ignore malformed status events.
        }
      });

      source.addEventListener("stream-error", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as {
            message?: string;
          };

          setStatus("error");
          setError(payload.message || "The options stream reported an error.");
        } catch {
          setStatus("error");
          setError("The options stream reported an error.");
        }
      });

      source.addEventListener("trade", (event) => {
        try {
          const trade = JSON.parse(
            (event as MessageEvent).data,
          ) as SmartMoneyTrade;

          if (trade.premium < MINIMUM_PREMIUM) {
            return;
          }

          setTrades((current) => {
            const duplicate = current.some((item) => item.id === trade.id);

            if (duplicate) {
              return current;
            }

            return [trade, ...current].slice(0, MAX_TRADES);
          });
        } catch {
          setError("OptionPilot received invalid options-flow data.");
        }
      });

      source.onerror = () => {
        if (stopped) {
          return;
        }

        source?.close();
        source = null;

        setStatus("error");
        setError("The live options stream was interrupted. Reconnecting...");

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      stopped = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      source?.close();
    };
  }, []);

  const flow = useMemo(() => {
    const grouped = new Map<
      string,
      {
        callsPremium: number;
        putsPremium: number;
        callsVolume: number;
        putsVolume: number;
        latestCall: SmartMoneyTrade | null;
        latestPut: SmartMoneyTrade | null;
        bestCall: SmartMoneyTrade | null;
        bestPut: SmartMoneyTrade | null;
      }
    >();

    for (const trade of trades) {
      const current = grouped.get(trade.underlying) ?? {
        callsPremium: 0,
        putsPremium: 0,
        callsVolume: 0,
        putsVolume: 0,
        latestCall: null,
        latestPut: null,
        bestCall: null,
        bestPut: null,
      };

      if (trade.direction === "CALLS") {
        current.callsPremium += trade.premium;
        current.callsVolume += trade.size;
        if (
          !current.latestCall ||
          trade.timestamp > current.latestCall.timestamp
        ) {
          current.latestCall = trade;
        }
        if (
          !current.bestCall ||
          trade.confidence > current.bestCall.confidence ||
          (trade.confidence === current.bestCall.confidence &&
            trade.premium > current.bestCall.premium)
        ) {
          current.bestCall = trade;
        }
      } else {
        current.putsPremium += trade.premium;
        current.putsVolume += trade.size;
        if (
          !current.latestPut ||
          trade.timestamp > current.latestPut.timestamp
        ) {
          current.latestPut = trade;
        }
        if (
          !current.bestPut ||
          trade.confidence > current.bestPut.confidence ||
          (trade.confidence === current.bestPut.confidence &&
            trade.premium > current.bestPut.premium)
        ) {
          current.bestPut = trade;
        }
      }

      grouped.set(trade.underlying, current);
    }

    return Array.from(grouped.entries())
      .map(([symbol, item]): AggregatedFlow | null => {
        const bullish = item.callsPremium >= item.putsPremium;
        const direction = bullish ? "CALLS" : "PUTS";
        const premium = bullish ? item.callsPremium : item.putsPremium;
        const volume = bullish ? item.callsVolume : item.putsVolume;
        const representativeTrade = bullish
          ? item.bestCall || item.latestCall
          : item.bestPut || item.latestPut;

        if (!representativeTrade) return null;

        return {
          symbol,
          direction,
          premium,
          tradePrice: representativeTrade.price,
          volume,
          confidence: representativeTrade.confidence,
          contractSymbol: representativeTrade.contractSymbol,
          strike: representativeTrade.strike,
          expiration: representativeTrade.expiration,
          timestamp: representativeTrade.timestamp,
          side: representativeTrade.side,
          bidPrice: representativeTrade.bidPrice,
          bidSize: representativeTrade.bidSize,
          askPrice: representativeTrade.askPrice,
          askSize: representativeTrade.askSize,
          spreadPercent: representativeTrade.spreadPercent,
          classification: representativeTrade.classification,
          labels: representativeTrade.labels,
        };
      })
      .filter((item): item is AggregatedFlow => item !== null)
      .sort((first, second) => {
        if (second.confidence !== first.confidence) {
          return second.confidence - first.confidence;
        }
        return second.premium - first.premium;
      })
      .slice(0, 20);
  }, [trades]);

  const callPremium = useMemo(
    () =>
      trades
        .filter((trade) => trade.direction === "CALLS")
        .reduce((total, trade) => total + trade.premium, 0),
    [trades],
  );

  const putPremium = useMemo(
    () =>
      trades
        .filter((trade) => trade.direction === "PUTS")
        .reduce((total, trade) => total + trade.premium, 0),
    [trades],
  );

  const totalPremium = callPremium + putPremium;
  const callPutRatio =
    putPremium > 0
      ? callPremium / putPremium
      : callPremium > 0
        ? callPremium
        : 0;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
              OptionPilot Intelligence
            </p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">
              Smart Money Radar
            </h1>
            <p className="mt-3 max-w-3xl text-zinc-400">
              Monitor real options trades from your Massive Options WebSocket
              and surface the contracts attracting the most premium.
            </p>
          </div>

          <span
            className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${getStatusClasses(
              status,
            )}`}
          >
            {getStatusLabel(status)}
          </span>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Bullish Premium"
            value={formatCompactCurrency(callPremium)}
            subtitle="Premium from call trades captured in this session."
            badge="Calls"
            tone="bullish"
          />
          <MetricCard
            title="Bearish Premium"
            value={formatCompactCurrency(putPremium)}
            subtitle="Premium from put trades captured in this session."
            badge="Puts"
            tone="bearish"
          />
          <MetricCard
            title="Call / Put Ratio"
            value={callPutRatio.toFixed(2)}
            subtitle="Premium-weighted ratio, not contract count."
            badge={callPutRatio >= 1 ? "Bullish" : "Bearish"}
            tone={callPutRatio >= 1 ? "bullish" : "bearish"}
          />
          <MetricCard
            title="Total Premium"
            value={formatCompactCurrency(totalPremium)}
            subtitle={`${trades.length.toLocaleString()} qualifying trades captured.`}
            badge="Live"
            tone="neutral"
          />
        </section>

        {error && (
          <section className="mt-6 rounded-2xl border border-red-800 bg-red-950/40 p-5">
            <p className="font-bold text-red-300">Stream notice</p>
            <p className="mt-2 text-sm text-red-200">{error}</p>
          </section>
        )}

        <section className="mt-10">
          <SectionHeader
            title="Live Options Flow"
            description="Ranked by institutional confidence and directional premium captured since this page was opened."
          />

          {status === "connecting" && trades.length === 0 && (
            <LoadingSkeleton cards={6} className="mt-5" />
          )}

          {status !== "connecting" && flow.length === 0 && (
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <p className="text-xl font-bold">
                Waiting for qualifying option trades
              </p>
              <p className="mt-2 text-zinc-400">
                Options activity is concentrated during regular market hours.
                This page does not use placeholder trades.
              </p>
            </div>
          )}

          {flow.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {flow.map((item) => (
                <SmartMoneyCard
                  key={`${item.symbol}-${item.direction}`}
                  symbol={item.symbol}
                  direction={item.direction}
                  contractSymbol={item.contractSymbol}
                  strike={item.strike}
                  expiration={item.expiration}
                  premium={item.premium}
                  tradePrice={item.tradePrice}
                  volume={item.volume}
                  openInterest={null}
                  bid={item.bidPrice}
                  ask={item.askPrice}
                  side={item.side}
                  classification={item.classification}
                  confidence={item.confidence}
                  timestamp={item.timestamp}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

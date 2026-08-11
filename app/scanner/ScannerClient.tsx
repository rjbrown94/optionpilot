"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import TradingViewChart from "@/components/TradingViewChart";
import ScannerHeader from "@/components/scanner/ScannerHeader";

import {
  calculateTradeConfirmation,
  type ConfirmationCandle,
  type TradeConfirmationResult,
} from "@/libs/scanner/tradeConfirmation";

import { useTradeContext } from "@/components/providers/TradeContext";

type Candle = {
  time?: string;
  datetime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CandleResponse = {
  symbol?: string;
  interval?: string;
  candles?: Candle[];
  cached?: boolean;
  source?: string;

  latestCandleTime?: string | null;
  latestCandleAgeMinutes?: number | null;
  stale?: boolean;

  warning?: string;
  error?: string;
};

type NewsCatalyst = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number | null;
  catalystType: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  catalystScore: number;
};

type NewsResponse = {
  symbol?: string;
  catalyst?: string;
  topCatalyst?: NewsCatalyst | null;
  news?: NewsCatalyst[];
  filtered?: boolean;
  error?: string;
  message?: string;
};

type ScannerDecision = "TRADE READY" | "WATCH" | "CONFLICT" | "WAIT";

function getMarketStatus(): string {
  const now = new Date();

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(now);

  if (weekday === "Sat" || weekday === "Sun") {
    return "MARKET CLOSED";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  const totalMinutes = hour * 60 + minute;

  if (totalMinutes < 510) return "PREMARKET";
  if (totalMinutes < 900) return "MARKET OPEN";
  if (totalMinutes < 1140) return "AFTER HOURS";

  return "MARKET CLOSED";
}

function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(decimals);
}

function getDecision(
  confirmation: TradeConfirmationResult | null,
  expectedDirection: "CALL" | "PUT" | "WAIT",
): ScannerDecision {
  if (!confirmation) {
    return "WAIT";
  }

  if (expectedDirection === "CALL") {
    if (confirmation.direction === "Bearish") {
      return "CONFLICT";
    }

    if (confirmation.signal === "CALL READY") {
      return "TRADE READY";
    }

    return "WATCH";
  }

  if (expectedDirection === "PUT") {
    if (confirmation.direction === "Bullish") {
      return "CONFLICT";
    }

    if (confirmation.signal === "PUT READY") {
      return "TRADE READY";
    }

    return "WATCH";
  }

  if (
    confirmation.signal === "CALL READY" ||
    confirmation.signal === "PUT READY"
  ) {
    return "TRADE READY";
  }

  return "WATCH";
}

function getDecisionClasses(decision: ScannerDecision): string {
  if (decision === "TRADE READY") {
    return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
  }

  if (decision === "CONFLICT") {
    return "border-red-700 bg-red-950/40 text-red-300";
  }

  if (decision === "WATCH") {
    return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function getDirectionLabel(
  confirmation: TradeConfirmationResult | null,
): string {
  if (!confirmation) return "WAIT";

  if (confirmation.signal === "CALL READY") {
    return "CALL READY";
  }

  if (confirmation.signal === "PUT READY") {
    return "PUT READY";
  }

  return "WAIT";
}

function getNewsBiasClasses(bias: NewsCatalyst["bias"]): string {
  if (bias === "Bullish") {
    return "border-emerald-800 bg-emerald-950/30 text-emerald-300";
  }

  if (bias === "Bearish") {
    return "border-red-800 bg-red-950/30 text-red-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function getNewsAlignment(
  news: NewsCatalyst | null,
  direction: "CALL" | "PUT" | "WAIT",
): "ALIGNED" | "CONFLICT" | "NEUTRAL" {
  if (!news || news.bias === "Neutral" || direction === "WAIT") {
    return "NEUTRAL";
  }

  if (
    (direction === "CALL" && news.bias === "Bullish") ||
    (direction === "PUT" && news.bias === "Bearish")
  ) {
    return "ALIGNED";
  }

  return "CONFLICT";
}

function formatNewsTime(timestamp: number | null): string {
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp * 1000).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ScannerClient() {
  const searchParams = useSearchParams();

  const {
    symbol: contextSymbol,
    direction,
    strategy,
    confidence,
    setSymbol,
    setScannerResult,
  } = useTradeContext();

  const querySymbol =
    searchParams.get("symbol")?.trim().toUpperCase() || contextSymbol || "AAPL";

  const [ticker, setTicker] = useState(querySymbol);

  const [candles, setCandles] = useState<Candle[]>([]);

  const [news, setNews] = useState<NewsCatalyst[]>([]);

  const [topCatalyst, setTopCatalyst] = useState<NewsCatalyst | null>(null);

  const [loading, setLoading] = useState(true);

  const [newsLoading, setNewsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [newsError, setNewsError] = useState<string | null>(null);

  const [warning, setWarning] = useState<string | null>(null);

  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [latestCandleTime, setLatestCandleTime] = useState<string | null>(null);

  const [latestCandleAgeMinutes, setLatestCandleAgeMinutes] = useState<
    number | null
  >(null);

  const [staleData, setStaleData] = useState(false);

  const mountedRef = useRef(false);

  const loadNews = useCallback(async (requestedSymbol: string) => {
    const cleanSymbol = requestedSymbol.trim().toUpperCase();

    if (!cleanSymbol) {
      return;
    }

    if (mountedRef.current) {
      setNewsLoading(true);
      setNewsError(null);
    }

    try {
      const response = await fetch(
        `/api/news?symbol=${encodeURIComponent(cleanSymbol)}`,
        {
          cache: "no-store",
        },
      );

      const text = await response.text();

      if (!text.trim()) {
        throw new Error("News returned an empty response.");
      }

      let payload: NewsResponse;

      try {
        payload = JSON.parse(text) as NewsResponse;
      } catch {
        throw new Error("News returned invalid JSON.");
      }

      if (!response.ok || payload.error) {
        throw new Error(
          payload.error ||
            payload.message ||
            "News is temporarily unavailable.",
        );
      }

      if (!mountedRef.current) {
        return;
      }

      setNews(Array.isArray(payload.news) ? payload.news : []);

      setTopCatalyst(payload.topCatalyst ?? null);
    } catch (caught) {
      if (!mountedRef.current) {
        return;
      }

      setNews([]);
      setTopCatalyst(null);

      setNewsError(
        caught instanceof Error
          ? caught.message
          : "News is temporarily unavailable.",
      );
    } finally {
      if (mountedRef.current) {
        setNewsLoading(false);
      }
    }
  }, []);

  const loadConfirmation = useCallback(
    async (requestedSymbol: string) => {
      const cleanSymbol = requestedSymbol.trim().toUpperCase();

      if (!cleanSymbol) {
        return;
      }

      setTicker(cleanSymbol);
      setSymbol(cleanSymbol);

      if (mountedRef.current) {
        setLoading(true);
        setError(null);
        setWarning(null);
      }

      void loadNews(cleanSymbol);

      try {
        const response = await fetch(
          `/api/candles?symbol=${encodeURIComponent(
            cleanSymbol,
          )}&interval=5min`,
          {
            cache: "no-store",
          },
        );

        const text = await response.text();

        if (!text.trim()) {
          throw new Error("No candle data was returned.");
        }

        let payload: CandleResponse;

        try {
          payload = JSON.parse(text) as CandleResponse;
        } catch {
          throw new Error("Technical data returned invalid JSON.");
        }

        if (!response.ok || payload.error) {
          throw new Error(
            payload.error || "Technical data is temporarily unavailable.",
          );
        }

        const validCandles = Array.isArray(payload.candles)
          ? payload.candles.filter(
              (candle) =>
                Number.isFinite(candle.open) &&
                Number.isFinite(candle.high) &&
                Number.isFinite(candle.low) &&
                Number.isFinite(candle.close) &&
                Number.isFinite(candle.volume),
            )
          : [];

        if (validCandles.length === 0) {
          throw new Error("No valid 5-minute candles are available yet.");
        }

        if (mountedRef.current) {
          setCandles(validCandles);

          setWarning(payload.warning || null);

          setLatestCandleTime(payload.latestCandleTime ?? null);

          setLatestCandleAgeMinutes(payload.latestCandleAgeMinutes ?? null);

          setStaleData(payload.stale === true);

          setUpdatedAt(new Date().toISOString());
        }
      } catch (caught) {
        if (!mountedRef.current) {
          return;
        }

        const message =
          caught instanceof Error
            ? caught.message
            : "Technical confirmation is temporarily unavailable.";

        const rateLimited =
          message.toLowerCase().includes("maximum requests") ||
          message.toLowerCase().includes("rate limit") ||
          message.toLowerCase().includes("upgrade your subscription");

        setError(
          rateLimited
            ? "Live technical data is temporarily busy. Wait briefly and refresh the confirmation."
            : message,
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [loadNews, setSymbol],
  );

  useEffect(() => {
    mountedRef.current = true;

    void loadConfirmation(querySymbol);

    return () => {
      mountedRef.current = false;
    };
  }, [querySymbol, loadConfirmation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConfirmation(ticker);
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [ticker, loadConfirmation]);

  const confirmation = useMemo(() => {
    if (candles.length < 20) {
      return null;
    }

    const confirmationCandles: ConfirmationCandle[] = candles.map((candle) => ({
      datetime: candle.datetime || candle.time || new Date().toISOString(),

      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    return calculateTradeConfirmation(ticker, confirmationCandles);
  }, [candles, ticker]);

  const technicalDecision = useMemo(
    () => getDecision(confirmation, direction),
    [confirmation, direction],
  );

  const decision: ScannerDecision = staleData ? "WAIT" : technicalDecision;

  const newsAlignment = useMemo(
    () => getNewsAlignment(topCatalyst, direction),
    [topCatalyst, direction],
  );

  const combinedScore = useMemo(() => {
    const technicalScore = confirmation?.score ?? 0;

    if (confidence === null) {
      return technicalScore;
    }

    return Math.round(technicalScore * 0.7 + confidence * 0.3);
  }, [confirmation, confidence]);

  useEffect(() => {
    setScannerResult({
      status: decision,
      score: combinedScore,
    });
  }, [decision, combinedScore, setScannerResult]);

  const latestCandle = candles[candles.length - 1] ?? null;

  const sessionOpen = candles[0]?.open ?? null;

  const sessionHigh =
    candles.length > 0
      ? Math.max(...candles.map((candle) => candle.high))
      : null;

  const sessionLow =
    candles.length > 0
      ? Math.min(...candles.map((candle) => candle.low))
      : null;

  const contractSelectorUrl = `/cheap-options?symbol=${encodeURIComponent(
    ticker,
  )}&direction=${encodeURIComponent(
    direction,
  )}&strategy=${encodeURIComponent(strategy)}`;

  return (
    <main className="min-h-screen bg-black p-5 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <ScannerHeader
          ticker={ticker}
          loading={loading}
          onTickerChange={setTicker}
          onScan={() => void loadConfirmation(ticker)}
        />

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
            Current Trade Workflow
          </p>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <p>
              Symbol: <strong>{ticker}</strong>
            </p>

            <p>
              Direction: <strong>{direction}</strong>
            </p>

            <p>
              Strategy: <strong className="capitalize">{strategy}</strong>
            </p>

            <p>
              Flow Confidence:{" "}
              <strong>
                {confidence !== null ? `${confidence}/100` : "--"}
              </strong>
            </p>
          </div>
        </section>

        {warning && (
          <section className="mb-6 rounded-2xl border border-yellow-800 bg-yellow-950/30 p-5">
            <p className="font-bold text-yellow-300">Data notice</p>

            <p className="mt-1 text-sm text-yellow-100">{warning}</p>
          </section>
        )}

        {error && (
          <section className="mb-6 rounded-2xl border border-yellow-800 bg-yellow-950/30 p-5">
            <p className="font-bold text-yellow-300">
              Technical confirmation temporarily unavailable
            </p>

            <p className="mt-2 text-sm text-yellow-100">{error}</p>

            <button
              type="button"
              onClick={() => void loadConfirmation(ticker)}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
            >
              Try Again
            </button>
          </section>
        )}

        {loading && candles.length === 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <p className="text-xl font-bold">Checking {ticker} technicals...</p>

            <p className="mt-2 text-zinc-400">
              Loading completed 5-minute candles.
            </p>
          </section>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            <section
              className={`rounded-2xl border p-5 ${
                staleData
                  ? "border-red-800 bg-red-950/30"
                  : "border-emerald-800 bg-emerald-950/20"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-[0.16em] ${
                      staleData ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    Market Data Status
                  </p>

                  <p
                    className={`mt-2 text-xl font-bold ${
                      staleData ? "text-red-300" : "text-emerald-300"
                    }`}
                  >
                    {staleData ? "STALE DATA — DO NOT TRADE" : "LIVE DATA"}
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    Latest 5-minute candle:{" "}
                    {latestCandleTime
                      ? new Date(latestCandleTime).toLocaleTimeString("en-US", {
                          timeZone: "America/Chicago",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "--"}{" "}
                    CT
                  </p>
                </div>

                <div className="rounded-xl bg-black px-4 py-3">
                  <p className="text-xs text-zinc-500">Candle Age</p>

                  <p className="mt-1 text-lg font-bold">
                    {latestCandleAgeMinutes !== null
                      ? `${latestCandleAgeMinutes} min`
                      : "--"}
                  </p>
                </div>
              </div>

              {staleData && (
                <p className="mt-4 text-sm font-semibold text-red-200">
                  OptionPilot has disabled technical confirmation until fresh
                  market data returns.
                </p>
              )}
            </section>

            <section
              className={`rounded-2xl border p-6 ${getDecisionClasses(
                decision,
              )}`}
            >
              <p className="text-sm font-bold uppercase tracking-wide">
                Technical Confirmation
              </p>

              <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-4xl font-bold">{decision}</h2>

                  <p className="mt-2">
                    Scanner Signal:{" "}
                    <strong>
                      {staleData ? "WAIT" : getDirectionLabel(confirmation)}
                    </strong>
                  </p>

                  <p className="mt-1 text-sm opacity-80">
                    {getMarketStatus()}
                    {updatedAt
                      ? ` · Updated ${new Date(updatedAt).toLocaleTimeString(
                          "en-US",
                          {
                            timeZone: "America/Chicago",
                          },
                        )} CT`
                      : ""}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-4xl font-bold">{combinedScore}/100</p>

                  <p className="text-xs opacity-80">Flow + technical score</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-400">
                    News Catalyst
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    {ticker} Market News
                  </h2>
                </div>

                {topCatalyst && (
                  <div
                    className={`rounded-full border px-4 py-2 text-sm font-bold ${getNewsBiasClasses(
                      topCatalyst.bias,
                    )}`}
                  >
                    {topCatalyst.bias} · {topCatalyst.catalystScore}/100
                  </div>
                )}
              </div>

              {newsLoading && news.length === 0 && (
                <p className="mt-5 text-sm text-zinc-500">
                  Checking recent {ticker} news...
                </p>
              )}

              {newsError && (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4">
                  <p className="text-sm text-zinc-400">
                    News is temporarily unavailable. Technical analysis is still
                    active.
                  </p>
                </div>
              )}

              {!newsLoading && !newsError && !topCatalyst && (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4">
                  <p className="text-sm text-zinc-400">
                    No major recent catalyst was found for {ticker}.
                  </p>
                </div>
              )}

              {topCatalyst && (
                <>
                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-black p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300">
                        {topCatalyst.catalystType}
                      </span>

                      <span className="text-xs text-zinc-500">
                        {topCatalyst.source}
                      </span>

                      {topCatalyst.datetime && (
                        <span className="text-xs text-zinc-600">
                          {formatNewsTime(topCatalyst.datetime)} CT
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-xl font-bold">
                      {topCatalyst.headline}
                    </h3>

                    {topCatalyst.summary && (
                      <p className="mt-3 text-sm leading-6 text-zinc-400">
                        {topCatalyst.summary}
                      </p>
                    )}

                    {topCatalyst.url && (
                      <a
                        href={topCatalyst.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-block text-sm font-bold text-blue-400 hover:text-blue-300"
                      >
                        Read Source →
                      </a>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      News vs Trade Direction
                    </p>

                    {newsAlignment === "ALIGNED" && (
                      <p className="mt-2 font-bold text-emerald-400">
                        ✓ News catalyst supports the current {direction} thesis.
                      </p>
                    )}

                    {newsAlignment === "CONFLICT" && (
                      <p className="mt-2 font-bold text-red-400">
                        ⚠ News catalyst conflicts with the current {direction}{" "}
                        thesis.
                      </p>
                    )}

                    {newsAlignment === "NEUTRAL" && (
                      <p className="mt-2 text-zinc-400">
                        News is neutral or does not provide directional
                        confirmation.
                      </p>
                    )}
                  </div>
                </>
              )}

              {news.length > 1 && (
                <div className="mt-5 space-y-3">
                  <p className="font-bold text-zinc-300">More Recent News</p>

                  {news.slice(1, 4).map((item, index) => (
                    <div
                      key={`${item.headline}-${index}`}
                      className="rounded-xl border border-zinc-800 bg-black p-4"
                    >
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="font-bold text-zinc-400">
                          {item.catalystType}
                        </span>

                        <span className="text-zinc-600">{item.source}</span>
                      </div>

                      <p className="mt-2 font-semibold text-zinc-200">
                        {item.headline}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-5 text-xs leading-5 text-zinc-500">
                News is used as catalyst context and confirmation only. A
                headline by itself does not make a trade ready.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm text-zinc-500">{ticker}</p>

                  <p className="mt-1 text-4xl font-bold">
                    {latestCandle ? `$${latestCandle.close.toFixed(2)}` : "--"}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Latest completed 5-minute candle
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">Session Open</p>

                  <p className="mt-1 text-xl font-bold">
                    {sessionOpen !== null ? `$${sessionOpen.toFixed(2)}` : "--"}
                  </p>
                </div>

                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">Session High</p>

                  <p className="mt-1 text-xl font-bold">
                    {sessionHigh !== null ? `$${sessionHigh.toFixed(2)}` : "--"}
                  </p>
                </div>

                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">Session Low</p>

                  <p className="mt-1 text-xl font-bold">
                    {sessionLow !== null ? `$${sessionLow.toFixed(2)}` : "--"}
                  </p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <TradingViewChart symbol={ticker} />
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-2xl font-bold">5-Minute Technical Check</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">VWAP</p>

                  <p className="mt-1 text-xl font-bold">
                    {formatNumber(confirmation?.vwap)}
                  </p>
                </div>

                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">9 EMA</p>

                  <p className="mt-1 text-xl font-bold">
                    {formatNumber(confirmation?.ema9)}
                  </p>
                </div>

                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">20 EMA</p>

                  <p className="mt-1 text-xl font-bold">
                    {formatNumber(confirmation?.ema20)}
                  </p>
                </div>

                <div className="rounded-xl bg-black p-4">
                  <p className="text-xs text-zinc-500">Relative Volume</p>

                  <p className="mt-1 text-xl font-bold">
                    {confirmation
                      ? `${confirmation.relativeVolume.toFixed(2)}x`
                      : "--"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="font-bold text-emerald-400">Confirmations</p>

                  <div className="mt-3 space-y-2">
                    {(confirmation?.confirmations ?? []).map((item) => (
                      <p key={item} className="text-sm text-zinc-300">
                        ✓ {item}
                      </p>
                    ))}

                    {!confirmation && (
                      <p className="text-sm text-zinc-500">
                        Waiting for at least 20 valid 5-minute candles.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-bold text-yellow-400">Warnings</p>

                  <div className="mt-3 space-y-2">
                    {(confirmation?.warnings ?? []).map((item) => (
                      <p key={item} className="text-sm text-zinc-300">
                        ⚠ {item}
                      </p>
                    ))}

                    {staleData && (
                      <p className="text-sm text-red-300">
                        ⚠ Candle data is stale. Technical confirmation is
                        disabled.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-2xl font-bold">What OptionPilot Says</h2>

              {staleData && (
                <p className="mt-3 text-red-300">
                  Market data is stale. OptionPilot has forced the scanner to
                  WAIT until a fresh 5-minute candle is available.
                </p>
              )}

              {!staleData && decision === "TRADE READY" && (
                <p className="mt-3 text-emerald-300">
                  The 5-minute technical setup agrees with the current{" "}
                  {direction} flow. Review the news catalyst, then move to
                  Contract Selector and choose the highest-quality contract.
                </p>
              )}

              {!staleData && decision === "WATCH" && (
                <p className="mt-3 text-yellow-300">
                  The direction is not fully confirmed yet. Keep watching VWAP,
                  market structure, EMA alignment, volume, and catalyst context.
                </p>
              )}

              {!staleData && decision === "CONFLICT" && (
                <p className="mt-3 text-red-300">
                  Smart Money direction and the technical chart currently
                  disagree. Do not enter until they align.
                </p>
              )}

              {!staleData && decision === "WAIT" && (
                <p className="mt-3 text-zinc-300">
                  OptionPilot does not have enough technical evidence yet.
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/smart-money"
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-center font-bold hover:border-emerald-500"
                >
                  Back to Smart Money
                </Link>

                <Link
                  href={contractSelectorUrl}
                  className={`rounded-xl px-5 py-3 text-center font-bold ${
                    decision === "TRADE READY" && !staleData
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  Find Best Contract
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

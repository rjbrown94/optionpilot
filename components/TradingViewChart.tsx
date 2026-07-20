"use client";

import { useEffect, useRef } from "react";
import TradeConfirmationCard from "@/components/trade/TradeConfirmationCard";

type TradingViewChartProps = {
  symbol: string;
};

function getTradingViewSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.includes(":")) {
    return normalized;
  }

  const amex = new Set([
    "SPY",
    "QQQ",
    "DIA",
    "IWM",
    "SMH",
    "XLK",
    "XLF",
    "XLE",
    "XLV",
    "XLI",
    "XLY",
    "XLP",
    "XLU",
    "XLB",
    "XLRE",
    "GLD",
    "SLV",
    "TQQQ",
    "SQQQ",
  ]);

  if (amex.has(normalized)) {
    return `AMEX:${normalized}`;
  }

  return `NASDAQ:${normalized}`;
}

export default function TradingViewChart({ symbol }: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    container.current.innerHTML = "";

    const script = document.createElement("script");

    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

    script.async = true;
    script.type = "text/javascript";

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: getTradingViewSymbol(symbol),
      interval: "5",
      timezone: "America/Chicago",
      theme: "dark",
      style: "1",
      locale: "en",

      allow_symbol_change: true,
      hide_side_toolbar: false,
      withdateranges: true,
      save_image: true,

      details: true,
      calendar: false,
      hotlist: false,

      studies: ["Volume@tv-basicstudies", "RSI@tv-basicstudies"],

      support_host: "https://www.tradingview.com",
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [symbol]);

  return (
    <div className="mb-8">
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 p-5">
          <h2 className="text-2xl font-bold text-white">
            {symbol.toUpperCase()} — 5-Minute Chart
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Chart for visual confirmation. OptionPilot calculates the VWAP, EMA
            alignment, market structure, volume confirmation, and trade signal
            below.
          </p>
        </div>

        <div className="h-[900px] w-full">
          <div
            ref={container}
            className="tradingview-widget-container h-full w-full"
          />
        </div>
      </div>

      {/* AI Confirmation Engine */}

      <TradeConfirmationCard symbol={symbol} />
    </div>
  );
}

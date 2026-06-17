"use client";

import { useEffect, useRef } from "react";

export default function TradingViewChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    container.current.innerHTML = "";

    const script = document.createElement("script");

    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `NASDAQ:${symbol}`,
      interval: "5",
      timezone: "America/Chicago",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      hide_side_toolbar: false,
      withdateranges: true,
      save_image: true,
      studies: [
        "Volume@tv-basicstudies",
        "RSI@tv-basicstudies",
        "MASimple@tv-basicstudies",
      ],
    });

    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-black mb-8">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-2xl font-bold">TradingView Chart</h2>
      </div>

      <div className="h-[900px] w-full">
        <div
          ref={container}
          className="tradingview-widget-container h-full w-full"
        />
      </div>
    </div>
  );
}

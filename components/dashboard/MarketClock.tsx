"use client";

import { useEffect, useState } from "react";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type MarketState =
  | "MARKET OPEN"
  | "AFTER HOURS"
  | "PREMARKET"
  | "MARKET CLOSED";

type MarketClockStatus = {
  state: MarketState;
  title: string;
  message: string;
  badge: string;
  tone: "bullish" | "neutral" | "bearish";
  time: string;
};

function getChicagoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday =
    parts.find((part) => part.type === "weekday")?.value || "";

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value || 0,
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );

  return {
    weekday,
    hour,
    minute,
  };
}

function getMarketClockStatus(date: Date): MarketClockStatus {
  const { weekday, hour, minute } = getChicagoParts(date);

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  const currentMinutes = hour * 60 + minute;

  const premarketStart = 4 * 60;
  const marketOpen = 8 * 60 + 30;
  const marketClose = 15 * 60;
  const afterHoursEnd = 19 * 60;

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  if (isWeekend) {
    return {
      state: "MARKET CLOSED",
      title: "Market Closed",
      message: "U.S. markets are closed for the weekend.",
      badge: "Closed",
      tone: "neutral",
      time,
    };
  }

  if (
    currentMinutes >= marketOpen &&
    currentMinutes < marketClose
  ) {
    return {
      state: "MARKET OPEN",
      title: "Market Open",
      message: "Regular U.S. trading session is active.",
      badge: "Live",
      tone: "bullish",
      time,
    };
  }

  if (
    currentMinutes >= marketClose &&
    currentMinutes < afterHoursEnd
  ) {
    return {
      state: "AFTER HOURS",
      title: "After Hours",
      message:
        "Regular trading has ended. After-hours trading is active.",
      badge: "After Hours",
      tone: "neutral",
      time,
    };
  }

  if (
    currentMinutes >= premarketStart &&
    currentMinutes < marketOpen
  ) {
    return {
      state: "PREMARKET",
      title: "Premarket",
      message:
        "Premarket trading is active. Prepare your watchlist.",
      badge: "Open Soon",
      tone: "bullish",
      time,
    };
  }

  return {
    state: "MARKET CLOSED",
    title: "Market Closed",
    message:
      "U.S. markets are closed. Premarket begins at 4:00 AM CT.",
    badge: "Closed",
    tone: "neutral",
    time,
  };
}

export default function MarketClock() {
  const [status, setStatus] = useState<MarketClockStatus | null>(
    null,
  );

  useEffect(() => {
    function updateClock() {
      setStatus(getMarketClockStatus(new Date()));
    }

    updateClock();

    const timer = window.setInterval(updateClock, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  if (!status) {
    return (
      <Card className="p-5">
        <p className="text-sm text-zinc-400">
          Loading market clock...
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">
            Market Clock
          </p>

          <h2 className="mt-1 text-2xl font-bold text-white">
            {status.title}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {status.message}
          </p>

          <p className="mt-2 text-xs text-zinc-600">
            {status.time} CT
          </p>
        </div>

        <Badge tone={status.tone}>
          {status.badge}
        </Badge>
      </div>
    </Card>
  );
}

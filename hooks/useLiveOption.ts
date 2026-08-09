"use client";

import { useEffect, useMemo, useState } from "react";

export type LiveOptionTrade = {
  event: "trade";
  ticker: string;
  price: number;
  size: number;
  exchange: number | null;
  timestamp: number;
};

export type LiveOptionQuote = {
  event: "quote";
  ticker: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: number;
};

export type LiveOptionMinute = {
  event: "minute";
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

export type LiveOptionUpdate =
  | LiveOptionTrade
  | LiveOptionQuote
  | LiveOptionMinute;

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "closed";

type UseLiveOptionResult = {
  status: ConnectionStatus;
  error: string | null;

  lastTrade: LiveOptionTrade | null;
  lastQuote: LiveOptionQuote | null;
  minuteBar: LiveOptionMinute | null;

  premium: number | null;
  bid: number | null;
  ask: number | null;
  midpoint: number | null;
  spread: number | null;
  spreadPercent: number | null;
  volume: number | null;

  lastUpdatedAt: number | null;
};

function normalizeContract(contract: string | null | undefined): string {
  return (contract || "").trim().toUpperCase();
}

function calculateMidpoint(
  bid: number | null,
  ask: number | null,
): number | null {
  if (
    bid === null ||
    ask === null ||
    !Number.isFinite(bid) ||
    !Number.isFinite(ask) ||
    bid <= 0 ||
    ask <= 0 ||
    ask < bid
  ) {
    return null;
  }

  return (bid + ask) / 2;
}

export function useLiveOption(
  contract: string | null | undefined,
): UseLiveOptionResult {
  const cleanContract = useMemo(() => normalizeContract(contract), [contract]);

  const [status, setStatus] = useState<ConnectionStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  const [lastTrade, setLastTrade] = useState<LiveOptionTrade | null>(null);

  const [lastQuote, setLastQuote] = useState<LiveOptionQuote | null>(null);

  const [minuteBar, setMinuteBar] = useState<LiveOptionMinute | null>(null);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    setLastTrade(null);
    setLastQuote(null);
    setMinuteBar(null);
    setLastUpdatedAt(null);
    setError(null);

    if (!cleanContract) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");

    const endpoint = new URL("/api/options-stream", window.location.origin);

    endpoint.searchParams.set("contract", cleanContract);

    const source = new EventSource(endpoint.toString());

    source.addEventListener("ready", () => {
      setStatus("connected");
      setError(null);
    });

    source.addEventListener("update", (event) => {
      try {
        const update = JSON.parse(
          (event as MessageEvent).data,
        ) as LiveOptionUpdate;

        setLastUpdatedAt(update.timestamp);

        if (update.event === "trade") {
          setLastTrade(update);
          return;
        }

        if (update.event === "quote") {
          setLastQuote(update);
          return;
        }

        if (update.event === "minute") {
          setMinuteBar(update);
        }
      } catch {
        setError("Received invalid live option data.");
      }
    });

    source.addEventListener("stream-error", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };

        setError(payload.message || "Live option stream failed.");
      } catch {
        setError("Live option stream failed.");
      }

      setStatus("error");
    });

    source.onerror = () => {
      setStatus("error");
      setError("Live option connection was interrupted.");
    };

    return () => {
      source.close();
      setStatus("closed");
    };
  }, [cleanContract]);

  const bid = lastQuote?.bidPrice ?? null;

  const ask = lastQuote?.askPrice ?? null;

  const midpoint = calculateMidpoint(bid, ask);

  const spread = bid !== null && ask !== null && ask >= bid ? ask - bid : null;

  const spreadPercent =
    spread !== null && midpoint !== null && midpoint > 0
      ? (spread / midpoint) * 100
      : null;

  const premium = lastTrade?.price ?? midpoint ?? minuteBar?.close ?? null;

  return {
    status,
    error,

    lastTrade,
    lastQuote,
    minuteBar,

    premium,
    bid,
    ask,
    midpoint,
    spread,
    spreadPercent,
    volume: minuteBar?.volume ?? null,

    lastUpdatedAt,
  };
}

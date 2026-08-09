"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import { useTradeContext } from "@/components/providers/TradeContext";

export type SmartMoneyDirection = "CALLS" | "PUTS" | "NEUTRAL";

type InstitutionalSide = "ASK" | "BID" | "MID" | "UNKNOWN";

type InstitutionalClassification =
  | "SWEEP_LIKE"
  | "BLOCK"
  | "LARGE_PREMIUM"
  | "STANDARD";

type FinalDecision = "TRADE READY" | "WATCH" | "SKIP";

type ConfirmationResponse = {
  success: boolean;
  symbol?: string;
  decision?: FinalDecision;
  finalScore?: number;
  alignment?: {
    flowAligned?: boolean;
    technicalAligned?: boolean;
    executionConfirmed?: boolean;
  };
  reasons?: string[];
  warnings?: string[];
  summary?: string;
  error?: string;
};

export type SmartMoneyCardProps = {
  symbol: string;
  direction: SmartMoneyDirection;
  contractSymbol?: string | null;
  strike?: number | null;
  expiration?: string | null;
  premium: number;
  tradePrice?: number | null;
  volume?: number | null;
  openInterest?: number | null;
  bid?: number | null;
  ask?: number | null;
  side?: InstitutionalSide;
  classification?: InstitutionalClassification;
  confidence: number;
  timestamp?: number | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 2,
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatStrike(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `$${value.toFixed(2)}`;
}

function getDirectionClasses(direction: SmartMoneyDirection): string {
  if (direction === "CALLS") {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
  }

  if (direction === "PUTS") {
    return "border-red-700 bg-red-950/50 text-red-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function getSideLabel(side: InstitutionalSide): string {
  if (side === "ASK") return "Bought at Ask";
  if (side === "BID") return "Sold at Bid";
  if (side === "MID") return "Near Midpoint";
  return "Side Unknown";
}

function getClassificationLabel(
  classification: InstitutionalClassification,
): string {
  if (classification === "SWEEP_LIKE") return "Sweep-Like";
  if (classification === "BLOCK") return "Block Trade";
  if (classification === "LARGE_PREMIUM") return "Large Premium";
  return "Standard Flow";
}

function getDecisionClasses(decision: FinalDecision): string {
  if (decision === "TRADE READY") {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
  }

  if (decision === "WATCH") {
    return "border-yellow-700 bg-yellow-950/50 text-yellow-300";
  }

  return "border-red-700 bg-red-950/50 text-red-300";
}

export default function SmartMoneyCard({
  symbol,
  direction,
  contractSymbol = null,
  strike = null,
  expiration = null,
  premium,
  tradePrice = null,
  volume = null,
  openInterest = null,
  bid = null,
  ask = null,
  side = "UNKNOWN",
  classification = "STANDARD",
  confidence,
  timestamp = null,
}: SmartMoneyCardProps) {
  const [confirmation, setConfirmation] = useState<ConfirmationResponse | null>(
    null,
  );
  const [loadingConfirmation, setLoadingConfirmation] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );

  const router = useRouter();
  const { setInstitutionalFlow } = useTradeContext();

  async function confirmTrade(): Promise<void> {
    if (direction === "NEUTRAL") {
      setConfirmationError(
        "A neutral options-flow direction cannot be confirmed.",
      );
      return;
    }

    setLoadingConfirmation(true);
    setConfirmationError(null);

    try {
      const searchParams = new URLSearchParams({
        symbol,
        direction,
        side,
        premium: String(premium),
        confidence: String(confidence),
        classification,
      });

      const response = await fetch(
        `/api/institutional-confirmation?${searchParams.toString()}`,
        { cache: "no-store" },
      );

      const text = await response.text();

      if (!text.trim()) {
        throw new Error(
          "Institutional confirmation returned an empty response.",
        );
      }

      let payload: ConfirmationResponse;

      try {
        payload = JSON.parse(text) as ConfirmationResponse;
      } catch {
        throw new Error("Institutional confirmation returned invalid JSON.");
      }

      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error ||
            `Institutional confirmation returned ${response.status}.`,
        );
      }

      setConfirmation(payload);

      setInstitutionalFlow({
        symbol,
        direction: direction === "CALLS" ? "CALL" : "PUT",
        confidence,
        premium,
        side,
        source: "Smart Money",
      });

      router.push(`/scanner?symbol=${encodeURIComponent(symbol)}`);
    } catch (error) {
      setConfirmation(null);
      setConfirmationError(
        error instanceof Error
          ? error.message
          : "Unable to confirm this trade.",
      );
    } finally {
      setLoadingConfirmation(false);
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-bold text-white">{symbol}</h3>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${getDirectionClasses(
                direction,
              )}`}
            >
              {direction}
            </span>
          </div>

          {contractSymbol && (
            <p className="mt-2 break-all text-xs text-zinc-500">
              {contractSymbol}
            </p>
          )}
        </div>

        <ConfidenceBadge score={confidence} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-bold text-zinc-300">
          {getClassificationLabel(classification)}
        </span>
        <span className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-bold text-zinc-300">
          {getSideLabel(side)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black p-3">
          <p className="text-xs text-zinc-500">Premium</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {formatCurrency(premium)}
          </p>
        </div>

        <div className="rounded-xl bg-black p-3">
          <p className="text-xs text-zinc-500">Trade Price</p>
          <p className="mt-1 text-lg font-bold text-white">
            {tradePrice === null ? "--" : formatCurrency(tradePrice)}
          </p>
        </div>

        <div className="rounded-xl bg-black p-3">
          <p className="text-xs text-zinc-500">Strike</p>
          <p className="mt-1 font-bold text-white">{formatStrike(strike)}</p>
        </div>

        <div className="rounded-xl bg-black p-3">
          <p className="text-xs text-zinc-500">Expiration</p>
          <p className="mt-1 font-bold text-white">{expiration || "--"}</p>
        </div>

        <div className="rounded-xl bg-black p-3">
          <p className="text-xs text-zinc-500">Volume / OI</p>
          <p className="mt-1 font-bold text-white">
            {formatNumber(volume)} / {formatNumber(openInterest)}
          </p>
        </div>

        <div className="rounded-xl bg-black p-3">
          <p className="text-xs text-zinc-500">Bid / Ask</p>
          <p className="mt-1 font-bold text-white">
            {bid === null ? "--" : formatCurrency(bid)} /{" "}
            {ask === null ? "--" : formatCurrency(ask)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void confirmTrade()}
          disabled={loadingConfirmation}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingConfirmation ? "Confirming..." : "Confirm Trade"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (direction !== "NEUTRAL") {
              setInstitutionalFlow({
                symbol,
                direction: direction === "CALLS" ? "CALL" : "PUT",
                confidence,
                premium,
                side,
                source: "Smart Money",
              });
            }

            router.push(`/scanner?symbol=${encodeURIComponent(symbol)}`);
          }}
          className="rounded-lg bg-white px-4 py-2 text-center text-sm font-bold text-black transition hover:bg-zinc-200"
        >
          Open Scanner
        </button>
      </div>

      {confirmationError && (
        <div className="mt-4 rounded-xl border border-red-800 bg-red-950/40 p-4">
          <p className="text-sm font-bold text-red-300">
            Confirmation unavailable
          </p>
          <p className="mt-1 text-sm text-red-200">{confirmationError}</p>
        </div>
      )}

      {confirmation?.decision && (
        <div className="mt-5 rounded-2xl border border-zinc-700 bg-black p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Institutional Confirmation
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {confirmation.finalScore ?? 0}/100
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${getDecisionClasses(
                confirmation.decision,
              )}`}
            >
              {confirmation.decision}
            </span>
          </div>

          {confirmation.summary && (
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              {confirmation.summary}
            </p>
          )}

          {(confirmation.reasons?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                Confirmations
              </p>
              <div className="mt-2 space-y-1">
                {confirmation.reasons?.slice(0, 4).map((reason) => (
                  <p key={reason} className="text-sm text-zinc-300">
                    ✓ {reason}
                  </p>
                ))}
              </div>
            </div>
          )}

          {(confirmation.warnings?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-yellow-400">
                Warnings
              </p>
              <div className="mt-2 space-y-1">
                {confirmation.warnings?.slice(0, 4).map((warning) => (
                  <p key={warning} className="text-sm text-zinc-400">
                    • {warning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {timestamp && (
        <p className="mt-4 text-xs text-zinc-500">
          Updated{" "}
          {new Date(timestamp).toLocaleTimeString("en-US", {
            timeZone: "America/Chicago",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          })}{" "}
          CT
        </p>
      )}
    </article>
  );
}

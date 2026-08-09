import { NextResponse } from "next/server";

import {
  calculateInstitutionalConfirmation,
  type InstitutionalDirection,
  type InstitutionalSide,
  type TechnicalConfirmationInput,
} from "@/libs/trade/institutionalConfirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TradeConfirmationResponse = {
  symbol?: string;
  updatedAt?: string;

  signal?: "CALL READY" | "PUT READY" | "WAIT";
  direction?: "Bullish" | "Bearish" | "Mixed";
  score?: number;

  price?: number;
  vwap?: number;
  ema9?: number;
  ema20?: number;
  relativeVolume?: number;

  aboveVWAP?: boolean;
  belowVWAP?: boolean;

  higherHigh?: boolean;
  higherLow?: boolean;
  lowerHigh?: boolean;
  lowerLow?: boolean;

  bullishEMA?: boolean;
  bearishEMA?: boolean;
  strongVolume?: boolean;

  confirmations?: string[];
  warnings?: string[];

  error?: string;
};

type InstitutionalClassification =
  | "SWEEP_LIKE"
  | "BLOCK"
  | "LARGE_PREMIUM"
  | "STANDARD";

function normalizeSymbol(value: string | null): string {
  return value?.trim().toUpperCase() || "";
}

function parseDirection(
  value: string | null,
): InstitutionalDirection | null {
  const normalized = value?.trim().toUpperCase();

  if (normalized === "CALLS" || normalized === "PUTS") {
    return normalized;
  }

  return null;
}

function parseSide(
  value: string | null,
): InstitutionalSide {
  const normalized = value?.trim().toUpperCase();

  if (
    normalized === "ASK" ||
    normalized === "BID" ||
    normalized === "MID" ||
    normalized === "UNKNOWN"
  ) {
    return normalized;
  }

  return "UNKNOWN";
}

function parseClassification(
  value: string | null,
): InstitutionalClassification {
  const normalized = value?.trim().toUpperCase();

  if (
    normalized === "SWEEP_LIKE" ||
    normalized === "BLOCK" ||
    normalized === "LARGE_PREMIUM" ||
    normalized === "STANDARD"
  ) {
    return normalized;
  }

  return "STANDARD";
}

function parseNumber(
  value: string | null,
  fallback = 0,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function buildTechnicalInput(
  data: TradeConfirmationResponse,
): TechnicalConfirmationInput {
  return {
    signal: data.signal || "WAIT",
    direction: data.direction || "Mixed",
    score: clamp(data.score || 0, 0, 100),

    aboveVWAP: data.aboveVWAP || false,
    belowVWAP: data.belowVWAP || false,

    bullishEMA: data.bullishEMA || false,
    bearishEMA: data.bearishEMA || false,

    higherHigh: data.higherHigh || false,
    higherLow: data.higherLow || false,
    lowerHigh: data.lowerHigh || false,
    lowerLow: data.lowerLow || false,

    strongVolume: data.strongVolume || false,
    relativeVolume: data.relativeVolume || 0,

    confirmations: data.confirmations || [],
    warnings: data.warnings || [],
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);

    const symbol = normalizeSymbol(
      requestUrl.searchParams.get("symbol"),
    );

    const direction = parseDirection(
      requestUrl.searchParams.get("direction"),
    );

    const side = parseSide(
      requestUrl.searchParams.get("side"),
    );

    const premium = Math.max(
      0,
      parseNumber(
        requestUrl.searchParams.get("premium"),
      ),
    );

    const confidence = clamp(
      parseNumber(
        requestUrl.searchParams.get("confidence"),
      ),
      0,
      100,
    );

    const classification = parseClassification(
      requestUrl.searchParams.get("classification"),
    );

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: "A symbol is required.",
        },
        { status: 400 },
      );
    }

    if (!direction) {
      return NextResponse.json(
        {
          success: false,
          symbol,
          error:
            "Direction must be CALLS or PUTS.",
        },
        { status: 400 },
      );
    }

    const confirmationUrl = new URL(
      "/api/trade-confirmation",
      requestUrl.origin,
    );

    confirmationUrl.searchParams.set(
      "symbol",
      symbol,
    );

    const response = await fetch(
      confirmationUrl.toString(),
      {
        cache: "no-store",
      },
    );

    const text = await response.text();

    if (!text.trim()) {
      return NextResponse.json(
        {
          success: false,
          symbol,
          decision: "SKIP",
          error:
            "Trade confirmation returned an empty response.",
        },
        { status: 502 },
      );
    }

    let technicalData: TradeConfirmationResponse;

    try {
      technicalData =
        JSON.parse(text) as TradeConfirmationResponse;
    } catch {
      return NextResponse.json(
        {
          success: false,
          symbol,
          decision: "SKIP",
          error:
            "Trade confirmation returned invalid JSON.",
        },
        { status: 502 },
      );
    }

    if (
      !response.ok ||
      technicalData.error
    ) {
      return NextResponse.json(
        {
          success: false,
          symbol,
          decision: "SKIP",
          error:
            technicalData.error ||
            "Unable to load technical confirmation.",
        },
        {
          status:
            response.status >= 400
              ? response.status
              : 502,
        },
      );
    }

    const technical = buildTechnicalInput(
      technicalData,
    );

    const result =
      calculateInstitutionalConfirmation({
        flow: {
          direction,
          side,
          premium,
          confidence,
          classification,
        },
        technical,
      });

    return NextResponse.json({
      success: true,

      symbol,
      updatedAt:
        technicalData.updatedAt ||
        new Date().toISOString(),

      decision: result.decision,
      finalScore: result.finalScore,

      alignment: {
        flowAligned: result.flowAligned,
        technicalAligned:
          result.technicalAligned,
        executionConfirmed:
          result.executionConfirmed,
      },

      institutionalFlow: {
        direction,
        side,
        premium,
        confidence,
        classification,
      },

      technical: {
        signal: technical.signal,
        direction: technical.direction,
        score: technical.score,

        price: technicalData.price || 0,
        vwap: technicalData.vwap || 0,
        ema9: technicalData.ema9 || 0,
        ema20: technicalData.ema20 || 0,

        relativeVolume:
          technical.relativeVolume,

        aboveVWAP:
          technical.aboveVWAP,
        belowVWAP:
          technical.belowVWAP,

        bullishEMA:
          technical.bullishEMA,
        bearishEMA:
          technical.bearishEMA,

        higherHigh:
          technical.higherHigh,
        higherLow:
          technical.higherLow,
        lowerHigh:
          technical.lowerHigh,
        lowerLow:
          technical.lowerLow,

        strongVolume:
          technical.strongVolume,

        confirmations:
          technical.confirmations,
        warnings:
          technical.warnings,
      },

      reasons: result.reasons,
      warnings: result.warnings,
      summary: result.summary,
    });
  } catch (error) {
    console.error(
      "Institutional confirmation failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        decision: "SKIP",
        error:
          error instanceof Error
            ? error.message
            : "Institutional confirmation failed.",
      },
      { status: 500 },
    );
  }
}

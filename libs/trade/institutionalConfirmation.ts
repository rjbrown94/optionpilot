export type InstitutionalDirection = "CALLS" | "PUTS";

export type InstitutionalSide =
  | "ASK"
  | "BID"
  | "MID"
  | "UNKNOWN";

export type TechnicalSignal =
  | "CALL READY"
  | "PUT READY"
  | "WAIT";

export type FinalTradeDecision =
  | "TRADE READY"
  | "WATCH"
  | "SKIP";

export type InstitutionalFlowInput = {
  direction: InstitutionalDirection;
  side: InstitutionalSide;
  premium: number;
  confidence: number;
  classification?:
    | "SWEEP_LIKE"
    | "BLOCK"
    | "LARGE_PREMIUM"
    | "STANDARD";
};

export type TechnicalConfirmationInput = {
  signal: TechnicalSignal;
  direction: "Bullish" | "Bearish" | "Mixed";
  score: number;

  aboveVWAP: boolean;
  belowVWAP: boolean;

  bullishEMA: boolean;
  bearishEMA: boolean;

  higherHigh: boolean;
  higherLow: boolean;
  lowerHigh: boolean;
  lowerLow: boolean;

  strongVolume: boolean;
  relativeVolume: number;

  confirmations: string[];
  warnings: string[];
};

export type InstitutionalConfirmationResult = {
  decision: FinalTradeDecision;
  finalScore: number;

  flowAligned: boolean;
  technicalAligned: boolean;
  executionConfirmed: boolean;

  reasons: string[];
  warnings: string[];

  summary: string;
};

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
): number {
  return Math.max(
    minimum,
    Math.min(maximum, Math.round(value)),
  );
}

function isBullishFlow(
  flow: InstitutionalFlowInput,
): boolean {
  return flow.direction === "CALLS";
}

function isTechnicalDirectionAligned(
  flow: InstitutionalFlowInput,
  technical: TechnicalConfirmationInput,
): boolean {
  if (flow.direction === "CALLS") {
    return technical.direction === "Bullish";
  }

  return technical.direction === "Bearish";
}

function isReadySignalAligned(
  flow: InstitutionalFlowInput,
  technical: TechnicalConfirmationInput,
): boolean {
  if (flow.direction === "CALLS") {
    return technical.signal === "CALL READY";
  }

  return technical.signal === "PUT READY";
}

function getExecutionConfirmed(
  flow: InstitutionalFlowInput,
): boolean {
  if (flow.direction === "CALLS") {
    return flow.side === "ASK";
  }

  return flow.side === "BID";
}

export function calculateInstitutionalConfirmation({
  flow,
  technical,
}: {
  flow: InstitutionalFlowInput;
  technical: TechnicalConfirmationInput;
}): InstitutionalConfirmationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const bullishFlow = isBullishFlow(flow);

  const flowAligned = isTechnicalDirectionAligned(
    flow,
    technical,
  );

  const readySignalAligned = isReadySignalAligned(
    flow,
    technical,
  );

  const executionConfirmed =
    getExecutionConfirmed(flow);

  let score = 0;

  /*
   * Institutional flow confidence: 30 points
   */
  score += Math.min(flow.confidence * 0.3, 30);

  if (flow.confidence >= 80) {
    reasons.push(
      `Strong institutional confidence: ${flow.confidence}/100`,
    );
  } else if (flow.confidence < 60) {
    warnings.push(
      `Institutional confidence is only ${flow.confidence}/100`,
    );
  }

  /*
   * Premium size: 15 points
   */
  if (flow.premium >= 1_000_000) {
    score += 15;
    reasons.push("Institutional premium exceeds $1 million");
  } else if (flow.premium >= 500_000) {
    score += 13;
    reasons.push("Institutional premium exceeds $500,000");
  } else if (flow.premium >= 250_000) {
    score += 10;
    reasons.push("Institutional premium exceeds $250,000");
  } else if (flow.premium >= 100_000) {
    score += 7;
    reasons.push("Institutional premium exceeds $100,000");
  } else if (flow.premium >= 25_000) {
    score += 4;
  }

  /*
   * Trade execution side: 15 points
   */
  if (executionConfirmed) {
    score += 15;

    reasons.push(
      bullishFlow
        ? "Call trade executed near the ask"
        : "Put trade executed near the bid",
    );
  } else if (flow.side === "MID") {
    score += 5;
    warnings.push(
      "Trade executed near the midpoint, so aggression is unclear",
    );
  } else if (flow.side === "UNKNOWN") {
    warnings.push(
      "Execution side could not be confirmed",
    );
  } else {
    warnings.push(
      "Execution side conflicts with the expected directional flow",
    );
  }

  /*
   * Technical score: 25 points
   */
  score += Math.min(technical.score * 0.25, 25);

  if (flowAligned) {
    reasons.push(
      `Technical direction agrees with ${flow.direction}`,
    );
  } else {
    warnings.push(
      `Technical direction does not agree with ${flow.direction}`,
    );
  }

  /*
   * Full entry signal: 10 points
   */
  if (readySignalAligned) {
    score += 10;
    reasons.push(
      `${technical.signal} is technically confirmed`,
    );
  } else if (technical.signal === "WAIT") {
    warnings.push(
      "Technical engine is still waiting for full entry confirmation",
    );
  } else {
    warnings.push(
      `Technical signal ${technical.signal} conflicts with ${flow.direction}`,
    );
  }

  /*
   * Relative volume: 5 points
   */
  if (technical.strongVolume) {
    score += 5;
    reasons.push(
      `Relative volume is ${technical.relativeVolume.toFixed(
        2,
      )}x`,
    );
  } else {
    warnings.push(
      `Relative volume is only ${technical.relativeVolume.toFixed(
        2,
      )}x`,
    );
  }

  if (
    flow.classification === "SWEEP_LIKE"
  ) {
    reasons.push("Sweep-like activity detected");
  }

  if (flow.classification === "BLOCK") {
    reasons.push("Block-sized option trade detected");
  }

  if (
    flow.classification === "LARGE_PREMIUM"
  ) {
    reasons.push("Large-premium trade detected");
  }

  score = clamp(score);

  let decision: FinalTradeDecision = "SKIP";

  if (
    score >= 80 &&
    flowAligned &&
    readySignalAligned &&
    executionConfirmed
  ) {
    decision = "TRADE READY";
  } else if (
    score >= 60 &&
    flowAligned
  ) {
    decision = "WATCH";
  }

  let summary: string;

  if (decision === "TRADE READY") {
    summary =
      `${flow.direction} institutional flow and technical confirmation are aligned. ` +
      "The setup may be ready, but verify the current contract quote and risk before entering.";
  } else if (decision === "WATCH") {
    summary =
      `${flow.direction} flow is worth monitoring, but every entry condition is not aligned yet. ` +
      "Wait for the technical engine to confirm the setup.";
  } else {
    summary =
      "Institutional flow and technical confirmation are not aligned well enough for a trade.";
  }

  return {
    decision,
    finalScore: score,

    flowAligned,
    technicalAligned: readySignalAligned,
    executionConfirmed,

    reasons,
    warnings: [
      ...warnings,
      ...technical.warnings,
    ],

    summary,
  };
}

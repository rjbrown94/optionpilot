import type {
  OptionQuoteUpdate,
  OptionTradeUpdate,
} from "./optionsWebSocket";

export type InstitutionalSide = "ASK" | "BID" | "MID" | "UNKNOWN";

export type InstitutionalLabel =
  | "LARGE_PREMIUM"
  | "BLOCK"
  | "SWEEP_LIKE"
  | "TIGHT_SPREAD"
  | "ASK_SIDE"
  | "BID_SIDE";

export type ClassifiedOptionTrade = {
  ticker: string;
  price: number;
  size: number;
  exchange: number | null;
  timestamp: number;
  premium: number;
  side: InstitutionalSide;
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  spreadPercent: number | null;
  classification:
    | "SWEEP_LIKE"
    | "BLOCK"
    | "LARGE_PREMIUM"
    | "STANDARD";
  labels: InstitutionalLabel[];
  confidence: number;
};

type RecentTrade = {
  timestamp: number;
  premium: number;
  exchange: number | null;
};

const QUOTE_MAX_AGE_MS = 5_000;
const SWEEP_WINDOW_MS = 1_500;
const LARGE_PREMIUM = 100_000;
const BLOCK_SIZE = 100;
const MAX_RECENT_TRADES_PER_CONTRACT = 50;

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function getTradeSide(
  trade: OptionTradeUpdate,
  quote: OptionQuoteUpdate | undefined,
): InstitutionalSide {
  if (!quote) {
    return "UNKNOWN";
  }

  const quoteAge = trade.timestamp - quote.timestamp;

  if (quoteAge > QUOTE_MAX_AGE_MS) {
    return "UNKNOWN";
  }

  const bid = quote.bidPrice;
  const ask = quote.askPrice;

  if (bid <= 0 || ask <= 0 || ask < bid) {
    return "UNKNOWN";
  }

  const spread = ask - bid;
  const tolerance = Math.max(0.01, spread * 0.15);

  if (trade.price >= ask - tolerance) {
    return "ASK";
  }

  if (trade.price <= bid + tolerance) {
    return "BID";
  }

  return "MID";
}

function getSpreadPercent(
  quote: OptionQuoteUpdate | undefined,
): number | null {
  if (
    !quote ||
    quote.bidPrice <= 0 ||
    quote.askPrice <= 0 ||
    quote.askPrice < quote.bidPrice
  ) {
    return null;
  }

  const midpoint = (quote.bidPrice + quote.askPrice) / 2;

  if (midpoint <= 0) {
    return null;
  }

  return ((quote.askPrice - quote.bidPrice) / midpoint) * 100;
}

export class InstitutionalTradeClassifier {
  private quotes = new Map<string, OptionQuoteUpdate>();

  private recentTrades = new Map<string, RecentTrade[]>();

  recordQuote(quote: OptionQuoteUpdate): void {
    this.quotes.set(quote.ticker, quote);
  }

  classify(
    trade: OptionTradeUpdate,
  ): ClassifiedOptionTrade {
    const quote = this.quotes.get(trade.ticker);

    const premium = trade.price * trade.size * 100;

    const side = getTradeSide(trade, quote);

    const spreadPercent = getSpreadPercent(quote);

    const cutoff = trade.timestamp - SWEEP_WINDOW_MS;

    const previousTrades = (
      this.recentTrades.get(trade.ticker) ?? []
    ).filter((item) => item.timestamp >= cutoff);

    const combinedTrades: RecentTrade[] = [
      ...previousTrades,
      {
        timestamp: trade.timestamp,
        premium,
        exchange: trade.exchange,
      },
    ];

    this.recentTrades.set(
      trade.ticker,
      combinedTrades.slice(
        -MAX_RECENT_TRADES_PER_CONTRACT,
      ),
    );

    const exchanges = new Set(
      combinedTrades
        .map((item) => item.exchange)
        .filter(
          (exchange): exchange is number =>
            exchange !== null,
        ),
    );

    const windowPremium = combinedTrades.reduce(
      (total, item) => total + item.premium,
      0,
    );

    const sweepLike =
      combinedTrades.length >= 3 &&
      exchanges.size >= 2 &&
      windowPremium >= LARGE_PREMIUM;

    const block = trade.size >= BLOCK_SIZE;

    const largePremium =
      premium >= LARGE_PREMIUM;

    const tightSpread =
      spreadPercent !== null &&
      spreadPercent > 0 &&
      spreadPercent <= 10;

    const labels: InstitutionalLabel[] = [];

    if (largePremium) {
      labels.push("LARGE_PREMIUM");
    }

    if (block) {
      labels.push("BLOCK");
    }

    if (sweepLike) {
      labels.push("SWEEP_LIKE");
    }

    if (tightSpread) {
      labels.push("TIGHT_SPREAD");
    }

    if (side === "ASK") {
      labels.push("ASK_SIDE");
    }

    if (side === "BID") {
      labels.push("BID_SIDE");
    }

    let confidence = 35;

    if (premium >= 1_000_000) {
      confidence += 30;
    } else if (premium >= 500_000) {
      confidence += 24;
    } else if (premium >= 250_000) {
      confidence += 18;
    } else if (premium >= 100_000) {
      confidence += 12;
    } else if (premium >= 25_000) {
      confidence += 6;
    }

    if (trade.size >= 500) {
      confidence += 15;
    } else if (trade.size >= 100) {
      confidence += 10;
    } else if (trade.size >= 25) {
      confidence += 5;
    }

    if (side === "ASK" || side === "BID") {
      confidence += 10;
    }

    if (tightSpread) {
      confidence += 5;
    }

    if (sweepLike) {
      confidence += 15;
    }

    const classification = sweepLike
      ? "SWEEP_LIKE"
      : block
        ? "BLOCK"
        : largePremium
          ? "LARGE_PREMIUM"
          : "STANDARD";

    return {
      ticker: trade.ticker,
      price: trade.price,
      size: trade.size,
      exchange: trade.exchange,
      timestamp: trade.timestamp,
      premium: round(premium),
      side,
      bidPrice: quote?.bidPrice ?? null,
      bidSize: quote?.bidSize ?? null,
      askPrice: quote?.askPrice ?? null,
      askSize: quote?.askSize ?? null,
      spreadPercent:
        spreadPercent === null
          ? null
          : round(spreadPercent),
      classification,
      labels,
      confidence: clamp(
        Math.round(confidence),
      ),
    };
  }
}

declare global {
  var optionPilotInstitutionalTradeClassifier:
    | InstitutionalTradeClassifier
    | undefined;
}

export const institutionalTradeClassifier =
  global.optionPilotInstitutionalTradeClassifier ??
  new InstitutionalTradeClassifier();

if (process.env.NODE_ENV !== "production") {
  global.optionPilotInstitutionalTradeClassifier =
    institutionalTradeClassifier;
}

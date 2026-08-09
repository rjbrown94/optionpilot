"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TradeDirection = "CALL" | "PUT" | "WAIT";

export type TradeStrategy = "day" | "swing" | "leaps";

export type SelectedOptionContract = {
  contractSymbol: string;
  stock: string;
  type: "CALL" | "PUT";
  strike: number;
  expiration: string;
  premium: number;

  stockPrice?: number;
  score?: number;
  volume?: number;
  openInterest?: number;

  bid?: number;
  ask?: number;
  spreadPercent?: number | null;

  impliedVolatility?: number | null;
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;

  breakEvenPrice?: number | null;
};

export type TradeContextState = {
  symbol: string;
  direction: TradeDirection;
  strategy: TradeStrategy;

  confidence: number | null;
  source: string | null;

  institutionalPremium: number | null;
  institutionalSide: "ASK" | "BID" | "MID" | "UNKNOWN" | null;

  scannerStatus:
    | "TRADE READY"
    | "WATCH"
    | "CONFLICT"
    | "WAIT"
    | null;

  scannerScore: number | null;

  selectedContract: SelectedOptionContract | null;

  updatedAt: string | null;
};

type TradeContextValue = TradeContextState & {
  setSymbol: (symbol: string) => void;
  setDirection: (direction: TradeDirection) => void;
  setStrategy: (strategy: TradeStrategy) => void;

  setInstitutionalFlow: (input: {
    symbol: string;
    direction: TradeDirection;
    confidence?: number | null;
    premium?: number | null;
    side?: "ASK" | "BID" | "MID" | "UNKNOWN" | null;
    source?: string | null;
  }) => void;

  setScannerResult: (input: {
    status:
      | "TRADE READY"
      | "WATCH"
      | "CONFLICT"
      | "WAIT";
    score: number;
  }) => void;

  selectContract: (
    contract: SelectedOptionContract | null,
  ) => void;

  resetTrade: () => void;
};

const STORAGE_KEY = "optionpilot-trade-context";

const defaultState: TradeContextState = {
  symbol: "",
  direction: "WAIT",
  strategy: "swing",

  confidence: null,
  source: null,

  institutionalPremium: null,
  institutionalSide: null,

  scannerStatus: null,
  scannerScore: null,

  selectedContract: null,

  updatedAt: null,
};

const TradeContext = createContext<TradeContextValue | null>(
  null,
);

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function loadStoredState(): TradeContextState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return defaultState;
    }

    const parsed = JSON.parse(
      stored,
    ) as Partial<TradeContextState>;

    return {
      ...defaultState,
      ...parsed,

      symbol:
        typeof parsed.symbol === "string"
          ? normalizeSymbol(parsed.symbol)
          : "",

      selectedContract:
        parsed.selectedContract &&
        typeof parsed.selectedContract === "object"
          ? parsed.selectedContract
          : null,
    };
  } catch {
    return defaultState;
  }
}

export function TradeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] =
    useState<TradeContextState>(defaultState);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadStoredState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch {
      // The app can continue even if browser storage is unavailable.
    }
  }, [state, hydrated]);

  const setSymbol = useCallback((symbol: string) => {
    setState((current) => ({
      ...current,
      symbol: normalizeSymbol(symbol),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setDirection = useCallback(
    (direction: TradeDirection) => {
      setState((current) => ({
        ...current,
        direction,
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const setStrategy = useCallback(
    (strategy: TradeStrategy) => {
      setState((current) => ({
        ...current,
        strategy,
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const setInstitutionalFlow = useCallback(
    ({
      symbol,
      direction,
      confidence = null,
      premium = null,
      side = null,
      source = "Smart Money",
    }: {
      symbol: string;
      direction: TradeDirection;
      confidence?: number | null;
      premium?: number | null;
      side?:
        | "ASK"
        | "BID"
        | "MID"
        | "UNKNOWN"
        | null;
      source?: string | null;
    }) => {
      setState((current) => ({
        ...current,

        symbol: normalizeSymbol(symbol),
        direction,
        confidence,
        source,

        institutionalPremium: premium,
        institutionalSide: side,

        scannerStatus: null,
        scannerScore: null,

        selectedContract: null,

        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const setScannerResult = useCallback(
    ({
      status,
      score,
    }: {
      status:
        | "TRADE READY"
        | "WATCH"
        | "CONFLICT"
        | "WAIT";
      score: number;
    }) => {
      setState((current) => ({
        ...current,

        scannerStatus: status,
        scannerScore: Math.max(
          0,
          Math.min(100, Math.round(score)),
        ),

        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const selectContract = useCallback(
    (contract: SelectedOptionContract | null) => {
      setState((current) => ({
        ...current,

        selectedContract: contract,

        symbol: contract
          ? normalizeSymbol(contract.stock)
          : current.symbol,

        direction: contract
          ? contract.type
          : current.direction,

        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const resetTrade = useCallback(() => {
    setState(defaultState);

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore browser storage errors.
    }
  }, []);

  const value = useMemo<TradeContextValue>(
    () => ({
      ...state,

      setSymbol,
      setDirection,
      setStrategy,

      setInstitutionalFlow,
      setScannerResult,
      selectContract,

      resetTrade,
    }),
    [
      state,
      setSymbol,
      setDirection,
      setStrategy,
      setInstitutionalFlow,
      setScannerResult,
      selectContract,
      resetTrade,
    ],
  );

  return (
    <TradeContext.Provider value={value}>
      {children}
    </TradeContext.Provider>
  );
}

export function useTradeContext(): TradeContextValue {
  const context = useContext(TradeContext);

  if (!context) {
    throw new Error(
      "useTradeContext must be used inside TradeProvider.",
    );
  }

  return context;
}

import { getMassiveCandles } from "./massiveCandles";
import { getMassiveQuote } from "./massiveQuote";
import { getFinnhubNews } from "./finnhubNews";
import { getMassiveOptions } from "./massiveOptions";

export async function getScannerData({
  symbol,
  forceRefresh = false,
}: {
  symbol: string;
  forceRefresh?: boolean;
}) {
  const cleanSymbol = symbol.trim().toUpperCase();

  const [quote, candles, news] = await Promise.all([
    getMassiveQuote({
      symbol: cleanSymbol,
      forceRefresh,
    }),

    getMassiveCandles({
      symbol: cleanSymbol,
      interval: "5min",
      limit: 250,
      forceRefresh,
    }),

    getFinnhubNews({
      symbol: cleanSymbol,
      forceRefresh,
    }),
  ]);

  return {
    symbol: cleanSymbol,
    quote,
    candles,
    news,

    getOptions: async (type: "call" | "put") =>
      getMassiveOptions({
        symbol: cleanSymbol,
        type,
        limit: 50,
        forceRefresh,
      }),
  };
}

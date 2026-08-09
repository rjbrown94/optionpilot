import { DISCOVERY_UNIVERSE } from "./discoveryUniverse";
import { getQuotes } from "./finnhub";
import { rankStocks } from "./ranking";

export async function runMarketDiscovery() {
  const quotes = await getQuotes(DISCOVERY_UNIVERSE);

  const ranked = rankStocks(quotes);

  return {
    scanned: DISCOVERY_UNIVERSE.length,
    qualified: ranked.length,

    topOpportunities: ranked.slice(0, 10),

    topGainers: ranked
      .filter((stock) => stock.percentChange > 0)
      .sort((a, b) => b.percentChange - a.percentChange)
      .slice(0, 10),

    topLosers: ranked
      .filter((stock) => stock.percentChange < 0)
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, 10),

    relativeVolume: ranked,

    premarket: [] as typeof ranked,

    afterHours: [] as typeof ranked,
  };
}

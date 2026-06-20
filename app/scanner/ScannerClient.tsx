"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TradingViewChart from "@/components/TradingViewChart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { getBestStrategy } from "@/libs/strategyEngine";

type StockData = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  percentChange: number;

  trend?: string;
  bestPlay?: string;

  rsi14?: number | null;
  ema20?: number | null;
  ema50?: number | null;

  volume?: number;
  averageVolume?: number;
  relativeVolume?: number;

  support?: number | null;
  resistance?: number | null;

  candlePattern?: string;
  candleDirection?: string;
  candleConfidence?: number;

  momentumScore?: number;
  setupQuality?: string;
  score?: number;
};

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type NewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number | null;
  catalystType: string;
  bias: string;
  catalystScore: number;
};

type NewsData = {
  symbol: string;
  catalyst: string;
  topCatalyst: NewsItem | null;
  news: NewsItem[];
};

function calculateEMA(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(values: number[], period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1];

    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;

  return 100 - 100 / (1 + rs);
}

function getChartAnalysis(candles: Candle[]) {
  if (candles.length < 15) {
    return {
      trend: "neutral",
      momentum: "Not enough data",
      breakout: "No breakout detected",
      support: "N/A",
      resistance: "N/A",
      candlePattern: "Unknown",
      momentumScore: 40,
      volumeRatio: "0.00",
      ema20: "N/A",
      ema50: "N/A",
      rsi: "N/A",
      rsiSignal: "N/A",
      trendSignal: "N/A",
    };
  }

  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const recent = candles.slice(-10);
  const closes = candles.map((candle) => candle.close);

  const ema20Value = calculateEMA(closes, 20);
  const ema50Value = calculateEMA(closes, 50);
  const rsiValue = calculateRSI(closes, 14);

  const support = Math.min(...recent.map((candle) => candle.low));
  const resistance = Math.max(...recent.map((candle) => candle.high));

  const greenCandles = recent.filter(
    (candle) => candle.close > candle.open,
  ).length;

  const averageVolume =
    recent.reduce((sum, candle) => sum + candle.volume, 0) / recent.length;

  const volumeRatio = latest.volume / averageVolume;
  const volumeStrong = latest.volume > averageVolume * 1.2;
  const priceAbovePreviousClose = latest.close > previous.close;
  const nearHigh =
    latest.close >= latest.high - (latest.high - latest.low) * 0.25;
  const breakout = latest.close >= resistance * 0.995;

  let trend = "neutral";

  if (greenCandles >= 6 && latest.close > recent[0].close) trend = "bullish";
  if (greenCandles <= 4 && latest.close < recent[0].close) trend = "bearish";

  let trendSignal = "Neutral";

  if (
    ema20Value &&
    ema50Value &&
    latest.close > ema20Value &&
    latest.close > ema50Value
  ) {
    trendSignal = "Bullish: price above EMA 20 and EMA 50";
    trend = "bullish";
  }

  if (
    ema20Value &&
    ema50Value &&
    latest.close < ema20Value &&
    latest.close < ema50Value
  ) {
    trendSignal = "Bearish: price below EMA 20 and EMA 50";
    trend = "bearish";
  }

  let rsiSignal = "Neutral";

  if (rsiValue !== null) {
    if (rsiValue >= 70) rsiSignal = "Overbought";
    if (rsiValue <= 30) rsiSignal = "Oversold";
    if (rsiValue > 55 && rsiValue < 70) rsiSignal = "Bullish momentum";
    if (rsiValue > 30 && rsiValue < 45) rsiSignal = "Bearish momentum";
  }

  let candlePattern = "No major pattern";

  if (
    latest.close > latest.open &&
    previous.close < previous.open &&
    latest.close > previous.open &&
    latest.open < previous.close
  ) {
    candlePattern = "Bullish Engulfing";
  }

  if (
    latest.close < latest.open &&
    previous.close > previous.open &&
    latest.open > previous.close &&
    latest.close < previous.open
  ) {
    candlePattern = "Bearish Engulfing";
  }

  if (
    latest.close > latest.open &&
    latest.high - latest.close < latest.close - latest.open &&
    latest.open - latest.low > latest.close - latest.open
  ) {
    candlePattern = "Bullish Hammer";
  }

  let momentumScore = 40;

  if (trend === "bullish") momentumScore += 20;
  if (trend === "bearish") momentumScore += 15;
  if (volumeStrong) momentumScore += 20;
  if (priceAbovePreviousClose) momentumScore += 10;
  if (nearHigh) momentumScore += 10;
  if (breakout) momentumScore += 10;
  if (rsiValue !== null && rsiValue > 55 && rsiValue < 70) momentumScore += 10;

  momentumScore = Math.min(momentumScore, 100);

  return {
    trend,
    momentum: volumeStrong ? "Strong volume" : "Normal volume",
    breakout: breakout ? "Breaking near recent high" : "No breakout detected",
    support: support.toFixed(2),
    resistance: resistance.toFixed(2),
    candlePattern,
    momentumScore,
    volumeRatio: volumeRatio.toFixed(2),
    ema20: ema20Value ? ema20Value.toFixed(2) : "N/A",
    ema50: ema50Value ? ema50Value.toFixed(2) : "N/A",
    rsi: rsiValue !== null ? rsiValue.toFixed(2) : "N/A",
    rsiSignal,
    trendSignal,
  };
}

function getOptionsImpact(news: NewsData | null) {
  const bias = news?.topCatalyst?.bias;

  if (bias === "Bullish") return "Calls favored if chart confirms";
  if (bias === "Bearish") return "Puts favored if chart confirms";

  return "Wait for chart confirmation";
}

function hasNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  return hasNumber(value) ? value.toFixed(decimals) : "N/A";
}

function getRsiSignal(value: number | null | undefined) {
  if (!hasNumber(value)) return "N/A";
  if (value >= 70) return "Overbought";
  if (value <= 30) return "Oversold";
  if (value > 55 && value < 70) return "Bullish momentum";
  if (value > 30 && value < 45) return "Bearish momentum";
  return "Neutral";
}

function getTrendSignalFromStock(stock: StockData | null) {
  if (!stock || !hasNumber(stock.ema20) || !hasNumber(stock.ema50))
    return "N/A";

  if (stock.price > stock.ema20! && stock.price > stock.ema50!) {
    return "Bullish: price above EMA 20 and EMA 50";
  }

  if (stock.price < stock.ema20! && stock.price < stock.ema50!) {
    return "Bearish: price below EMA 20 and EMA 50";
  }

  return "Neutral";
}

function getMomentumLabelFromStock(stock: StockData | null) {
  if (!stock || !hasNumber(stock.relativeVolume)) return "Not enough data";
  return stock.relativeVolume! >= 1.2 ? "Strong volume" : "Normal volume";
}

function getTradeScore({
  trend,
  chartAnalysis,
  news,
}: {
  trend: string;
  chartAnalysis: ReturnType<typeof getChartAnalysis>;
  news: NewsData | null;
}) {
  const trendPoints = trend === "bullish" || trend === "bearish" ? 20 : 0;

  const rsiPoints =
    chartAnalysis.rsiSignal === "Bullish momentum" ||
    chartAnalysis.rsiSignal === "Bearish momentum"
      ? 20
      : chartAnalysis.rsiSignal === "Overbought" ||
          chartAnalysis.rsiSignal === "Oversold"
        ? 10
        : 0;

  const emaPoints =
    chartAnalysis.trendSignal.includes("Bullish") ||
    chartAnalysis.trendSignal.includes("Bearish")
      ? 20
      : 0;

  const volumePoints = chartAnalysis.momentum === "Strong volume" ? 20 : 0;

  const newsPoints =
    news?.topCatalyst?.bias === "Bullish" ||
    news?.topCatalyst?.bias === "Bearish"
      ? 20
      : news?.topCatalyst
        ? 10
        : 0;

  const score = trendPoints + rsiPoints + emaPoints + volumePoints + newsPoints;

  const finalPlay =
    trend === "bearish" || news?.topCatalyst?.bias === "Bearish"
      ? "PUTS"
      : "CALLS";

  const setupQuality =
    score >= 90
      ? "Elite"
      : score >= 80
        ? "Strong"
        : score >= 70
          ? "Good"
          : "Wait";

  return {
    score,
    finalPlay,
    setupQuality,
    trendPoints,
    rsiPoints,
    emaPoints,
    volumePoints,
    newsPoints,
  };
}

export default function ScannerPage() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get("symbol") || "AAPL";

  const [ticker, setTicker] = useState(urlSymbol.toUpperCase());
  const [stock, setStock] = useState<StockData | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [news, setNews] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);

  async function scanStock(symbol: string) {
    const cleanSymbol = symbol.toUpperCase().trim();

    if (!cleanSymbol) return;

    setLoading(true);
    setTicker(cleanSymbol);

    try {
      const [stockResult, candleResult, newsResult] = await Promise.allSettled([
        fetch(`/api/stock?symbol=${cleanSymbol}`),
        fetch(`/api/candles?symbol=${cleanSymbol}`),
        fetch(`/api/news?symbol=${cleanSymbol}`),
      ]);

      if (stockResult.status === "fulfilled" && stockResult.value.ok) {
        const stockData = await stockResult.value.json();
        setStock(stockData);
      } else {
        setStock(null);
      }

      if (candleResult.status === "fulfilled" && candleResult.value.ok) {
        const candleData = await candleResult.value.json();

        const candleList = Array.isArray(candleData?.candles)
          ? candleData.candles
          : [];

        console.log("CANDLES LOADED:", candleList.length);

        setCandles(candleList);
      } else {
        console.log("CANDLES FAILED");
        setCandles([]);
      }

      if (newsResult.status === "fulfilled" && newsResult.value.ok) {
        const newsData = await newsResult.value.json();
        setNews(newsData);
      } else {
        setNews(null);
      }
    } catch (error) {
      console.error(error);
      setStock(null);
      setCandles([]);
      setNews(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const symbol = searchParams.get("symbol") || "AAPL";
    const cleanSymbol = symbol.toUpperCase().trim();

    setTicker(cleanSymbol);
    scanStock(cleanSymbol);
  }, [searchParams]);

  const chartAnalysis = getChartAnalysis(candles);
  const displayCandles = candles.slice(-45);

  const finalAnalysis = {
    ...chartAnalysis,
    trend: stock?.trend ? stock.trend.toLowerCase() : chartAnalysis.trend,
    momentum: stock ? getMomentumLabelFromStock(stock) : chartAnalysis.momentum,
    support: hasNumber(stock?.support)
      ? formatNumber(stock?.support)
      : chartAnalysis.support,
    resistance: hasNumber(stock?.resistance)
      ? formatNumber(stock?.resistance)
      : chartAnalysis.resistance,
    candlePattern:
      stock?.candlePattern && stock.candlePattern !== "Unknown"
        ? stock.candlePattern
        : chartAnalysis.candlePattern,
    momentumScore: hasNumber(stock?.momentumScore)
      ? stock!.momentumScore!
      : chartAnalysis.momentumScore,
    volumeRatio: hasNumber(stock?.relativeVolume)
      ? formatNumber(stock?.relativeVolume)
      : chartAnalysis.volumeRatio,
    ema20: hasNumber(stock?.ema20)
      ? formatNumber(stock?.ema20)
      : chartAnalysis.ema20,
    ema50: hasNumber(stock?.ema50)
      ? formatNumber(stock?.ema50)
      : chartAnalysis.ema50,
    rsi: hasNumber(stock?.rsi14)
      ? formatNumber(stock?.rsi14)
      : chartAnalysis.rsi,
    rsiSignal: hasNumber(stock?.rsi14)
      ? getRsiSignal(stock?.rsi14)
      : chartAnalysis.rsiSignal,
    trendSignal: stock
      ? getTrendSignalFromStock(stock)
      : chartAnalysis.trendSignal,
  };

  const trend =
    finalAnalysis.trend === "neutral"
      ? stock && stock.percentChange > 0
        ? "bullish"
        : "bearish"
      : finalAnalysis.trend;

  const tradeScore = getTradeScore({
    trend,
    chartAnalysis: finalAnalysis,
    news,
  });

  const volume =
    finalAnalysis.momentum === "Strong volume" ? "strong" : "normal";

  const result = getBestStrategy({
    ticker,
    trend,
    volatility: "medium",
    premiumCost: "normal",
    volume,
    risk: "medium",
  });

  const strategySlug = result.strategy.toLowerCase().replace(/\s+/g, "-");

  const tradeSetup = {
    entry:
      trend === "bullish"
        ? `Above resistance: $${finalAnalysis.resistance}`
        : `Below support: $${finalAnalysis.support}`,
    stopLoss:
      trend === "bullish"
        ? `Below support: $${finalAnalysis.support}`
        : `Above resistance: $${finalAnalysis.resistance}`,
    target:
      trend === "bullish"
        ? "Next resistance / prior high"
        : "Next support / prior low",
    contractType:
      tradeScore.finalPlay === "PUTS" ? "Put Contract" : "Call Contract",
    expiration: "14-30 DTE",
    riskPlan: "Risk only 1-2% of account per trade",
    contractIdea: result.strategy.includes("Spread")
      ? "Use a defined-risk spread near the money"
      : "Use a liquid contract near the money",
    tradeNote:
      "Only take this trade if price, volume, RSI, EMA, and news confirm together.",
  };

  const recommendedContract = {
    bestPlay: tradeScore.finalPlay,

    contractType:
      tradeScore.finalPlay === "PUTS" ? "Put Contract" : "Call Contract",

    expiration: "14-30 DTE",

    strikeIdea:
      tradeScore.finalPlay === "PUTS"
        ? "Near-the-money or slightly out-the-money put"
        : "Near-the-money or slightly out-the-money call",

    riskLevel: "Medium",

    maxRisk: "Only risk 1-2% of account",

    target:
      tradeScore.finalPlay === "PUTS"
        ? "Profit as stock moves lower"
        : "Profit as stock moves higher",

    reason:
      tradeScore.finalPlay === "PUTS"
        ? "Scanner is bearish. Favor put contracts only if price confirms downside with volume and support breakdown."
        : "Scanner is bullish. Favor call contracts only if price confirms upside with volume and resistance breakout.",
  };

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">Stock Scanner</h1>

        <p className="text-gray-400 mb-8">
          Confirm a stock with chart, volume, RSI, EMA, news catalyst, and
          options strategy.
        </p>

        <div className="flex gap-4 mb-8">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800"
          />

          <button
            onClick={() => scanStock(ticker)}
            className="bg-green-500 hover:bg-green-600 text-black font-bold px-6 rounded-xl"
          >
            {loading ? "Scanning..." : "Scan"}
          </button>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <h2 className="text-3xl font-bold mb-6">{ticker}</h2>

          <div className="mb-8 bg-black border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-2xl font-bold mb-4">OptionPilot Trade Score</h3>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-zinc-400">Best Play</p>
                <p
                  className={`text-4xl font-bold ${
                    tradeScore.finalPlay === "CALLS"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {tradeScore.finalPlay}
                </p>
              </div>

              <div>
                <p className="text-zinc-400">Confidence</p>
                <p className="text-4xl font-bold">{tradeScore.score}/100</p>
              </div>

              <div>
                <p className="text-zinc-400">Setup Quality</p>
                <p
                  className={`text-4xl font-bold ${
                    tradeScore.setupQuality === "Elite" ||
                    tradeScore.setupQuality === "Strong"
                      ? "text-green-400"
                      : tradeScore.setupQuality === "Good"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {tradeScore.setupQuality}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-3 mt-6 text-sm">
              <div className="bg-zinc-900 p-3 rounded-lg">
                Trend: {tradeScore.trendPoints}/20
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg">
                RSI: {tradeScore.rsiPoints}/20
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg">
                EMA: {tradeScore.emaPoints}/20
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg">
                Volume: {tradeScore.volumePoints}/20
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg">
                News: {tradeScore.newsPoints}/20
              </div>
            </div>
          </div>

          {stock && (
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div>
                <p className="text-gray-400">Current Price</p>
                <p className="text-xl">${stock.price}</p>
              </div>

              <div>
                <p className="text-gray-400">Change</p>
                <p
                  className={
                    stock.change >= 0
                      ? "text-xl text-green-400"
                      : "text-xl text-red-400"
                  }
                >
                  {stock.change} ({stock.percentChange}%)
                </p>
              </div>

              <div>
                <p className="text-gray-400">Previous Close</p>
                <p className="text-xl">${stock.previousClose}</p>
              </div>

              <div>
                <p className="text-gray-400">Open</p>
                <p className="text-xl">${stock.open}</p>
              </div>

              <div>
                <p className="text-gray-400">High</p>
                <p className="text-xl">${stock.high}</p>
              </div>

              <div>
                <p className="text-gray-400">Low</p>
                <p className="text-xl">${stock.low}</p>
              </div>
            </div>
          )}

          {displayCandles.length > 0 && (
            <>
              <TradingViewChart symbol={ticker} />

              <div className="mb-8 border border-zinc-800 rounded-2xl p-4 bg-black">
                <h3 className="text-2xl font-bold mb-4">Price Chart</h3>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayCandles}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis domain={["auto", "auto"]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <h3 className="text-2xl font-bold mt-8 mb-4">Volume</h3>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayCandles}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis
                        tickFormatter={(value) =>
                          `${(Number(value) / 1000000).toFixed(1)}M`
                        }
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${(Number(value) / 1000000).toFixed(2)}M`,
                          "Volume",
                        ]}
                      />
                      <Bar
                        dataKey="volume"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400">Trend</p>
              <p className="text-xl capitalize">{trend}</p>
            </div>

            <div>
              <p className="text-gray-400">Trend Signal</p>
              <p className="text-xl">{finalAnalysis.trendSignal}</p>
            </div>

            <div>
              <p className="text-gray-400">RSI 14</p>
              <p className="text-xl">{finalAnalysis.rsi}</p>
            </div>

            <div>
              <p className="text-gray-400">RSI Signal</p>
              <p className="text-xl">{finalAnalysis.rsiSignal}</p>
            </div>

            <div>
              <p className="text-gray-400">EMA 20</p>
              <p className="text-xl">${finalAnalysis.ema20}</p>
            </div>

            <div>
              <p className="text-gray-400">EMA 50</p>
              <p className="text-xl">${finalAnalysis.ema50}</p>
            </div>

            <div>
              <p className="text-gray-400">Momentum</p>
              <p className="text-xl">{finalAnalysis.momentum}</p>
            </div>

            <div>
              <p className="text-gray-400">Momentum Score</p>
              <p className="text-xl">{finalAnalysis.momentumScore}/100</p>
            </div>

            <div>
              <p className="text-gray-400">Relative Volume</p>
              <p className="text-xl">{finalAnalysis.volumeRatio}x</p>
            </div>

            <div>
              <p className="text-gray-400">Support</p>
              <p className="text-xl">${finalAnalysis.support}</p>
            </div>

            <div>
              <p className="text-gray-400">Resistance</p>
              <p className="text-xl">${finalAnalysis.resistance}</p>
            </div>

            <div>
              <p className="text-gray-400">Candle Pattern</p>
              <p className="text-xl">{finalAnalysis.candlePattern}</p>
            </div>

            <div>
              <p className="text-gray-400">Breakout</p>
              <p className="text-xl">{finalAnalysis.breakout}</p>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-8">
            <h3 className="text-2xl font-bold mb-4">News Catalyst</h3>

            {news?.topCatalyst ? (
              <div className="bg-black border border-zinc-800 rounded-xl p-5">
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className="bg-zinc-800 px-3 py-1 rounded-full text-sm">
                    {news.topCatalyst.catalystType}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      news.topCatalyst.bias === "Bullish"
                        ? "bg-green-900 text-green-300"
                        : news.topCatalyst.bias === "Bearish"
                          ? "bg-red-900 text-red-300"
                          : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {news.topCatalyst.bias}
                  </span>

                  <span className="bg-zinc-800 px-3 py-1 rounded-full text-sm">
                    Score {news.topCatalyst.catalystScore}/100
                  </span>
                </div>

                <h4 className="text-xl font-bold">
                  {news.topCatalyst.headline}
                </h4>

                <p className="text-gray-400 mt-2">{news.topCatalyst.summary}</p>

                <p className="text-green-400 mt-4 font-bold">
                  Options Impact: {getOptionsImpact(news)}
                </p>

                <p className="text-zinc-500 mt-2 text-sm">
                  Source: {news.topCatalyst.source}
                </p>
              </div>
            ) : (
              <p className="text-zinc-400">No major news catalyst found.</p>
            )}

            {news?.news && news.news.length > 1 && (
              <div className="mt-5 space-y-3">
                <h4 className="font-bold text-lg">Recent News</h4>

                {news.news.slice(1, 4).map((item, index) => (
                  <div
                    key={`${item.headline}-${index}`}
                    className="border border-zinc-800 rounded-xl p-4 bg-black"
                  >
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">
                        {item.catalystType}
                      </span>

                      <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">
                        {item.bias}
                      </span>

                      <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">
                        {item.catalystScore}/100
                      </span>
                    </div>

                    <p className="font-semibold">{item.headline}</p>

                    <p className="text-zinc-500 text-sm mt-1">{item.source}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-8">
            <h3 className="text-2xl font-bold mb-2">Best Strategy</h3>

            <p className="text-green-400 text-3xl font-bold">
              {result.strategy}
            </p>

            <p className="mt-4 text-gray-300">{result.reason}</p>

            <p className="mt-4 text-xl">Score: {result.score}</p>

            <Link
              href={`/strategies/${strategySlug}`}
              className="inline-block mt-6 bg-green-500 hover:bg-green-600 text-black font-bold px-5 py-3 rounded-xl"
            >
              View Strategy Details
            </Link>
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-8">
            <h3 className="text-2xl font-bold mb-6">Recommended Contract</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-zinc-800 rounded-xl p-4 bg-black">
                <p className="text-gray-400">Contract Type</p>
                <p
                  className={`text-2xl font-bold ${
                    recommendedContract.bestPlay === "CALLS"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {recommendedContract.contractType}
                </p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 bg-black">
                <p className="text-gray-400">Expiration</p>
                <p className="text-2xl">{recommendedContract.expiration}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 bg-black">
                <p className="text-gray-400">Strike Idea</p>
                <p className="text-xl">{recommendedContract.strikeIdea}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 bg-black">
                <p className="text-gray-400">Risk Level</p>
                <p className="text-xl">{recommendedContract.riskLevel}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 bg-black">
                <p className="text-gray-400">Max Risk</p>
                <p className="text-xl">{recommendedContract.maxRisk}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 bg-black">
                <p className="text-gray-400">Target</p>
                <p className="text-xl">{recommendedContract.target}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 bg-black md:col-span-2">
                <p className="text-gray-400">Reason</p>
                <p className="text-xl">{recommendedContract.reason}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-8">
            <h3 className="text-2xl font-bold mb-6">Trade Setup Generator</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-400">Entry</p>
                <p className="text-xl">{tradeSetup.entry}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-400">Stop Loss</p>
                <p className="text-xl">{tradeSetup.stopLoss}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-400">Target</p>
                <p className="text-xl">{tradeSetup.target}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-400">Contract Type</p>
                <p className="text-xl">{tradeSetup.contractType}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-400">Expiration</p>
                <p className="text-xl">{tradeSetup.expiration}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-400">Risk Plan</p>
                <p className="text-xl">{tradeSetup.riskPlan}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 md:col-span-2">
                <p className="text-gray-400">Contract Idea</p>
                <p className="text-xl">{tradeSetup.contractIdea}</p>
              </div>

              <div className="border border-zinc-800 rounded-xl p-4 md:col-span-2 bg-black">
                <p className="text-gray-400">Trade Note</p>
                <p className="text-xl">{tradeSetup.tradeNote}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

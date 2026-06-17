"use client";

import { useState } from "react";

export default function DashboardPage() {
  const [ticker, setTicker] = useState("");
  const [trend, setTrend] = useState("bullish");
  const [volatility, setVolatility] = useState("medium");
  const [premium, setPremium] = useState("normal");
  const [volume, setVolume] = useState("normal");
  const [risk, setRisk] = useState("medium");
  const [iv, setIv] = useState("normal");
  const [dte, setDte] = useState("14-30");
  const [earnings, setEarnings] = useState("no");
  const [style, setStyle] = useState("swing");
  const [confidence, setConfidence] = useState("medium");

  function getStrategy() {
    if (earnings === "yes" && iv === "high" && trend === "volatile") {
      return {
        strategy: "Long Straddle",
        score: "82/100",
        riskLevel: "High",
        reason:
          "Earnings can create a big move, but direction is uncertain. A long straddle benefits from a strong move either way.",
        skip: "Skip if the options premium is extremely expensive or the expected move is too small.",
      };
    }

    if (trend === "bullish" && confidence === "strong" && premium === "cheap") {
      return {
        strategy: "Long Call",
        score: "88/100",
        riskLevel: "Medium",
        reason:
          "Strong bullish confidence with cheaper premium favors buying calls for directional upside.",
        skip: "Skip if the stock is still below resistance or volume is weak.",
      };
    }

    if (trend === "bullish" && premium === "expensive") {
      return {
        strategy: "Bull Call Spread",
        score: "91/100",
        riskLevel: "Defined",
        reason:
          "Bullish setup with expensive premiums favors a bull call spread because it lowers cost and defines risk.",
        skip: "Skip if the stock is choppy or too close to major resistance.",
      };
    }

    if (trend === "bearish" && premium === "expensive") {
      return {
        strategy: "Bear Put Spread",
        score: "89/100",
        riskLevel: "Defined",
        reason:
          "Bearish setup with expensive premiums favors a bear put spread to reduce cost and control downside risk.",
        skip: "Skip if the stock is holding support or showing reversal strength.",
      };
    }

    if (
      trend === "bearish" &&
      confidence === "strong" &&
      premium !== "expensive"
    ) {
      return {
        strategy: "Long Put",
        score: "85/100",
        riskLevel: "Medium",
        reason:
          "Strong bearish confidence with reasonable premium favors buying puts for downside movement.",
        skip: "Skip if the stock is bouncing from support or market strength is improving.",
      };
    }

    if (trend === "sideways" && iv === "high") {
      return {
        strategy: "Iron Condor",
        score: "87/100",
        riskLevel: "Defined",
        reason:
          "Sideways price action with high implied volatility favors collecting premium with a defined-risk range strategy.",
        skip: "Skip if earnings are near or price is close to breaking out of the range.",
      };
    }

    if (trend === "sideways" && iv === "low") {
      return {
        strategy: "Calendar Spread",
        score: "78/100",
        riskLevel: "Defined",
        reason:
          "Sideways movement with lower IV can favor a calendar spread because it benefits from time decay and controlled movement.",
        skip: "Skip if the stock is starting to trend strongly.",
      };
    }

    if (trend === "volatile" && iv !== "high") {
      return {
        strategy: "Long Strangle",
        score: "80/100",
        riskLevel: "High",
        reason:
          "A big move is expected and IV is not extremely high, so a long strangle may offer cheaper exposure than a straddle.",
        skip: "Skip if premiums are too expensive or the stock has no clear catalyst.",
      };
    }

    if (risk === "low") {
      return {
        strategy: "Debit Spread",
        score: "76/100",
        riskLevel: "Lower",
        reason:
          "Your risk preference is low, so a defined-risk debit spread is safer than buying naked calls or puts.",
        skip: "Skip if the reward is too small compared to the risk.",
      };
    }

    return {
      strategy: "No Trade",
      score: "45/100",
      riskLevel: "Avoid",
      reason:
        "The setup is not clean enough yet. The app needs a stronger trend, better volume, or better premium setup.",
      skip: "Wait for a clearer breakout, breakdown, strong volume, or better risk/reward.",
    };
  }

  const result = getStrategy();

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <section className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          OptionPilot Dashboard
        </h1>

        <p className="text-gray-400 mb-10">
          Pick the market conditions and let the strategy engine suggest the
          best options setup.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div>
            <label className="block mb-2 text-gray-400">Stock Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-white"
            />
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Market Trend</label>
            <select
              value={trend}
              onChange={(e) => setTrend(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="sideways">Sideways</option>
              <option value="volatile">Big Move Expected</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Volatility</label>
            <select
              value={volatility}
              onChange={(e) => setVolatility(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">
              Implied Volatility
            </label>
            <select
              value={iv}
              onChange={(e) => setIv(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="low">Low IV</option>
              <option value="normal">Normal IV</option>
              <option value="high">High IV</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Premium Cost</label>
            <select
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="cheap">Cheap</option>
              <option value="normal">Normal</option>
              <option value="expensive">Expensive</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Volume Strength</label>
            <select
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="weak">Weak</option>
              <option value="normal">Normal</option>
              <option value="strong">Strong</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">
              Days to Expiration
            </label>
            <select
              value={dte}
              onChange={(e) => setDte(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="0">0DTE</option>
              <option value="1-7">1-7 DTE</option>
              <option value="14-30">14-30 DTE</option>
              <option value="30-plus">30+ DTE</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Earnings Event</label>
            <select
              value={earnings}
              onChange={(e) => setEarnings(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="no">No Earnings Soon</option>
              <option value="yes">Earnings Soon</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Trade Style</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="scalp">Scalp</option>
              <option value="day">Day Trade</option>
              <option value="swing">Swing Trade</option>
              <option value="earnings">Earnings Play</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">
              Direction Confidence
            </label>
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="weak">Weak</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-gray-400">Risk Preference</label>
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4"
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-2xl p-8 bg-zinc-900">
          <p className="text-gray-400 mb-2">
            {ticker ? `${ticker} Strategy Result` : "Strategy Result"}
          </p>

          <h2 className="text-3xl font-bold mb-4">Best Strategy</h2>

          <p className="text-3xl text-green-400 mb-3">{result.strategy}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border border-zinc-800 rounded-xl p-4">
              <p className="text-gray-400">Trade Score</p>
              <p className="text-xl font-bold">{result.score}</p>
            </div>

            <div className="border border-zinc-800 rounded-xl p-4">
              <p className="text-gray-400">Risk Level</p>
              <p className="text-xl font-bold">{result.riskLevel}</p>
            </div>
          </div>

          <p className="text-gray-300 mb-4">{result.reason}</p>

          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-gray-400 mb-1">When to skip</p>
            <p className="text-gray-300">{result.skip}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

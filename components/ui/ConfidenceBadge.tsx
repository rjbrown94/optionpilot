"use client";

type ConfidenceBadgeProps = {
  score: number;
  showLabel?: boolean;
  className?: string;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getLabel(score: number): string {
  if (score >= 90) return "Institutional";
  if (score >= 80) return "Very Strong";
  if (score >= 70) return "Strong";
  if (score >= 60) return "Watch";
  return "Low";
}

function getClasses(score: number): string {
  if (score >= 90) {
    return "border-emerald-400 bg-emerald-500 text-black";
  }

  if (score >= 80) {
    return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
  }

  if (score >= 70) {
    return "border-yellow-700 bg-yellow-950/50 text-yellow-300";
  }

  if (score >= 60) {
    return "border-orange-700 bg-orange-950/50 text-orange-300";
  }

  return "border-red-700 bg-red-950/50 text-red-300";
}

export default function ConfidenceBadge({
  score,
  showLabel = true,
  className = "",
}: ConfidenceBadgeProps) {
  const cleanScore = clampScore(score);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${getClasses(
        cleanScore,
      )} ${className}`}
    >
      <span>{cleanScore}</span>
      {showLabel && <span>{getLabel(cleanScore)}</span>}
    </span>
  );
}

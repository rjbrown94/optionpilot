import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "bullish" | "bearish" | "neutral" | "warning";
  className?: string;
}

export default function Badge({
  children,
  tone = "neutral",
  className = "",
}: BadgeProps) {
  const styles = {
    bullish: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    bearish: "bg-red-500/10 text-red-400 border-red-500/30",
    neutral: "bg-zinc-800 text-zinc-300 border-zinc-700",
    warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold
        ${styles[tone]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

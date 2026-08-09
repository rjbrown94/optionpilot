"use client";

type LoadingSkeletonProps = {
  cards?: number;
  className?: string;
};

export default function LoadingSkeleton({
  cards = 6,
  className = "",
}: LoadingSkeletonProps) {
  return (
    <div
      className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${className}`}
      aria-label="Loading"
    >
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="mt-4 h-8 w-36 rounded bg-zinc-800" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-16 rounded-xl bg-black" />
            <div className="h-16 rounded-xl bg-black" />
            <div className="h-16 rounded-xl bg-black" />
            <div className="h-16 rounded-xl bg-black" />
          </div>
          <div className="mt-5 h-10 rounded-xl bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

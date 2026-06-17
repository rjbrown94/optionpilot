import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-black">
      <div className="max-w-7xl mx-auto px-6 py-4 flex gap-8 text-white font-semibold">
        <Link href="/" className="text-white hover:text-green-400 transition">
          Home
        </Link>

        <Link
          href="/options"
          className="text-green-400 hover:text-green-300 transition"
        >
          Options
        </Link>

        <Link
          href="/market-discovery"
          className="text-white hover:text-green-400 transition"
        >
          Discover
        </Link>

        <Link
          href="/news-catalyst"
          className="text-white hover:text-green-400 transition"
        >
          News
        </Link>

        <Link
          href="/auto-scanner"
          className="text-white hover:text-green-400 transition"
        >
          Auto Scanner
        </Link>

        <Link
          href="/scanner"
          className="text-white hover:text-green-400 transition"
        >
          Scanner
        </Link>

        <Link
          href="/options-flow"
          className="text-white hover:text-green-400 transition"
        >
          Options Flow
        </Link>

        <Link
          href="/watchlist"
          className="text-white hover:text-green-400 transition"
        >
          Watchlist
        </Link>

        <Link
          href="/strategies"
          className="text-white hover:text-green-400 transition"
        >
          Strategies
        </Link>
      </div>
    </nav>
  );
}

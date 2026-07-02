"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/options", label: "Options" },
    { href: "/news-catalyst", label: "News" },
    { href: "/auto-scanner", label: "Auto Scanner" },
    { href: "/scanner", label: "Scanner" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/strategies", label: "Strategies" },
  ];

  return (
    <nav className="border-b border-zinc-800 bg-black">
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-4 font-semibold text-white">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`transition ${
                isActive ? "text-green-400" : "text-white hover:text-green-400"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

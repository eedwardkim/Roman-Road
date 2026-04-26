"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const linkStyle = (href: string) => ({
    color: pathname === href ? "var(--color-accent)" : "var(--color-text-secondary)",
  });

  return (
    <nav className="border-b relative z-50" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--background)" }}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:opacity-70 cursor-pointer"
            style={{ color: "var(--color-text-primary)" }}
          >
            Bi-grammar
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-xs font-normal transition-colors hover:opacity-70 cursor-pointer"
              style={linkStyle("/")}
            >
              Typing Test
            </Link>
            <Link
              href="/free-flow"
              className="text-xs font-normal transition-colors hover:opacity-70 cursor-pointer"
              style={linkStyle("/free-flow")}
            >
              Free Flow
            </Link>
            <Link
              href="/profile"
              className="text-xs font-normal transition-colors hover:opacity-70 cursor-pointer"
              style={linkStyle("/profile")}
            >
              Profile
            </Link>
            <Link
              href="/heatmap"
              className="text-xs font-normal transition-colors hover:opacity-70 cursor-pointer"
              style={linkStyle("/heatmap")}
            >
              Heatmap
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

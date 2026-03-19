"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile } from "@/lib/store";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface AppHeaderProps {
  children?: ReactNode;
  /** Optional centered title (e.g. "Anniversary card for Alyssa West") */
  title?: ReactNode;
  /** Hide the account dropdown (e.g. on onboarding before profile exists) */
  hideAccount?: boolean;
}

export default function AppHeader({ children, title, hideAccount }: AppHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = getUserProfile();
    if (p?.display_name) setDisplayName(p.display_name);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header
      className="no-print sticky top-0 z-30 border-b px-6 py-3"
      style={{ background: "var(--color-white)", borderColor: "var(--color-light-gray)" }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Top row: logo + account */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-xl font-semibold"
            style={{ color: "var(--color-brand)", fontFamily: "var(--font-heading)" }}
          >
            Nuuge
          </button>

          {!hideAccount && displayName && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 transition-colors"
                style={{ border: "1.5px solid var(--color-sage-light)" }}
              >
                <span className="text-sm font-medium text-charcoal">
                  {displayName.split(" ")[0]}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: "var(--color-brand-light)", color: "var(--color-brand)" }}
                >
                  {getInitials(displayName)}
                </div>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-50"
                  style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); router.push("/"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Home
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    My profile
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); router.push("/backup"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Backup data
                  </button>
                  <div style={{ borderTop: "1px solid var(--color-light-gray)", margin: "0.25rem 0" }} />
                  <button
                    onClick={() => { setMenuOpen(false); router.push("/reset"); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-faint-gray transition-colors flex items-center gap-2"
                    style={{ color: "var(--color-error)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    Reset data
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Centered title (e.g. "Anniversary card for Alyssa West") */}
        {title && (
          <div className="mt-3 pt-2 flex justify-center">
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-heading)" }}>
              {title}
            </h1>
          </div>
        )}
        {/* Sub-bar: page-specific content passed as children */}
        {children && (
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-sm ${title ? "mt-2 pt-2" : "mt-3 pt-3"}`}
            style={{ borderTop: "1px solid var(--color-light-gray)" }}
          >
            {children}
          </div>
        )}
      </div>
    </header>
  );
}

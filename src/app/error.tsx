"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Nuuge caught error:", error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center"
      style={{ background: "var(--color-cream)" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
        style={{ background: "var(--color-error-light)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2
        className="text-xl font-semibold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
      >
        Something went wrong
      </h2>
      <p className="text-warm-gray mb-6 max-w-md text-sm leading-relaxed">
        An unexpected error occurred. Your data is safe — this is just a display issue.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2 rounded-full text-sm font-medium transition-colors"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          Try again
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="btn-primary px-5 py-2 rounded-full text-sm"
        >
          Circle of People
        </button>
      </div>
    </div>
  );
}

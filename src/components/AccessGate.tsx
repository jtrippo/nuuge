"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "nuuge_access_verified";

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "locked" | "open">("loading");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Public routes bypass the gate (e.g. shared e-cards)
      if (window.location.pathname.startsWith("/share/")) {
        setStatus("open");
        return;
      }
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setStatus("open");
      } else {
        setStatus("locked");
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      const res = await fetch("/api/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem(STORAGE_KEY, "1");
        setStatus("open");
      } else {
        setError("Invalid access code. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  if (status === "loading") {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--color-cream)" }}
      >
        <div className="animate-pulse text-warm-gray font-body">Loading...</div>
      </div>
    );
  }

  if (status === "open") {
    return <>{children}</>;
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen px-6"
      style={{ background: "var(--color-cream)" }}
    >
      <div className="w-full max-w-sm text-center">
        <h1
          className="text-3xl font-semibold mb-2"
          style={{ color: "var(--color-brand)", fontFamily: "var(--font-heading)" }}
        >
          Nuuge
        </h1>
        <p className="text-warm-gray mb-8 text-sm">
          Enter the access code to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            className="w-full input-field rounded-xl px-4 py-3 text-center text-lg tracking-widest"
          />
          {error && (
            <p className="text-sm" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!code.trim() || checking}
            className="w-full btn-primary py-3 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {checking ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

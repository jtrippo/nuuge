"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getRecipients } from "@/lib/store";
import type { Recipient } from "@/types/database";

function ChooseRecipientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const occasion = searchParams.get("occasion") ?? undefined;
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  useEffect(() => {
    setRecipients(getRecipients());
  }, []);

  const createUrl = (id: string) => {
    const base = `/cards/create/${id}`;
    if (occasion) return `${base}?occasion=${encodeURIComponent(occasion)}`;
    return base;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <header className="sticky top-0 z-20 px-6 py-4 border-b bg-white/95 backdrop-blur" style={{ borderColor: "var(--color-light-gray)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-warm-gray hover:text-charcoal text-sm font-medium">
            ← Circle of People
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-charcoal mb-1" style={{ fontFamily: "var(--font-heading)" }}>
          Who is this card for?
        </h1>
        <p className="text-warm-gray mb-6">
          {occasion ? `Pick someone to create a ${occasion} card for.` : "Choose a person in your circle, or add someone new."}
        </p>

        {recipients.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl" style={{ borderColor: "var(--color-light-gray)" }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--color-brand-light)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <p className="text-warm-gray mb-2">No one in your circle yet.</p>
            <p className="text-warm-gray text-sm mb-6">Add someone so you can create a card for them.</p>
            <Link href="/recipients/new" className="btn-primary inline-block">
              Add someone to my circle
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-light-gray)", background: "var(--color-white)" }}>
              {recipients.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => router.push(createUrl(r.id))}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:opacity-90 transition-opacity"
                    style={{ background: "var(--color-white)" }}
                  >
                    <span className="font-medium text-charcoal">{r.name}</span>
                    <span className="text-warm-gray text-sm capitalize">({r.relationship_type})</span>
                    <span className="text-sm font-medium shrink-0" style={{ color: "var(--color-brand)" }}>
                      Create card →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center">
              <Link href="/recipients/new" className="text-sm font-medium hover:opacity-80" style={{ color: "var(--color-brand)" }}>
                Someone not in my circle? Add them first →
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default function ChooseRecipientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-cream)" }}>Loading…</div>}>
      <ChooseRecipientContent />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import TraitPickerWheel from "@/components/TraitPickerWheel";
import { AGE_BAND_LABELS, type AgeBand } from "@/lib/occasions";

const QUICK_SESSION_KEY = "nuuge_quick_recipient";

const PERSONALITY_TRAITS = [
  "Warm", "Outgoing", "Introverted", "Adventurous", "Creative",
  "Analytical", "Empathetic", "Funny", "Sarcastic", "Laid-back",
  "Energetic", "Thoughtful", "Practical", "Spontaneous", "Organized",
  "Sensitive", "Independent", "Loyal", "Optimistic", "Curious",
  "Generous", "Patient", "Ambitious", "Gentle", "Bold",
];

export interface QuickRecipientData {
  name: string;
  relationship: string;
  traits: string[];
  ageBand?: AgeBand | null;
}

export function saveQuickRecipient(data: QuickRecipientData) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(QUICK_SESSION_KEY, JSON.stringify(data));
  }
}

export function loadQuickRecipient(): QuickRecipientData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(QUICK_SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearQuickRecipient() {
  if (typeof window !== "undefined") sessionStorage.removeItem(QUICK_SESSION_KEY);
}

export default function QuickProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);

  function toggleTrait(trait: string) {
    setTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  }

  function addCustomTrait() {
    const t = customTrait.trim();
    if (!t) return;
    const match = PERSONALITY_TRAITS.find((p) => p.toLowerCase() === t.toLowerCase());
    if (match) {
      if (!traits.includes(match)) toggleTrait(match);
    } else if (!traits.includes(t)) {
      setTraits((prev) => [...prev, t]);
    }
    setCustomTrait("");
  }

  function handleNext() {
    saveQuickRecipient({ name: name.trim(), relationship: relationship.trim(), traits, ageBand });
    const reuseCardId = searchParams.get("reuseCardId");
    router.push(`/cards/create/__quick__${reuseCardId ? `?reuseCardId=${reuseCardId}` : ""}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader>
        <button
          onClick={() => router.push("/cards/create/choose")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </AppHeader>

      <main className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-charcoal mb-2" style={{ fontFamily: "var(--font-heading)" }}>
          Quick card
        </h1>
        <p className="text-warm-gray mb-8">
          Tell us a little about who this card is for — just enough to make it personal.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Their name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Martinez"
              className="input-field rounded-xl w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Who are they to you?</label>
            <input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g. our vet, my neighbor, a former teacher"
              className="input-field rounded-xl w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Approximate age (optional)</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(AGE_BAND_LABELS) as [AgeBand, string][]).map(([band, label]) => (
                <button
                  key={band}
                  onClick={() => setAgeBand(ageBand === band ? null : band)}
                  className="text-sm px-3 py-1.5 rounded-full font-medium transition-all"
                  style={ageBand === band ? {
                    background: "var(--color-brand-light)",
                    border: "1.5px solid var(--color-brand)",
                    color: "var(--color-brand)",
                  } : {
                    background: "var(--color-faint-gray)",
                    border: "1.5px solid var(--color-light-gray)",
                    color: "var(--color-warm-gray)",
                  }}
                >
                  {ageBand === band ? "✓ " : ""}{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              How would you describe them?
            </label>
            <TraitPickerWheel
              items={PERSONALITY_TRAITS}
              selected={traits}
              onToggle={toggleTrait}
              scrollToSelectedWhenSingle
            />
            <div className="flex gap-2 mt-4">
              <input
                value={customTrait}
                onChange={(e) => setCustomTrait(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTrait()}
                placeholder="Add your own..."
                className="input-field flex-1"
              />
              <button
                onClick={addCustomTrait}
                disabled={!customTrait.trim()}
                className="text-sm font-medium px-3 disabled:text-warm-gray"
                style={{ color: "var(--color-brand)" }}
              >
                Add
              </button>
            </div>
            {traits.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {traits.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTrait(t)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                    style={{ background: "var(--color-brand)", color: "#fff" }}
                  >
                    {t} &times;
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={!name.trim()}
            className="btn-primary mt-4 disabled:opacity-40"
          >
            Next: Choose an occasion
          </button>
        </div>
      </main>
    </div>
  );
}

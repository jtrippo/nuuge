"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getUserProfile, getRecipients, getCardsForRecipient, getCards } from "@/lib/store";
import type { UserProfile, Recipient, Card } from "@/types/database";
import { getUsageStats, type UsageStats } from "@/lib/usage-store";
import { HOLIDAYS_2026 } from "@/lib/holidays-2026";

const DRAFT_KEY_PREFIX = "nuuge_card_draft_";

interface DraftSummary {
  key: string;
  recipientId: string;
  recipientName: string;
  occasion: string;
  occasionCustom: string;
  step: string;
  updatedAt: number;
}

function getAllDrafts(recipients: Recipient[]): DraftSummary[] {
  if (typeof window === "undefined") return [];
  const drafts: DraftSummary[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = JSON.parse(raw);
      const r = recipients.find((rec) => rec.id === d.recipientId);
      drafts.push({
        key,
        recipientId: d.recipientId,
        recipientName: r?.name ?? "Unknown",
        occasion: d.occasion ?? "",
        occasionCustom: d.occasionCustom ?? "",
        step: d.step ?? "",
        updatedAt: d.updatedAt ?? 0,
      });
    } catch { /* ignore corrupt entries */ }
  }
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}

function cleanupStaleDrafts(recipients: Recipient[], allCards: Card[]): number {
  if (typeof window === "undefined") return 0;
  let removed = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = JSON.parse(raw);
      const draftUpdated = d.updatedAt ?? 0;
      const recipientCards = allCards.filter(
        (c) => c.recipient_id === d.recipientId || (c.recipient_ids && c.recipient_ids.includes(d.recipientId))
      );
      const hasNewerCard = recipientCards.some((c) => new Date(c.created_at).getTime() > draftUpdated);
      if (hasNewerCard) {
        localStorage.removeItem(key);
        removed++;
      }
    } catch { /* ignore */ }
  }
  return removed;
}

function getUpcomingDates(recipients: Recipient[]) {
  const today = new Date();
  const currentYear = today.getFullYear();

  const upcoming: { recipientName: string; recipientId: string; label: string; date: Date; daysAway: number }[] = [];

  for (const r of recipients) {
    for (const d of r.important_dates || []) {
      if (!d.recurring) continue;
      const parts = d.date.split("-");
      let month: number, day: number;

      if (parts.length === 3) {
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
      }

      if (isNaN(month) || isNaN(day)) continue;

      let nextOccurrence = new Date(currentYear, month, day);
      if (nextOccurrence < today) {
        nextOccurrence = new Date(currentYear + 1, month, day);
      }

      const daysAway = Math.ceil(
        (nextOccurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysAway >= 0 && daysAway <= 30) {
        upcoming.push({
          recipientName: r.name,
          recipientId: r.id,
          label: d.label,
          date: nextOccurrence,
          daysAway,
        });
      }
    }
  }

  return upcoming.sort((a, b) => a.daysAway - b.daysAway);
}

/** Holidays from the 2026 list that fall in the next 30 days. */
function getUpcomingHolidays(): { id: string; label: string; daysAway: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { id: string; label: string; daysAway: number }[] = [];
  for (const h of HOLIDAYS_2026) {
    const [y, m, d] = h.date.split("-").map(Number);
    const holidayDate = new Date(y, m - 1, d);
    const daysAway = Math.ceil(
      (holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysAway >= 0 && daysAway <= 30) {
      out.push({ id: h.id, label: h.label, daysAway });
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}

/** Next event per recipient regardless of time frame (soonest upcoming date). */
function getNextEventPerRecipient(recipients: Recipient[]): Map<string, { label: string; daysAway: number }> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const map = new Map<string, { label: string; daysAway: number }>();

  for (const r of recipients) {
    let best: { label: string; daysAway: number } | null = null;
    for (const d of r.important_dates || []) {
      if (!d.recurring) continue;
      const parts = d.date.split("-");
      let month: number, day: number;
      if (parts.length === 3) {
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
      }
      if (isNaN(month) || isNaN(day)) continue;
      let nextOccurrence = new Date(currentYear, month, day);
      if (nextOccurrence < today) nextOccurrence = new Date(currentYear + 1, month, day);
      const daysAway = Math.ceil(
        (nextOccurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (best === null || daysAway < best.daysAway) {
        best = { label: d.label, daysAway };
      }
    }
    if (best !== null) map.set(r.id, best);
  }
  return map;
}

function urgencyLabel(days: number) {
  if (days === 0) return { text: "Today!", className: "text-error font-semibold" };
  if (days === 1) return { text: "Tomorrow", className: "text-error font-semibold" };
  if (days <= 7) return { text: `${days} days`, className: "text-amber font-medium" };
  if (days <= 30) return { text: `${days} days`, className: "text-warm-gray font-medium" };
  return { text: `${days} days`, className: "text-warm-gray" };
}

function formatNextEventTime(daysAway: number): string {
  if (daysAway === 0) return "today";
  if (daysAway === 1) return "1 day";
  if (daysAway <= 60) return `${daysAway} days`;
  const months = Math.round(daysAway / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [mounted, setMounted] = useState(false);
  const [previewLanding, setPreviewLanding] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dataBannerDismissed, setDataBannerDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    const p = getUserProfile();
    const r = getRecipients();
    const c = getCards();
    setProfile(p);
    setRecipients(r);

    cleanupStaleDrafts(r, c);
    setDrafts(getAllDrafts(r));

    if (typeof window !== "undefined") {
      if (new URLSearchParams(window.location.search).has("landing")) {
        setPreviewLanding(true);
      }
      if (!localStorage.getItem("nuuge_data_banner_dismissed")) {
        setDataBannerDismissed(false);
      }
    }
  }, []);


  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-cream">
        <div className="animate-pulse text-warm-gray font-body">Loading...</div>
      </div>
    );
  }

  /* ── Smart CTA for landing page based on user state ── */
  const hasProfile = !!profile?.onboarding_complete;
  const hasPeople = recipients.length > 0;

  /* ── Welcome / Landing page ── */
  if (!profile?.onboarding_complete || previewLanding) {
    return (
      <div className="min-h-screen bg-cream">
        {/* Nav */}
        <nav className="px-6 sm:px-10 py-5" style={{ background: "var(--color-white)" }}>
          <div className="flex items-center justify-between max-w-6xl mx-auto">
          <h1
            className="text-2xl font-semibold"
            style={{ color: "var(--color-brand)", fontFamily: "var(--font-heading)" }}
          >
            Nuuge
          </h1>
          {previewLanding && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 transition-colors"
                style={{ border: "1.5px solid var(--color-sage-light)" }}
              >
                <span className="text-sm font-medium text-charcoal">
                  {profile?.display_name?.split(" ")[0] || "Menu"}
                </span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: "var(--color-brand-light)", color: "var(--color-brand)" }}
                >
                  {getInitials(profile?.display_name || "U")}
                </div>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-50"
                  style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); setPreviewLanding(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Circle of People
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setPreviewLanding(false); router.push("/profile"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    My profile
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setPreviewLanding(false); router.push("/backup"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Backup data
                  </button>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      const stats = await getUsageStats();
                      setUsageStats(stats);
                      setShowUsage(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-faint-gray transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    Usage stats
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </nav>

        {/* Hero */}
        <section className="px-6 pt-12 pb-20 animate-fade-in" style={{ background: "var(--color-white)" }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left — copy */}
            <div>
              <h2
                className="text-4xl sm:text-5xl font-semibold leading-tight mb-6"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
              >
                Cards that actually{" "}
                <span className="italic" style={{ color: "var(--color-brand)" }}>sound like you.</span>
              </h2>
              <p className="text-lg text-warm-gray mb-8 leading-relaxed">
                Skip the generic aisle. We help you create deeply personal,
                one-of-a-kind greeting cards that capture exactly what you want
                to say to the people who matter most.
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-3">
                {!hasProfile ? (
                  <button
                    onClick={() => router.push("/onboarding")}
                    className="btn-primary text-lg px-8 py-3.5"
                  >
                    Get started
                  </button>
                ) : !hasPeople ? (
                  <button
                    onClick={() => { setPreviewLanding(false); router.push("/recipients/new"); }}
                    className="btn-primary text-lg px-8 py-3.5"
                  >
                    Add your first friend
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setPreviewLanding(false); router.push("/cards/create/choose"); }}
                      className="btn-primary text-lg px-8 py-3.5"
                    >
                      Create a card
                    </button>
                    <button
                      onClick={() => { setPreviewLanding(false); router.push("/recipients/new"); }}
                      className="btn-secondary text-sm px-5 py-2.5"
                    >
                      + Add a friend
                    </button>
                  </>
                )}
                {!hasProfile && (
                  <p className="text-xs text-warm-gray">
                    No subscription required.<br />Free to try.
                  </p>
                )}
              </div>
            </div>

            {/* Right — illustration + testimonial */}
            <div className="relative flex justify-center">
              {/* Card & envelope illustration */}
              <svg viewBox="0 0 380 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm">
                {/* Soft shadow / surface */}
                <ellipse cx="190" cy="300" rx="150" ry="14" fill="#E8E4DF" opacity="0.5"/>

                {/* Envelope — back */}
                <rect x="40" y="140" width="200" height="140" rx="12" fill="#EDF4EF" stroke="#7B9E87" strokeWidth="1.5"/>
                <path d="M40 152 L140 220 L240 152" stroke="#7B9E87" strokeWidth="1.5" fill="none"/>

                {/* Card 1 — behind, slightly rotated */}
                <g transform="rotate(-6, 260, 160)">
                  <rect x="160" y="40" width="160" height="220" rx="10" fill="white" stroke="#E8E4DF" strokeWidth="1.5"/>
                  <rect x="175" y="56" width="130" height="80" rx="6" fill="#F0F7F2"/>
                  <circle cx="240" cy="96" r="20" fill="#7B9E87" opacity="0.3"/>
                  <path d="M230 96 C234 82, 246 82, 250 96 C246 82, 234 82, 230 96Z" fill="#3A7D5C" opacity="0.5"/>
                  <rect x="185" y="152" width="90" height="6" rx="3" fill="#E8E4DF"/>
                  <rect x="185" y="166" width="110" height="6" rx="3" fill="#E8E4DF"/>
                  <rect x="185" y="180" width="70" height="6" rx="3" fill="#E8E4DF"/>
                </g>

                {/* Card 2 — front, upright */}
                <g transform="rotate(3, 220, 150)">
                  <rect x="150" y="30" width="170" height="235" rx="10" fill="white" stroke="#C4841D" strokeWidth="1.5"/>
                  <rect x="165" y="46" width="140" height="100" rx="8" fill="#FFF8EE"/>
                  {/* Floral accent */}
                  <circle cx="210" cy="80" r="12" fill="#C4841D" opacity="0.25"/>
                  <circle cx="230" cy="90" r="10" fill="#3A7D5C" opacity="0.2"/>
                  <circle cx="250" cy="78" r="8" fill="#C4841D" opacity="0.15"/>
                  <path d="M215 100 Q225 70, 245 95" stroke="#3A7D5C" strokeWidth="1.5" fill="none" opacity="0.4"/>
                  <path d="M225 105 Q235 80, 255 100" stroke="#7B9E87" strokeWidth="1" fill="none" opacity="0.3"/>
                  {/* Text lines */}
                  <rect x="175" y="162" width="100" height="6" rx="3" fill="#E8E4DF"/>
                  <rect x="175" y="178" width="120" height="6" rx="3" fill="#E8E4DF"/>
                  <rect x="175" y="194" width="80" height="6" rx="3" fill="#E8E4DF"/>
                  <rect x="175" y="216" width="60" height="5" rx="2.5" fill="#7B9E87" opacity="0.4"/>
                </g>

                {/* Small heart accent */}
                <path d="M85 120 C85 114, 95 114, 95 120 C95 114, 105 114, 105 120 C105 130, 95 138, 95 138 C95 138, 85 130, 85 120Z" fill="#C4841D" opacity="0.5"/>
                {/* Small star */}
                <path d="M310 60 L313 70 L323 70 L315 76 L318 86 L310 80 L302 86 L305 76 L297 70 L307 70Z" fill="#C4841D" opacity="0.2"/>
              </svg>

              {/* Testimonial bubble */}
              <div
                className="absolute bottom-4 right-0 sm:-right-2 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-md"
                style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--color-error-light)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-error)" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">&ldquo;Made my mom cry!&rdquo;</p>
                  <p className="text-xs text-warm-gray">&mdash; Sarah J.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-20" style={{ background: "var(--color-cream)" }}>
          <div className="max-w-4xl mx-auto">
          <h3
            className="text-2xl sm:text-3xl font-semibold text-center mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            How it works
          </h3>
          <p className="text-center text-warm-gray max-w-lg mx-auto mb-14">
            It&apos;s as simple as telling a friend about someone you care about.
            We handle the rest.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                num: "1",
                title: "Tell us about them",
                desc: "Their quirks, your inside jokes, the vibe you're going for. A quick setup that makes everything personal.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ),
              },
              {
                num: "2",
                title: "We craft the card",
                desc: "No generic templates. Every message, illustration, and layout is uniquely created for your person and occasion.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                ),
              },
              {
                num: "3",
                title: "Send it your way",
                desc: "Send it instantly as an e-card, print it at home on your own paper, or have it professionally mailed.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                ),
              },
            ].map((step) => (
              <div key={step.num} className="card-surface p-6 text-center">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "var(--color-brand-light)" }}
                >
                  {step.icon}
                </div>
                <h4
                  className="text-base font-semibold mb-2"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
                >
                  {step.title}
                </h4>
                <p className="text-sm text-warm-gray leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Storytelling section */}
        <section className="py-20 px-6" style={{ background: "var(--color-white)" }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            {/* Left — illustration of someone reading a card */}
            <div className="flex justify-center">
              <svg viewBox="0 0 360 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs">
                {/* Warm background circle */}
                <circle cx="180" cy="170" r="150" fill="#F8F6F3"/>
                <circle cx="180" cy="170" r="120" fill="#F0F7F2" opacity="0.6"/>

                {/* Open card */}
                <g transform="rotate(-8, 180, 160)">
                  {/* Left page */}
                  <rect x="70" y="80" width="110" height="160" rx="6" fill="white" stroke="#E8E4DF" strokeWidth="1.5"/>
                  {/* Illustration area on left page */}
                  <rect x="82" y="92" width="86" height="60" rx="4" fill="#FFF8EE"/>
                  <circle cx="110" cy="112" r="10" fill="#C4841D" opacity="0.25"/>
                  <circle cx="130" cy="118" r="8" fill="#3A7D5C" opacity="0.2"/>
                  <path d="M105 128 Q115 105, 135 125" stroke="#7B9E87" strokeWidth="1.5" fill="none" opacity="0.4"/>

                  {/* Right page — message */}
                  <rect x="180" y="80" width="110" height="160" rx="6" fill="white" stroke="#E8E4DF" strokeWidth="1.5"/>
                  {/* "Thinking of you" handwriting */}
                  <text x="205" y="120" fill="#7B9E87" fontSize="13" fontFamily="var(--font-handwritten), cursive" fontStyle="italic" opacity="0.8">Thinking</text>
                  <text x="215" y="140" fill="#7B9E87" fontSize="13" fontFamily="var(--font-handwritten), cursive" fontStyle="italic" opacity="0.8">of you</text>
                  {/* Text lines */}
                  <rect x="195" y="160" width="75" height="4" rx="2" fill="#E8E4DF"/>
                  <rect x="195" y="172" width="80" height="4" rx="2" fill="#E8E4DF"/>
                  <rect x="195" y="184" width="55" height="4" rx="2" fill="#E8E4DF"/>
                  <rect x="195" y="200" width="45" height="4" rx="2" fill="#7B9E87" opacity="0.3"/>
                </g>

                {/* Hands holding card */}
                <path d="M100 260 Q90 230, 105 210 Q110 205, 120 210 L130 240 Q125 260, 100 260Z" fill="#E8D5C0" opacity="0.7"/>
                <path d="M260 255 Q270 225, 255 205 Q250 200, 240 205 L230 235 Q235 255, 260 255Z" fill="#E8D5C0" opacity="0.7"/>

                {/* Decorative sparkles */}
                <path d="M300 80 L303 88 L311 88 L305 93 L307 101 L300 96 L293 101 L295 93 L289 88 L297 88Z" fill="#C4841D" opacity="0.3"/>
                <path d="M60 100 L62 106 L68 106 L63 110 L65 116 L60 112 L55 116 L57 110 L52 106 L58 106Z" fill="#3A7D5C" opacity="0.25"/>
                <circle cx="310" cy="200" r="4" fill="#C4841D" opacity="0.2"/>
                <circle cx="50" cy="220" r="3" fill="#7B9E87" opacity="0.3"/>
              </svg>
            </div>

            {/* Right — text and bullet points */}
            <div>
              <h3
                className="text-2xl sm:text-3xl font-semibold mb-5 leading-snug"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
              >
                Because real life isn&apos;t found in aisle&nbsp;4.
              </h3>
              <p className="text-warm-gray mb-8 leading-relaxed">
                Sometimes the perfect card isn&apos;t about finding the most poetic verse.
                It&apos;s about remembering that time you got lost in Chicago, or their
                obsession with terrible coffee. We help you put those real, human
                moments onto paper.
              </p>
              <div className="space-y-4">
                {[
                  "AI-written messages tuned to your voice and relationship",
                  "Original illustrations — watercolor, whimsical, minimal, and more",
                  "Print at home, send digitally, or mail a physical card",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                      <path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9Z" fill="var(--color-amber)" opacity="0.7"/>
                    </svg>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-charcoal)" }}>
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center px-6 py-20" style={{ background: "var(--color-brand-light)" }}>
          <div className="max-w-2xl mx-auto">
          <h3
            className="text-2xl sm:text-3xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
          >
            Ready to make someone&apos;s day?
          </h3>
          <p className="text-warm-gray mb-8 max-w-md mx-auto leading-relaxed">
            Take a couple of minutes to tell us about them, and see what we
            come up with. It&apos;s free to try.
          </p>
          {!hasProfile ? (
            <button
              onClick={() => router.push("/onboarding")}
              className="btn-primary text-lg px-10 py-4"
            >
              Get started
            </button>
          ) : !hasPeople ? (
            <button
              onClick={() => { setPreviewLanding(false); router.push("/recipients/new"); }}
              className="btn-primary text-lg px-10 py-4"
            >
              Add your first friend
            </button>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => { setPreviewLanding(false); router.push("/cards/create/choose"); }}
                className="btn-primary text-lg px-8 py-3.5"
              >
                Create a card
              </button>
              <button
                onClick={() => { setPreviewLanding(false); router.push("/recipients/new"); }}
                className="btn-secondary px-6 py-3"
              >
                + Add a friend
              </button>
            </div>
          )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 text-xs text-warm-gray" style={{ borderTop: "1px solid var(--color-light-gray)" }}>
          Nuuge &middot; Cards that sound like you
        </footer>
      </div>
    );
  }

  /* ── Main Dashboard ── */
  const upcomingDates = getUpcomingDates(recipients);
  const upcomingHolidays = getUpcomingHolidays();
  const nextEventPerRecipient = getNextEventPerRecipient(recipients);
  const recipientsSortedByName = [...recipients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader>
        <button
          onClick={() => setPreviewLanding(true)}
          className="text-warm-gray hover:text-charcoal"
        >
          About Nuuge
        </button>
        <span className="text-warm-gray">·</span>
        <button
          onClick={async () => {
            const stats = await getUsageStats();
            setUsageStats(stats);
            setShowUsage(true);
          }}
          className="text-warm-gray hover:text-charcoal"
        >
          Usage stats
        </button>
      </AppHeader>

      {/* Local data warning banner */}
      {!dataBannerDismissed && (
        <div
          className="w-full px-6 py-3 text-sm flex items-center justify-between gap-4"
          style={{ background: "var(--color-amber-light, #FFF8EE)", borderBottom: "1px solid var(--color-amber, #C4841D)" }}
        >
          <p style={{ color: "var(--color-charcoal)" }}>
            <strong>Heads up:</strong> Your cards and profiles are stored in this browser only. If you clear your browser data, it will be lost.{" "}
            <button
              onClick={() => router.push("/backup")}
              className="underline font-medium"
              style={{ color: "var(--color-brand)" }}
            >
              Back up your data
            </button>
          </p>
          <button
            onClick={() => {
              localStorage.setItem("nuuge_data_banner_dismissed", "1");
              setDataBannerDismissed(true);
            }}
            className="text-warm-gray hover:text-charcoal flex-shrink-0 text-lg leading-none"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Full-width banner — same as home page hero */}
      <section className="px-6 pt-12 pb-20" style={{ background: "var(--color-white)" }}>
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-4xl sm:text-5xl font-semibold leading-tight mb-6"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
          >
            Create something they&apos;ll{" "}
            <span className="italic" style={{ color: "var(--color-brand)" }}>actually keep.</span>
          </h2>
          <p className="text-lg text-warm-gray mb-8 leading-relaxed">
            Pick someone and write a card only you could write — we&apos;ll help with the rest.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {recipients.length === 0 ? (
              <button
                onClick={() => router.push("/recipients/new")}
                className="btn-primary text-lg px-8 py-3.5"
              >
                Add your first friend
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push("/cards/create/choose")}
                  className="btn-primary text-lg px-8 py-3.5"
                >
                  Create a card
                </button>
                <button
                  onClick={() => router.push("/recipients/new")}
                  className="btn-secondary text-base px-6 py-3"
                >
                  Add a friend
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <main>
        {/* Section 1: Coming up — full-width banner, cream (layer 1) */}
        <section className="w-full px-6 py-10" style={{ background: "var(--color-cream)", borderBottom: "1px solid var(--color-sage-light)" }}>
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-semibold text-charcoal mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              Coming up in the next 30 days
            </h3>
            <p className="text-lg text-warm-gray mb-6">
              Personal occasions and holidays. Tap to create a card.
            </p>

            {/* Personal occasions */}
            <p className="section-label mb-2">Personal occasions</p>
            {upcomingDates.length > 0 ? (
              <ul className="divide-y mb-8" style={{ borderColor: "var(--color-light-gray)" }}>
                {upcomingDates.map((event, i) => {
                  const urg = urgencyLabel(event.daysAway);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => router.push(`/cards/create/${event.recipientId}?occasion=${encodeURIComponent(event.label)}`)}
                        className="w-full text-left py-4 flex flex-wrap items-center justify-between gap-2 hover:opacity-80 transition-opacity text-charcoal"
                      >
                        <span className="font-medium">{event.recipientName}</span>
                        <span className="text-warm-gray"> · </span>
                        <span className="text-warm-gray">{event.label}</span>
                        <span className="text-warm-gray"> · </span>
                        <span className={`text-sm ${urg.className}`}>{urg.text}</span>
                        <span
                          className="ml-auto text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                        >
                          Create card →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-lg text-warm-gray py-4 mb-8">
                Nothing in the next 30 days. Add dates to people&apos;s profiles to see occasions here.
              </p>
            )}

            {/* Holidays in the next 30 days */}
            <p className="section-label mb-2">Holidays &amp; celebrations</p>
            {upcomingHolidays.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: "var(--color-light-gray)" }}>
                {upcomingHolidays.map((h) => {
                  const urg = urgencyLabel(h.daysAway);
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/cards/create/choose?occasion=${encodeURIComponent(h.label)}`)}
                        className="w-full text-left py-4 flex flex-wrap items-center justify-between gap-2 hover:opacity-80 transition-opacity text-charcoal"
                      >
                        <span className="font-medium text-charcoal">{h.label}</span>
                        <span className="text-warm-gray"> · </span>
                        <span className={`text-sm ${urg.className}`}>{urg.text}</span>
                        <span
                          className="ml-auto text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                        >
                          Create card →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-lg text-warm-gray py-4">
                No holidays in the next 30 days.
              </p>
            )}
          </div>
        </section>

        {/* In-progress drafts */}
        {drafts.length > 0 && (
          <section className="w-full px-6 py-8" style={{ background: "var(--color-white)", borderTop: "1px solid var(--color-sage-light)" }}>
            <div className="max-w-4xl mx-auto">
              <h3 className="text-2xl sm:text-3xl font-semibold text-charcoal mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                In-progress drafts
              </h3>
              <p className="text-lg text-warm-gray mb-4">
                Cards you started but haven&apos;t finished.
              </p>
              <ul className="divide-y" style={{ borderColor: "var(--color-light-gray)" }}>
                {drafts.map((d) => {
                  const occasion = d.occasionCustom || d.occasion || "No occasion";
                  const age = Date.now() - d.updatedAt;
                  const daysAgo = Math.floor(age / (1000 * 60 * 60 * 24));
                  const timeLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
                  return (
                    <li key={d.key} className="py-4 flex flex-wrap items-center gap-x-2 gap-y-2">
                      <span className="font-medium text-charcoal">{d.recipientName}</span>
                      <span className="text-warm-gray"> · </span>
                      <span className="text-warm-gray capitalize">{occasion}</span>
                      <span className="text-warm-gray"> · </span>
                      <span className="text-xs text-warm-gray">{timeLabel}</span>
                      <span className="flex-1" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/cards/create/${d.recipientId}`)}
                          className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem(d.key);
                            setDrafts((prev) => prev.filter((x) => x.key !== d.key));
                          }}
                          className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                          style={{ color: "var(--color-error)", border: "1.5px solid var(--color-error)" }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Section 2: People in your circle — full-width banner, white (layer 2) */}
        {recipients.length > 0 && (
          <section className="w-full px-6 py-10" style={{ background: "var(--color-white)", borderTop: "1px solid var(--color-sage-light)" }}>
            <div className="max-w-4xl mx-auto">
              <h3 className="text-2xl sm:text-3xl font-semibold text-charcoal mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                People in your circle
              </h3>
              <p className="text-lg text-warm-gray mb-6">
                View or update a profile anytime.
              </p>
              <ul className="divide-y" style={{ borderColor: "var(--color-sage-light)" }}>
              {recipientsSortedByName.map((r) => {
                const nextEv = nextEventPerRecipient.get(r.id);
                return (
                  <li key={r.id} className="py-4 flex flex-wrap items-center gap-x-1 gap-y-2">
                    <span className="font-medium text-charcoal">{r.name}</span>
                    <span className="text-warm-gray"> </span>
                    <span className="text-warm-gray capitalize">({r.relationship_type})</span>
                    {nextEv && (
                      <>
                        <span className="text-warm-gray"> · </span>
                        <span className="text-warm-gray">
                          Next: {nextEv.label} in {formatNextEventTime(nextEv.daysAway)}
                        </span>
                      </>
                    )}
                    <span className="flex-1" />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/cards/create/${r.id}`)}
                        className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                        style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                      >
                        Create a card
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/recipients/${r.id}`)}
                        className="text-xs font-medium px-3 py-1 rounded-full text-warm-gray hover:text-charcoal transition-colors"
                        style={{ border: "1.5px solid var(--color-sage)" }}
                      >
                        View profile
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/recipients/${r.id}?edit=1`)}
                        className="text-xs font-medium px-3 py-1 rounded-full text-warm-gray hover:text-charcoal transition-colors"
                        style={{ border: "1.5px solid var(--color-sage)" }}
                      >
                        Edit
                      </button>
                    </div>
                  </li>
                );
              })}
              </ul>
            </div>
          </section>
        )}

        {/* Empty state — no people yet (only when no recipients) */}
        {recipients.length === 0 && (
          <section className="max-w-4xl mx-auto px-6 py-8">
            <div
              className="text-center py-16 border-2 border-dashed rounded-xl"
              style={{ borderColor: "var(--color-light-gray)" }}
            >
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--color-brand-light)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </div>
              <p className="text-warm-gray mb-2">No one here yet.</p>
              <p className="text-sm text-warm-gray mb-6">Add someone to start creating cards for them.</p>
              <button
                onClick={() => router.push("/recipients/new")}
                className="btn-primary"
              >
                Add your first person
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Usage stats modal */}
      {showUsage && usageStats && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowUsage(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
            style={{ background: "var(--color-white)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}>
                Usage &amp; Estimated Cost
              </h3>
              <button onClick={() => setShowUsage(false)} className="text-warm-gray hover:text-charcoal text-xl leading-none">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="card-surface rounded-xl p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--color-brand)" }}>
                  ${usageStats.totalCost.toFixed(2)}
                </div>
                <div className="text-xs text-warm-gray mt-1">Total estimated cost</div>
              </div>
              <div className="card-surface rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-charcoal">{usageStats.totalCalls}</div>
                <div className="text-xs text-warm-gray mt-1">API calls</div>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-warm-gray">Image generations</span>
                <span className="font-medium text-charcoal">{usageStats.imageGenerations}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-warm-gray">Image edits</span>
                <span className="font-medium text-charcoal">{usageStats.imageEdits}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-warm-gray">Text generations</span>
                <span className="font-medium text-charcoal">{usageStats.chatCompletions}</span>
              </div>
            </div>

            {Object.keys(usageStats.costByCard).length > 0 && (
              <div className="pt-4" style={{ borderTop: "1px solid var(--color-light-gray)" }}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-warm-gray">Cards created</span>
                  <span className="font-medium text-charcoal">{Object.keys(usageStats.costByCard).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-warm-gray">Avg cost per card</span>
                  <span className="font-medium text-charcoal">${usageStats.avgCostPerCard.toFixed(2)}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-warm-gray mt-4 leading-relaxed">
              Costs are estimates based on published API pricing. Actual charges may vary slightly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

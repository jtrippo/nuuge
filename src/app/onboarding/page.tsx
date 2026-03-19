"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveUserProfile, getUserProfile } from "@/lib/store";
import TraitPickerWheel from "@/components/TraitPickerWheel";
import AppHeader from "@/components/AppHeader";

// ─── Curated selection lists ────────────────────────────────────────

const PERSONALITY_TRAITS = [
  "Warm", "Outgoing", "Introverted", "Adventurous", "Creative",
  "Analytical", "Empathetic", "Funny", "Sarcastic", "Laid-back",
  "Energetic", "Thoughtful", "Practical", "Spontaneous", "Organized",
  "Sensitive", "Independent", "Loyal", "Optimistic", "Curious",
  "Generous", "Patient", "Ambitious", "Gentle", "Bold",
];

const INTEREST_CATEGORIES: Record<string, string[]> = {
  "Sports & Outdoors": ["Hiking", "Running", "Cycling", "Yoga", "Swimming", "Skiing", "Surfing", "Fishing", "Camping", "Golf", "Tennis"],
  "Arts & Creative": ["Painting", "Photography", "Music", "Writing", "Crafts", "Design", "Theater", "Dance"],
  "Food & Drink": ["Cooking", "Baking", "Wine", "Coffee", "Craft beer", "Dining out"],
  "Entertainment": ["Reading", "Movies", "Gaming", "Podcasts", "Travel", "Board games"],
  "Nature & Animals": ["Gardening", "Bird watching", "Dogs", "Cats", "Horses"],
  "Tech & Learning": ["Technology", "Science", "History", "Languages", "Puzzles"],
};

const ALL_INTERESTS = Object.values(INTEREST_CATEGORIES).flat();

/** Map each interest to its category for grouping in "Your picks" */
function getInterestCategory(interest: string): string | null {
  for (const [category, items] of Object.entries(INTEREST_CATEGORIES)) {
    if (items.includes(interest)) return category;
  }
  return null;
}

const COMMUNICATION_STYLES = [
  { id: "heartfelt", label: "Big and heartfelt", desc: "Expressive, emotional messages that say a lot" },
  { id: "short", label: "Short and sweet", desc: "Keep things simple and to the point" },
  { id: "funny", label: "Funny first", desc: "Humor leads the message" },
  { id: "thoughtful", label: "Thoughtful and specific", desc: "Personal messages referencing memories or shared experiences" },
  { id: "understated", label: "Simple and understated", desc: "Elegant and restrained tone" },
  { id: "conversational", label: "Warm and conversational", desc: "Sounds like a natural message from a friend" },
  { id: "playful", label: "Playful and lighthearted", desc: "Cheerful, upbeat energy" },
];

const HUMOR_STYLES = [
  { id: "dry", label: "Dry wit", desc: "Subtle, clever humor" },
  { id: "dad", label: "Dad jokes", desc: "Classic punny humor" },
  { id: "goofy", label: "Goofy / silly", desc: "Over-the-top fun" },
  { id: "deadpan", label: "Deadpan", desc: "Humor delivered very seriously" },
  { id: "teasing", label: "Playful teasing", desc: "Friendly roasting between people who know each other" },
  { id: "sarcastic", label: "Sarcastic / snarky", desc: "Edgy humor with attitude" },
  { id: "pun", label: "Pun-based", desc: "Wordplay-driven humor" },
  { id: "observational", label: "Observational", desc: "Humor about everyday life" },
];

const EMOTIONAL_ENERGY = [
  { id: "lowkey", label: "Low-key", desc: "Calm, relaxed tone" },
  { id: "warm", label: "Warm", desc: "Friendly and sincere" },
  { id: "emotional", label: "Emotional", desc: "Deeply heartfelt" },
  { id: "celebratory", label: "Celebratory", desc: "High-energy happiness" },
];

const LIFESTYLE_OPTIONS = [
  "Single", "In a relationship", "Married", "Divorced", "Widowed",
];

// ─── Component ──────────────────────────────────────────────────────

type OnboardingStep = "intro" | "basics" | "about" | "style" | "review";

export default function OnboardingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("intro");

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthday, setBirthday] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [lifestyle, setLifestyle] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [commStyle, setCommStyle] = useState<string[]>([]);
  const [emotionalEnergy, setEmotionalEnergy] = useState("");
  const [humorStyleId, setHumorStyleId] = useState("");
  const [centeredCommLabel, setCenteredCommLabel] = useState<string | null>(null);
  const [centeredEnergyLabel, setCenteredEnergyLabel] = useState<string | null>(null);
  const [centeredHumorLabel, setCenteredHumorLabel] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const existing = getUserProfile();
    if (existing?.onboarding_complete) {
      setCompleted(true);
    }
    if (existing) {
      const ex = existing as { first_name?: string; last_name?: string; nickname?: string };
      if (ex.first_name) setFirstName(ex.first_name);
      if (ex.last_name) setLastName(ex.last_name || "");
      if ((existing as { email?: string | null }).email) setEmail((existing as { email?: string | null }).email || "");
      if (ex.nickname) setNickname(ex.nickname || "");
      if (!ex.first_name && existing.display_name) setFirstName(existing.display_name);
      if (existing.birthday) setBirthday(existing.birthday);
      if (existing.lifestyle) setLifestyle(existing.lifestyle);
      if ((existing as { partner_name?: string }).partner_name) setPartnerName((existing as { partner_name?: string }).partner_name || "");
      const ma = existing.mailing_address;
      if (ma && typeof ma === "string") {
        const parts = ma.split("|");
        if (parts.length >= 4) {
          setAddressStreet(parts[0] || ""); setAddressCity(parts[1] || ""); setAddressState(parts[2] || ""); setAddressPostal(parts[3] || "");
        }
      }
      if (existing.personality) setSelectedTraits(existing.personality.split(", ").filter(Boolean));
      if (existing.interests?.length) setSelectedInterests(existing.interests);
      if (existing.communication_style) {
        const cs = existing.communication_style;
        let labels: string[] = [];
        const primaryMatch = cs.match(/Primary — ([^.]+)/);
        const secondaryMatch = cs.match(/Secondary — ([^.]+)/);
        if (primaryMatch) labels.push(primaryMatch[1].trim());
        if (secondaryMatch) labels.push(secondaryMatch[1].trim());
        if (labels.length === 0) labels = cs.split(",").map((s) => s.trim()).filter(Boolean);
        const ids = labels.map((l) => COMMUNICATION_STYLES.find((s) => s.label === l)?.id).filter(Boolean) as string[];
        setCommStyle(ids);
      }
      const ee = (existing as { emotional_energy?: string }).emotional_energy;
      if (ee) {
        const found = EMOTIONAL_ENERGY.find((e) => e.label === ee);
        if (found) setEmotionalEnergy(found.id);
      }
      if (existing.humor_style) {
        const match = HUMOR_STYLES.find((h) => h.label === existing.humor_style || existing.humor_style?.toLowerCase().includes(h.label.toLowerCase()));
        if (match) setHumorStyleId(match.id);
      }
    }
  }, []);

  // Scroll to top when moving to the next step so the user sees the top of the page
  useEffect(() => {
    if (!mounted) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step, mounted]);

  if (!mounted) return null;

  function toggleTrait(trait: string) {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  }

  function addCustomTrait() {
    const t = customTrait.trim();
    if (!t) return;
    const match = PERSONALITY_TRAITS.find((p) => p.toLowerCase() === t.toLowerCase());
    if (match) {
      if (!selectedTraits.includes(match)) toggleTrait(match);
    } else if (!selectedTraits.includes(t)) {
      setSelectedTraits((prev) => [...prev, t]);
    }
    setCustomTrait("");
  }

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function addCustomInterest() {
    const i = customInterest.trim();
    if (!i) return;
    const match = ALL_INTERESTS.find((x) => x.toLowerCase() === i.toLowerCase());
    if (match) {
      if (!selectedInterests.includes(match)) toggleInterest(match);
    } else if (!selectedInterests.includes(i)) {
      setSelectedInterests((prev) => [...prev, i]);
    }
    setCustomInterest("");
  }

  function toggleCommStyle(id: string) {
    setCommStyle((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 2 ? [...prev, id] : [prev[0], id]
    );
  }

  function toggleCommStyleByLabel(label: string) {
    const style = COMMUNICATION_STYLES.find((s) => s.label === label);
    if (style) toggleCommStyle(style.id);
  }

  function toggleEmotionalEnergyByLabel(label: string) {
    const e = EMOTIONAL_ENERGY.find((x) => x.label === label);
    if (!e) return;
    setEmotionalEnergy((prev) => (prev === e.id ? "" : e.id));
  }

  function toggleHumorStyleByLabel(label: string) {
    const h = HUMOR_STYLES.find((x) => x.label === label);
    if (!h) return;
    setHumorStyleId((prev) => (prev === h.id ? "" : h.id));
  }

  const showPartner = ["In a relationship", "Married"].includes(lifestyle);

  function handleSave() {
    const commLabels = COMMUNICATION_STYLES
      .filter((s) => commStyle.includes(s.id))
      .map((s) => s.label);
    const commStr = commLabels.length > 0
      ? `Primary — ${commLabels[0]}.${commLabels.length > 1 ? ` Secondary — ${commLabels[1]}.` : ""}`
      : null;
    const humorLabel = humorStyleId ? HUMOR_STYLES.find((h) => h.id === humorStyleId)?.label || null : null;
    const energyLabel = emotionalEnergy ? EMOTIONAL_ENERGY.find((e) => e.id === emotionalEnergy)?.label || null : null;
    const mailingAddr = [addressStreet, addressCity, addressState, addressPostal].some((s) => s.trim())
      ? [addressStreet.trim(), addressCity.trim(), addressState.trim(), addressPostal.trim()].join("|")
      : null;

    const displayName = nickname.trim() || firstName.trim();
    saveUserProfile({
      display_name: displayName,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      nickname: nickname.trim() || null,
      personality: selectedTraits.join(", "),
      humor_style: humorLabel,
      interests: selectedInterests,
      values: [],
      birthday: birthday || null,
      lifestyle: lifestyle || null,
      partner_name: showPartner && partnerName.trim() ? partnerName.trim() : null,
      communication_style: commStr,
      emotional_energy: energyLabel,
      mailing_address: mailingAddr,
      onboarding_complete: true,
    });
    setCompleted(true);
  }

  // ─── Completion screen ──────────────────────────────────────────

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4" style={{ background: "var(--color-cream)" }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#10024;</div>
          <h1 className="text-2xl font-bold text-charcoal mb-3">
            You&apos;re all set!
          </h1>
          <p className="text-warm-gray mb-8">
            Nuuge knows you now. Next, add someone you&apos;d like to send cards to.
          </p>
          <button
            onClick={() => router.push("/recipients/new")}
            className="btn-primary mr-3"
          >
            Add someone
          </button>
          <button
            onClick={() => router.push("/")}
            className="btn-secondary"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── Intro screen ──────────────────────────────────────────────

  if (step === "intro") {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4" style={{ background: "var(--color-cream)" }}>
        <div className="max-w-lg text-center">
          <h1 className="text-4xl font-bold text-charcoal mb-4">
            Welcome to Nuuge
          </h1>
          <p className="text-xl text-warm-gray mb-8 leading-relaxed">
            Cards that actually sound like you.
          </p>

          <div className="card-surface p-8 mb-8 text-left">
            <h2 className="text-xl font-semibold text-charcoal mb-5">
              Here&apos;s how this works
            </h2>
            <div className="space-y-5 text-base text-warm-gray leading-relaxed">
              <div className="flex justify-between items-start gap-3">
                <span className="font-bold text-lg" style={{ color: "var(--color-brand)" }}>1</span>
                <p>
                  <span className="font-medium text-charcoal">Quick setup.</span>{" "}
                  Tell Nuuge a bit about yourself — your personality, what you&apos;re into,
                  how you like to communicate. Takes about a minute.
                </p>
              </div>
              <div className="flex justify-between items-start gap-3">
                <span className="font-bold text-lg" style={{ color: "var(--color-brand)" }}>2</span>
                <p>
                  <span className="font-medium text-charcoal">Add your people.</span>{" "}
                  For each person you send cards to, tell us a little about them
                  and your relationship.
                </p>
              </div>
              <div className="flex justify-between items-start gap-3">
                <span className="font-bold text-lg" style={{ color: "var(--color-brand)" }}>3</span>
                <p>
                  <span className="font-medium text-charcoal">Nuuge creates cards for you.</span>{" "}
                  Using what it knows about you and the recipient, Nuuge writes messages
                  and designs cards that feel genuinely personal.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep("basics")}
            className="btn-primary text-lg px-10 py-4 shadow-lg"
          >
            Let&apos;s go
          </button>
        </div>
      </div>
    );
  }

  // ─── Wizard steps ──────────────────────────────────────────────

  const stepNumber = step === "basics" ? 1 : step === "about" ? 2 : step === "style" ? 3 : 4;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader hideAccount>
        <span className="font-medium text-charcoal">Account setup</span>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`w-8 h-1.5 rounded-full transition-colors ${
                n <= stepNumber ? "bg-brand" : "bg-light-gray"
              }`}
            />
          ))}
          <span className="text-xs text-warm-gray ml-2">Step {stepNumber} of 4</span>
        </div>
      </AppHeader>

      <main className={`mx-auto px-6 py-8 ${step === "about" || step === "style" ? "max-w-4xl" : "max-w-2xl"}`}>

        {/* ─── Step 1: Basics — Name, birthday, life stage, address ─── */}
        {step === "basics" && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">
              The basics
            </h2>
            <p className="text-xl text-warm-gray mb-6 leading-relaxed">
              A few details so Nuuge knows who&apos;s sending the cards.
            </p>

            <p className="text-base text-warm-gray mb-4">First name, last name, and birthday are required.</p>
            <div className="space-y-5">
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2" htmlFor="first-name">First name</label>
                <input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  autoFocus
                  required
                  aria-required="true"
                  className="input-field rounded-xl w-full text-lg py-3"
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2" htmlFor="last-name">Last name</label>
                <input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                  required
                  aria-required="true"
                  className="input-field rounded-xl w-full text-lg py-3"
                />
                <p className="text-base text-warm-gray mt-2">Used for address labels when we mail cards</p>
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field rounded-xl w-full text-lg py-3"
                />
                <p className="text-base text-warm-gray mt-2">Optional — for account and delivery updates</p>
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2" htmlFor="nickname">Nickname</label>
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. JT for John Thomas"
                  className="input-field rounded-xl w-full text-lg py-3"
                />
                <p className="text-base text-warm-gray mt-2">Used in card salutations if you prefer it over your first name</p>
              </div>

              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2" htmlFor="birthday">Birthday</label>
                <input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  required
                  aria-required="true"
                  className="input-field rounded-xl w-full text-lg py-3"
                />
                <p className="text-base text-warm-gray mt-2">Helps Nuuge create age-appropriate cards</p>
              </div>

              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Life stage</label>
                <div className="flex flex-wrap gap-2">
                  {LIFESTYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setLifestyle(lifestyle === opt ? "" : opt)}
                      className={`px-3 py-2 rounded-full text-base transition-colors
                        ${lifestyle === opt
                          ? "bg-brand text-white"
                          : "bg-faint-gray text-charcoal hover:bg-light-gray"
                        }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {showPartner && (
                  <div className="mt-3">
                    <label className="block text-lg font-medium text-charcoal mb-1">Partner&apos;s name</label>
                    <input
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="For co-signing cards together"
                      className="input-field rounded-xl w-full text-lg py-3"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Address</label>
                <p className="text-base text-warm-gray mb-3">Optional — useful if we mail cards for you later</p>
                <div className="space-y-3">
                  <input
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    placeholder="Street address"
                    className="input-field rounded-xl w-full text-lg py-3"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={addressCity}
                      onChange={(e) => setAddressCity(e.target.value)}
                      placeholder="City"
                      className="input-field rounded-xl w-full text-lg py-3"
                    />
                    <input
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value)}
                      placeholder="State / Region"
                      className="input-field rounded-xl w-full text-lg py-3"
                    />
                  </div>
                  <input
                    value={addressPostal}
                    onChange={(e) => setAddressPostal(e.target.value)}
                    placeholder="Postal / ZIP code"
                    className="input-field rounded-xl w-full text-lg py-3"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 mt-8">
              <button
                onClick={() => setStep("intro")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={() => setStep("about")}
                disabled={!firstName.trim() || !lastName.trim() || !birthday}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: About You — Personality + Interests on same page, combined pick list ─── */}
        {step === "about" && (
          <div className="flex gap-6 min-h-[calc(100vh-12rem)]">
            {/* Left: Personality + Interests — scrollable, wheels for both */}
            <div className="flex-1 max-w-xl flex flex-col overflow-y-auto">
              {/* Personality section */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-charcoal mb-2">Personality</h2>
                <p className="text-xl text-warm-gray mb-3 leading-relaxed">
                  These words help Nuuge write cards that sound like you — warm, funny, thoughtful, or whatever fits.
                </p>
                <p className="text-xl font-semibold text-charcoal mb-6">Tap the ones that feel like you.</p>
                <TraitPickerWheel
                  items={PERSONALITY_TRAITS}
                  selected={selectedTraits}
                  onToggle={toggleTrait}
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
              </div>

              {/* Interests section — wheel below personality */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-charcoal mb-2">Interests</h2>
                <p className="text-xl text-warm-gray mb-3 leading-relaxed">
                  What you&apos;re into — gives Nuuge ideas for personal touches in your cards.
                </p>
                <p className="text-xl font-semibold text-charcoal mb-6">Tap the ones that fit.</p>
                <TraitPickerWheel
                  items={ALL_INTERESTS}
                  selected={selectedInterests}
                  onToggle={toggleInterest}
                />
                <div className="flex gap-2 mt-4">
                  <input
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomInterest()}
                    placeholder="Add your own interest..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={addCustomInterest}
                    disabled={!customInterest.trim()}
                    className="text-sm font-medium px-3 disabled:text-warm-gray"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center gap-3">
                <button
                  onClick={() => setStep("basics")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <button
                  onClick={() => setStep("style")}
                  className="btn-primary"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Right: This is you! — banner + combined pick list (personality + interests) */}
            <div
              className="flex-1 max-w-xl overflow-hidden flex flex-col self-stretch"
              style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", minHeight: "calc(100vh - 12rem)" }}
            >
              <div
                className="flex-shrink-0 px-5 py-5 flex flex-col justify-center"
                style={{
                  backgroundImage: "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('/milky-way-banner.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  minHeight: "140px",
                }}
              >
                <p className="text-xl font-bold text-white mb-1 text-center" style={{ fontFamily: "var(--font-heading)" }}>
                  This is you!
                </p>
                <p className="text-sm text-white text-center">Map the stars that make you, you</p>
              </div>
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto">
                <p className="text-lg font-semibold text-charcoal mb-3">Your picks</p>
                {selectedTraits.length === 0 && selectedInterests.length === 0 ? (
                  <p className="text-lg text-warm-gray italic pl-3">Tap traits and interests in the wheels to add them</p>
                ) : (
                  <div className="space-y-4 pl-3">
                    {selectedTraits.length > 0 && (
                      <div>
                        <p className="section-label mb-1.5">Personality</p>
                        <ul className="space-y-1.5 pl-5">
                          {selectedTraits.map((t) => (
                            <li key={`trait-${t}`}>
                              <button
                                onClick={() => toggleTrait(t)}
                                className="text-lg font-medium text-brand hover:opacity-70 text-left w-full"
                              >
                                {t} ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedInterests.length > 0 && (
                      <div>
                        <p className="section-label mb-1.5">Interests</p>
                        {(() => {
                          const byCategory = new Map<string, string[]>();
                          const uncategorized: string[] = [];
                          for (const i of selectedInterests) {
                            const cat = getInterestCategory(i);
                            if (cat) {
                              if (!byCategory.has(cat)) byCategory.set(cat, []);
                              byCategory.get(cat)!.push(i);
                            } else {
                              uncategorized.push(i);
                            }
                          }
                          return (
                            <div className="space-y-3">
                              {Array.from(byCategory.entries()).map(([category, items]) => (
                                <div key={category}>
                                  <p className="text-xs font-medium text-warm-gray mb-1">{category}</p>
                                  <ul className="space-y-1.5 pl-5">
                                    {items.map((interest) => (
                                      <li key={`interest-${interest}`}>
                                        <button
                                          onClick={() => toggleInterest(interest)}
                                          className="text-lg font-medium text-brand hover:opacity-70 text-left w-full"
                                        >
                                          {interest} ×
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                              {uncategorized.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-warm-gray mb-1">Your own</p>
                                  <ul className="space-y-1.5 pl-5">
                                    {uncategorized.map((interest) => (
                                      <li key={`interest-${interest}`}>
                                        <button
                                          onClick={() => toggleInterest(interest)}
                                          className="text-lg font-medium text-brand hover:opacity-70 text-left w-full"
                                        >
                                          {interest} ×
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Your Style — Communication, humor, emotional energy (wheels + Your picks) ─── */}
        {step === "style" && (
          <div className="flex gap-6 min-h-[calc(100vh-12rem)]">
            <div className="flex-1 max-w-xl flex flex-col overflow-y-auto">
              <h2 className="text-2xl font-bold text-charcoal mb-2">How you communicate</h2>
              <p className="text-xl text-warm-gray mb-6 leading-relaxed">
                This helps Nuuge match your natural voice when writing card messages.
              </p>

              {/* Communication style — wheel + description preview */}
              <div className="mb-8">
                <label className="block text-xl font-semibold text-charcoal mb-3">
                  Communication style
                </label>
                <p className="text-base text-warm-gray mb-3">Select 1 or 2 styles that describe how you write cards.</p>
                <TraitPickerWheel
                  items={COMMUNICATION_STYLES.map((s) => s.label)}
                  selected={commStyle.map((id) => COMMUNICATION_STYLES.find((s) => s.id === id)!.label)}
                  onToggle={toggleCommStyleByLabel}
                  onCenterChange={setCenteredCommLabel}
                />
                {centeredCommLabel && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-warm-gray mb-1">Description</p>
                    <div className="px-4 py-3 rounded-xl text-base text-warm-gray" style={{ background: "rgba(255,255,255,0.8)", border: "1.5px solid var(--color-sage)" }}>
                      {COMMUNICATION_STYLES.find((s) => s.label === centeredCommLabel)?.desc}
                    </div>
                  </div>
                )}
              </div>

              {/* Emotional energy — wheel + description preview */}
              <div className="mb-8">
                <label className="block text-xl font-semibold text-charcoal mb-3">Emotional energy</label>
                <p className="text-base text-warm-gray mb-3">Helps Nuuge control the intensity of your messages. (Optional but recommended)</p>
                <TraitPickerWheel
                  items={EMOTIONAL_ENERGY.map((e) => e.label)}
                  selected={emotionalEnergy ? [EMOTIONAL_ENERGY.find((e) => e.id === emotionalEnergy)!.label] : []}
                  onToggle={toggleEmotionalEnergyByLabel}
                  onCenterChange={setCenteredEnergyLabel}
                />
                {centeredEnergyLabel && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-warm-gray mb-1">Description</p>
                    <div className="px-4 py-3 rounded-xl text-base text-warm-gray" style={{ background: "rgba(255,255,255,0.8)", border: "1.5px solid var(--color-sage)" }}>
                      {EMOTIONAL_ENERGY.find((e) => e.label === centeredEnergyLabel)?.desc}
                    </div>
                  </div>
                )}
              </div>

              {/* Humor style — wheel + description preview */}
              <div className="mb-6">
                <label className="block text-xl font-semibold text-charcoal mb-3">Humor style</label>
                <p className="text-base text-warm-gray mb-3">
                  {commStyle.some((id) => id === "funny" || id === "playful") ? "When you use humor, what kind? (Optional)" : "If you select Funny or Playful above, you can refine your humor style here."}
                </p>
                <TraitPickerWheel
                  items={HUMOR_STYLES.map((h) => h.label)}
                  selected={humorStyleId ? [HUMOR_STYLES.find((h) => h.id === humorStyleId)!.label] : []}
                  onToggle={toggleHumorStyleByLabel}
                  onCenterChange={setCenteredHumorLabel}
                />
                {centeredHumorLabel && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-warm-gray mb-1">Description</p>
                    <div className="px-4 py-3 rounded-xl text-base text-warm-gray" style={{ background: "rgba(255,255,255,0.8)", border: "1.5px solid var(--color-sage)" }}>
                      {HUMOR_STYLES.find((h) => h.label === centeredHumorLabel)?.desc}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center gap-3">
                <button onClick={() => setStep("about")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors" style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back</button>
                <button onClick={() => setStep("review")} className="btn-primary">Review</button>
              </div>
            </div>

            {/* Right: Your picks — Primary/Secondary labels */}
            <div
              className="flex-1 max-w-xl overflow-hidden flex flex-col self-stretch rounded-xl"
              style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", minHeight: "calc(100vh - 12rem)" }}
            >
              <div className="flex-shrink-0 px-5 py-5">
                <p className="text-lg font-semibold text-charcoal mb-3">Your picks</p>
              </div>
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto">
                <div className="space-y-4 pl-3">
                  {(commStyle.length > 0 || emotionalEnergy || humorStyleId) ? (
                    <>
                      {commStyle.length > 0 && (
                        <div>
                          <p className="section-label mb-1.5">Communication style</p>
                          <ul className="space-y-1.5 pl-5">
                            {commStyle.map((id, i) => {
                              const s = COMMUNICATION_STYLES.find((x) => x.id === id);
                              return s ? (
                                <li key={s.id}>
                                  <span className="text-sm font-medium text-warm-gray">
                                    {i === 0 ? "Primary:" : "Secondary:"}
                                  </span>{" "}
                                  <button
                                    onClick={() => toggleCommStyle(s.id)}
                                    className="text-lg font-medium text-brand hover:opacity-70 text-left"
                                  >
                                    {s.label} ×
                                  </button>
                                </li>
                              ) : null;
                            })}
                          </ul>
                        </div>
                      )}
                      {emotionalEnergy && (
                        <div>
                          <p className="section-label mb-1.5">Emotional energy</p>
                          <ul className="space-y-1.5 pl-5">
                            <li>
                              <button
                                onClick={() => setEmotionalEnergy("")}
                                className="text-lg font-medium text-brand hover:opacity-70 text-left"
                              >
                                {EMOTIONAL_ENERGY.find((e) => e.id === emotionalEnergy)?.label} ×
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                      {humorStyleId && (
                        <div>
                          <p className="section-label mb-1.5">Humor style</p>
                          <ul className="space-y-1.5 pl-5">
                            <li>
                              <button
                                onClick={() => setHumorStyleId("")}
                                className="text-lg font-medium text-brand hover:opacity-70 text-left"
                              >
                                {HUMOR_STYLES.find((h) => h.id === humorStyleId)?.label} ×
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-lg text-warm-gray italic pl-3">Tap items in the wheels to add them</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 4: Review ─── */}
        {step === "review" && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">
              Look good?
            </h2>
            <p className="text-xl text-warm-gray mb-6 leading-relaxed">
              Here&apos;s what Nuuge will use to write cards that sound like you. Tap any section to go back and edit.
            </p>

            <div className="space-y-4 mb-8">
              {/* Basics */}
              <button
                onClick={() => setStep("basics")}
                className="w-full card-surface card-surface-clickable p-5 text-left hover:border-sage transition-colors"
              >
                <p className="section-label mb-2">Basics</p>
                <p className="text-lg text-charcoal font-medium">
                  {nickname.trim() || firstName.trim()}{lastName.trim() ? ` (${firstName.trim()} ${lastName.trim()})` : ""}
                </p>
                {birthday && <p className="text-base text-warm-gray">Birthday: {birthday}</p>}
                {lifestyle && <p className="text-base text-warm-gray">Life stage: {lifestyle}{showPartner && partnerName.trim() ? ` — partner: ${partnerName.trim()}` : ""}</p>}
                {[addressStreet, addressCity, addressState, addressPostal].some((s) => s.trim()) && (
                  <p className="text-base text-warm-gray mt-1">
                    Address: {[addressStreet, addressCity, addressState, addressPostal].filter((s) => s.trim()).join(", ")}
                  </p>
                )}
              </button>

              {/* Personality & Interests */}
              <button
                onClick={() => setStep("about")}
                className="w-full card-surface card-surface-clickable p-5 text-left hover:border-sage transition-colors"
              >
                <p className="section-label mb-2">Personality</p>
                <p className="text-lg text-charcoal">
                  {selectedTraits.length > 0 ? selectedTraits.join(", ") : <span className="text-warm-gray">None selected</span>}
                </p>
                <p className="section-label mt-4 mb-2">Interests</p>
                <p className="text-lg text-charcoal">
                  {selectedInterests.length > 0 ? selectedInterests.join(", ") : <span className="text-warm-gray">None selected</span>}
                </p>
              </button>

              {/* Style */}
              <button
                onClick={() => setStep("style")}
                className="w-full card-surface card-surface-clickable p-5 text-left hover:border-sage transition-colors"
              >
                <p className="section-label mb-2">Communication style</p>
                <p className="text-lg text-charcoal">
                  {commStyle.length > 0
                    ? (() => {
                        const labels = COMMUNICATION_STYLES.filter((s) => commStyle.includes(s.id)).map((s) => s.label);
                        return labels.length > 1 ? `Primary: ${labels[0]}; Secondary: ${labels[1]}` : labels[0];
                      })()
                    : <span className="text-warm-gray">Not specified</span>
                  }
                </p>
                {emotionalEnergy && (
                  <>
                    <p className="section-label mt-4 mb-2">Emotional energy</p>
                    <p className="text-lg text-charcoal">{EMOTIONAL_ENERGY.find((e) => e.id === emotionalEnergy)?.label}</p>
                  </>
                )}
                {humorStyleId && (
                  <>
                    <p className="section-label mt-4 mb-2">Humor style</p>
                    <p className="text-lg text-charcoal">{HUMOR_STYLES.find((h) => h.id === humorStyleId)?.label}</p>
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-between items-center gap-3">
              <button
                onClick={() => setStep("style")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
              >
                Save &amp; continue
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserProfile, saveRecipient, getRecipients } from "@/lib/store";
import TraitPickerWheel from "@/components/TraitPickerWheel";
import AppHeader from "@/components/AppHeader";
import { Suspense } from "react";

// ─── Curated selection lists ────────────────────────────────────────

const RELATIONSHIP_TYPES = [
  "Son", "Daughter",
  "Parent", "Sibling",
  "Grandparent", "Grandson", "Granddaughter",
  "Aunt", "Uncle", "Niece", "Nephew", "Cousin",
  "Friend", "Best friend",
  "Partner", "Spouse",
  "Colleague", "Boss", "Mentor",
  "Neighbor", "In-law",
  "Stepson", "Stepdaughter",
  "Godson", "Goddaughter",
];

const RELATIONSHIP_WHEEL_ITEMS = [...RELATIONSHIP_TYPES, "Other"];

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

function getInterestCategory(interest: string): string | null {
  for (const [category, items] of Object.entries(INTEREST_CATEGORIES)) {
    if (items.includes(interest)) return category;
  }
  return null;
}

const HUMOR_LEVELS = [
  { id: "serious", label: "Keep it sincere", desc: "No humor in cards" },
  { id: "light", label: "Light and gentle", desc: "A warm smile, nothing more" },
  { id: "warm", label: "Warm with a smile", desc: "Lighthearted but heartfelt" },
  { id: "playful", label: "Playful and fun", desc: "Jokes are welcome" },
  { id: "wild", label: "Go wild", desc: "The funnier the better" },
];

const PERSONAL_DATE_TYPES = [
  "Birthday", "Anniversary", "Graduation", "Wedding",
  "Memorial", "Retirement", "Other",
];

/** Recommended default: recurring for yearly occasions, one-time for milestones. */
function defaultRecurringForType(type: string): boolean {
  return ["Birthday", "Anniversary", "Wedding"].includes(type);
}

const LIFESTYLE_OPTIONS = [
  "Single", "In a relationship", "Married", "Divorced", "Widowed",
];

// ─── Component ──────────────────────────────────────────────────────

type RecipientStep = "who" | "personality" | "preferences" | "review";

interface PersonalDate {
  label: string;
  date: string;
  recurring: boolean;
}

export default function NewRecipientPage() {
  return (
    <Suspense fallback={null}>
      <NewRecipientPageInner />
    </Suspense>
  );
}

function NewRecipientPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const [mounted, setMounted] = useState(false);
  const [userProfile, setUserProfile] = useState<ReturnType<typeof getUserProfile>>(null);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState<RecipientStep>("who");

  const recipientIdRef = useRef<string>(resumeId || crypto.randomUUID());

  // Form state — Who step
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [lifestyle, setLifestyle] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [humorTolerance, setHumorTolerance] = useState("");
  const [personalDates, setPersonalDates] = useState<PersonalDate[]>([]);
  const [newDateType, setNewDateType] = useState("Birthday");
  const [newDateValue, setNewDateValue] = useState("");
  const [newDateRecurring, setNewDateRecurring] = useState(true);
  const [milestones, setMilestones] = useState("");
  const [humorCenterLabel, setHumorCenterLabel] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setUserProfile(getUserProfile());

    if (resumeId) {
      const all = getRecipients();
      const existing = all.find((r) => r.id === resumeId);
      if (existing) {
        setFirstName(existing.first_name || "");
        setLastName(existing.last_name || "");
        setEmail(existing.email || "");
        setNickname(existing.nickname || "");
        if (existing.mailing_address) {
          const parts = existing.mailing_address.split("|");
          setAddressStreet(parts[0] || "");
          setAddressCity(parts[1] || "");
          setAddressState(parts[2] || "");
          setAddressPostal(parts[3] || "");
        }
        setLifestyle(existing.lifestyle || "");
        const rel = existing.relationship_type || "";
        if (rel && !RELATIONSHIP_TYPES.includes(rel)) {
          setRelationship("__custom");
          setCustomRelationship(rel);
        } else {
          setRelationship(rel);
        }
        if (existing.personality_notes) {
          setSelectedTraits(existing.personality_notes.split(", ").filter(Boolean));
        }
        setSelectedInterests(existing.interests || []);
        if (existing.humor_tolerance) {
          const match = HUMOR_LEVELS.find((h) => h.label === existing.humor_tolerance);
          setHumorTolerance(match?.id || "");
        }
        setPersonalDates(existing.important_dates || []);
        setMilestones((existing.milestones || []).join("\n"));

        const resumeStep = existing.setup_step as RecipientStep | undefined;
        if (resumeStep && ["who", "personality", "preferences", "review"].includes(resumeStep)) {
          setStep(resumeStep);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step, mounted]);

  if (!mounted) return null;

  if (!userProfile?.onboarding_complete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4" style={{ background: "var(--color-cream)" }}>
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-charcoal mb-3">
            Hold on — we haven&apos;t met yet!
          </h1>
          <p className="text-warm-gray mb-8">
            Before adding people, let Nuuge get to know you first.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="btn-primary"
          >
            Set up my account
          </button>
        </div>
      </div>
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────

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

  function addDate() {
    if (!newDateValue) return;
    const typeNorm = newDateType.trim().toLowerCase();
    const alreadyUsed = typeNorm !== "other" && personalDates.some(
      (d) => (d.label || "").trim().toLowerCase() === typeNorm
    );
    if (alreadyUsed) return;
    setPersonalDates((prev) => [
      ...prev,
      { label: newDateType, date: newDateValue, recurring: newDateRecurring },
    ]);
    setNewDateType("Birthday");
    setNewDateValue("");
    setNewDateRecurring(defaultRecurringForType("Birthday"));
  }

  const usedDateTypes = new Set(
    personalDates.map((d) => (d.label || "").trim().toLowerCase()).filter(Boolean)
  );
  const isDateTypeDisabled = (dt: string) =>
    dt.toLowerCase() !== "other" && usedDateTypes.has(dt.toLowerCase());

  function toggleDateRecurring(idx: number) {
    setPersonalDates((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, recurring: !d.recurring } : d))
    );
  }

  function removeDate(idx: number) {
    setPersonalDates((prev) => prev.filter((_, i) => i !== idx));
  }

  const resolvedRelationship = relationship === "__custom"
    ? customRelationship.trim()
    : relationship;

  const displayName = nickname.trim()
    || [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim()
    || "";

  const relationshipWheelItems = customRelationship.trim()
    ? [...RELATIONSHIP_TYPES, `Other: ${customRelationship.trim()}`]
    : RELATIONSHIP_WHEEL_ITEMS;

  const relationshipWheelSelected = relationship === "__custom"
    ? [customRelationship.trim() ? `Other: ${customRelationship.trim()}` : "Other"]
    : relationship ? [relationship] : [];

  function toggleRelationship(item: string) {
    if (item === "Other" || item.startsWith("Other: ")) {
      const isCurrentlySelected = relationship === "__custom" && (
        (item === "Other" && !customRelationship.trim()) ||
        (item.startsWith("Other: ") && customRelationship.trim() === item.slice(7))
      );
      if (isCurrentlySelected) {
        setRelationship("");
        setCustomRelationship("");
      } else {
        setRelationship("__custom");
        setCustomRelationship(item.startsWith("Other: ") ? item.slice(7) : "");
      }
    } else {
      setRelationship((prev) => (prev === item ? "" : item));
      setCustomRelationship("");
    }
  }

  function addCustomRelationship() {
    const t = customRelationship.trim();
    if (!t) return;
    const match = RELATIONSHIP_WHEEL_ITEMS.find((item) => item.toLowerCase() === t.toLowerCase());
    if (match) {
      if (match === "Other") {
        setRelationship("__custom");
        setCustomRelationship("");
      } else {
        setRelationship(match);
        setCustomRelationship("");
      }
    } else {
      setRelationship("__custom");
      setCustomRelationship(t);
    }
  }

  function buildRecipientData() {
    const milestonesArray = milestones.split("\n").map((m) => m.trim()).filter(Boolean);
    const nameForSave = displayName || "Unnamed";
    const mailingAddr = [addressStreet, addressCity, addressState, addressPostal].some((s) => s.trim())
      ? [addressStreet.trim(), addressCity.trim(), addressState.trim(), addressPostal.trim()].join("|")
      : null;
    return {
      id: recipientIdRef.current,
      user_id: "local",
      name: nameForSave,
      display_name: nameForSave,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      nickname: nickname.trim() || null,
      mailing_address: mailingAddr,
      lifestyle: lifestyle.trim() || null,
      relationship_type: resolvedRelationship || "",
      personality_notes: selectedTraits.join(", ") || null,
      interests: selectedInterests,
      humor_tolerance: humorTolerance ? (HUMOR_LEVELS.find((h) => h.id === humorTolerance)?.label ?? humorTolerance) : null,
      tone_preference: "Not specified",
      important_dates: personalDates,
      milestones: milestonesArray,
    };
  }

  function saveDraft(nextStep: RecipientStep) {
    saveRecipient({
      ...buildRecipientData(),
      setup_complete: false,
      setup_step: nextStep,
    });
  }

  function advanceStep(nextStep: RecipientStep) {
    saveDraft(nextStep);
    setStep(nextStep);
  }

  function handleSave() {
    saveRecipient({
      ...buildRecipientData(),
      setup_complete: true,
      setup_step: undefined,
    });
    setCompleted(true);
  }

  // ─── Completion screen ──────────────────────────────────────────

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4" style={{ background: "var(--color-cream)" }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-charcoal mb-3">
            {displayName || "They"} are all set!
          </h1>
          <p className="text-warm-gray mb-8">
            Nuuge now knows enough to create personalized cards for {displayName || "them"}.
          </p>
          <button
            onClick={() => {
              recipientIdRef.current = crypto.randomUUID();
              setCompleted(false);
              setStep("who");
              setFirstName("");
              setLastName("");
              setNickname("");
              setAddressStreet("");
              setAddressCity("");
              setAddressState("");
              setAddressPostal("");
              setLifestyle("");
              setRelationship("");
              setCustomRelationship("");
              setSelectedTraits([]);
              setSelectedInterests([]);
              setHumorTolerance("");
              setPersonalDates([]);
              setMilestones("");
            }}
            className="btn-primary mr-3"
          >
            Add another person
          </button>
          <button
            onClick={() => router.push("/")}
            className="btn-secondary"
          >
            Go to Circle of People
          </button>
        </div>
      </div>
    );
  }

  // ─── Wizard ───────────────────────────────────────────────────

  const stepNumber = step === "who" ? 1 : step === "personality" ? 2 : step === "preferences" ? 3 : 4;

  const isTwoColumn = step === "personality" || step === "preferences";

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader>
        <span className="font-medium text-charcoal">
          {displayName ? `About ${displayName}` : "Add a person"}
        </span>
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
          <button
            onClick={() => router.push("/")}
            className="text-warm-gray hover:text-charcoal ml-4"
          >
            Cancel
          </button>
        </div>
      </AppHeader>

      <main className={`mx-auto px-6 py-8 ${isTwoColumn ? "max-w-4xl" : "max-w-2xl"}`}>

        {/* ─── Step 1: Who ─── */}
        {step === "who" && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">
              Who is this person?
            </h2>
            <p className="text-xl text-warm-gray mb-6 leading-relaxed">
              Their name and how they&apos;re connected to you.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoFocus
                  className="w-full input-field rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full input-field rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="their@example.com"
                  className="w-full input-field rounded-xl"
                />
                <p className="text-base text-warm-gray mt-2">Optional — for delivery or follow-up</p>
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Nickname</label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. JT for John Thomas — used in card salutations if you prefer"
                  className="w-full input-field rounded-xl"
                />
                <p className="text-base text-warm-gray mt-2">Optional — used in card salutations if you prefer it over first name</p>
              </div>
              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Address</label>
                <p className="text-base text-warm-gray mb-3">Optional — useful if we mail cards for you later</p>
                <div className="space-y-3">
                  <input
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    placeholder="Street address"
                    className="w-full input-field rounded-xl"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={addressCity}
                      onChange={(e) => setAddressCity(e.target.value)}
                      placeholder="City"
                      className="w-full input-field rounded-xl"
                    />
                    <input
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value)}
                      placeholder="State / Region"
                      className="w-full input-field rounded-xl"
                    />
                  </div>
                  <input
                    value={addressPostal}
                    onChange={(e) => setAddressPostal(e.target.value)}
                    placeholder="Postal / ZIP code"
                    className="w-full input-field rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xl font-semibold text-charcoal mb-2">Life stage</label>
                <p className="text-base text-warm-gray mb-3">Optional — helps Nuuge write age- and stage-appropriate messages</p>
                <div className="flex flex-wrap gap-2">
                  {LIFESTYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
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
              </div>

              <div>
                <label className="block text-xl font-semibold text-charcoal mb-3">
                  Relationship
                </label>
                <p className="text-base text-warm-gray mb-3">
                  Scroll to find how they&apos;re connected to you, or add your own below.
                </p>
                <TraitPickerWheel
                  items={relationshipWheelItems}
                  selected={relationshipWheelSelected}
                  onToggle={toggleRelationship}
                  scrollToSelectedWhenSingle
                />
                <div className="flex gap-2 mt-4">
                  <input
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomRelationship()}
                    placeholder="Add your own (e.g. Godparent, Roommate...)"
                    className="input-field flex-1 rounded-xl"
                  />
                  <button
                    onClick={addCustomRelationship}
                    disabled={!customRelationship.trim()}
                    className="text-sm font-medium px-3 disabled:text-warm-gray rounded-xl"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => router.push("/")}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2"
              >
                &larr; Circle of People
              </button>
              <button
                onClick={() => advanceStep("personality")}
                disabled={!displayName.trim() || !resolvedRelationship}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Personality & Interests ─── */}
        {step === "personality" && (
          <div className="flex gap-6 min-h-[calc(100vh-12rem)]">
            <div className="flex-1 max-w-xl flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <h2 className="text-2xl font-bold text-charcoal mb-2">
                  What is {displayName} like?
                </h2>
                <p className="text-xl text-warm-gray mb-6 leading-relaxed">
                  This helps Nuuge write messages that feel right for them.
                </p>

                <div className="mb-8">
                  <p className="text-xl font-semibold text-charcoal mb-6">Personality — tap the ones that fit {displayName}</p>
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

                <div className="mb-8">
                  <p className="text-xl font-semibold text-charcoal mb-6">{displayName}&apos;s interests — tap the ones that fit</p>
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
              </div>

              <div className="flex-shrink-0 flex justify-between items-center gap-3 pt-4 relative z-20">
                <button
                  onClick={() => setStep("who")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <button
                  onClick={() => advanceStep("preferences")}
                  className="btn-primary"
                >
                  Next
                </button>
              </div>
            </div>

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
                  Your picks for {displayName}
                </p>
                <p className="text-sm text-white text-center">Personality & interests</p>
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

        {/* ─── Step 3: Card Preferences ─── */}
        {step === "preferences" && (
          <div className="flex gap-6 min-h-[calc(100vh-12rem)]">
            <div className="flex-1 max-w-xl flex flex-col">
              <div className="flex-1 overflow-y-auto">
              <h2 className="text-2xl font-bold text-charcoal mb-2">
                Card preferences for {displayName}
              </h2>
              <p className="text-xl text-warm-gray mb-6 leading-relaxed">
                What kind of cards work best for {displayName}?
              </p>

              <div className="mb-8">
                <p className="text-xl font-semibold text-charcoal mb-6">How much humor in their cards?</p>
                <TraitPickerWheel
                  items={HUMOR_LEVELS.map((h) => h.label)}
                  selected={humorTolerance ? [HUMOR_LEVELS.find((h) => h.id === humorTolerance)?.label ?? ""].filter(Boolean) : []}
                  onToggle={(label) => {
                    const h = HUMOR_LEVELS.find((x) => x.label === label);
                    if (h) setHumorTolerance((prev) => (prev === h.id ? "" : h.id));
                  }}
                  onCenterChange={setHumorCenterLabel}
                />
                {humorCenterLabel && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-warm-gray mb-1">Description</p>
                    <div className="px-4 py-3 rounded-xl text-base text-warm-gray" style={{ background: "rgba(255,255,255,0.8)", border: "1.5px solid var(--color-sage)" }}>
                      {HUMOR_LEVELS.find((h) => h.label === humorCenterLabel)?.desc}
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <label className="block text-xl font-semibold text-charcoal mb-3">Personal dates</label>
                {personalDates.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {personalDates.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--color-faint-gray)" }}>
                        <span className="text-sm text-charcoal">
                          {d.label}: {d.date}{" "}
                          <button
                            type="button"
                            onClick={() => toggleDateRecurring(i)}
                            className="text-xs font-medium hover:opacity-80"
                            style={{ color: "var(--color-brand)" }}
                            title={d.recurring ? "Recurring every year (click to make one-time)" : "One-time (click to make recurring)"}
                          >
                            {d.recurring ? "(yearly)" : "(one-time)"}
                          </button>
                        </span>
                        <button
                          onClick={() => removeDate(i)}
                          className="text-xs hover:opacity-80" style={{ color: "var(--color-error)" }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-xl p-4 space-y-3 mt-3" style={{ background: "var(--color-faint-gray)" }}>
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Type</label>
                    <div className="flex flex-wrap gap-2">
                      {PERSONAL_DATE_TYPES.map((dt) => {
                        const disabled = isDateTypeDisabled(dt);
                        return (
                          <button
                            key={dt}
                            type="button"
                            disabled={disabled}
                            title={disabled ? "Already added" : undefined}
                            onClick={() => {
                              if (disabled) return;
                              setNewDateType(dt);
                              setNewDateRecurring(defaultRecurringForType(dt));
                            }}
                            className={`px-3 py-1 rounded-full text-xs transition-colors
                              ${disabled
                                ? "bg-faint-gray text-warm-gray border border-light-gray cursor-not-allowed opacity-60"
                                : newDateType === dt
                                  ? "bg-brand text-white"
                                  : "bg-white text-warm-gray border border-light-gray hover:border-sage"
                              }`}
                          >
                            {dt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Date</label>
                    <input
                      type="date"
                      value={newDateValue}
                      onChange={(e) => setNewDateValue(e.target.value)}
                      className="w-full input-field"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDateRecurring}
                      onChange={(e) => setNewDateRecurring(e.target.checked)}
                      className="rounded border-light-gray"
                    />
                    <span className="text-sm text-charcoal">Recurring (e.g. every year)</span>
                  </label>
                  <button
                    onClick={addDate}
                    disabled={!newDateValue || isDateTypeDisabled(newDateType)}
                    className="btn-primary text-sm px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add date
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xl font-semibold text-charcoal mb-2">Milestones &amp; important dates</label>
                <textarea
                  value={milestones}
                  onChange={(e) => setMilestones(e.target.value)}
                  rows={3}
                  placeholder={"e.g. Graduated college 2024\nFirst marathon 2023\nGot promoted last year"}
                  className="w-full input-field rounded-xl resize-none text-base"
                />
                <p className="text-base text-warm-gray mt-2">Optional — one per line. These help Nuuge remind you when a meaningful moment is coming up.</p>
              </div>

              </div>

              <div className="flex-shrink-0 flex justify-between items-center gap-3 pt-4 relative z-20">
                <button
                  onClick={() => setStep("personality")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <button
                  onClick={() => advanceStep("review")}
                  className="btn-primary"
                >
                  Review
                </button>
              </div>
            </div>

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
                  Your picks for {displayName}
                </p>
                <p className="text-sm text-white text-center">Preferences</p>
              </div>
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto">
                <p className="text-lg font-semibold text-charcoal mb-3">Your picks</p>
                <div className="space-y-4 pl-3">
                  <div>
                    <p className="section-label mb-1.5">Humor level</p>
                    <p className="text-lg text-charcoal pl-5">
                      {humorTolerance
                        ? HUMOR_LEVELS.find((h) => h.id === humorTolerance)?.label ?? humorTolerance
                        : <span className="text-warm-gray italic">Not selected</span>
                      }
                    </p>
                  </div>
                  {personalDates.length > 0 && (
                    <div>
                      <p className="section-label mb-1.5">Personal dates</p>
                      <ul className="space-y-1.5 pl-5">
                        {personalDates.map((d, i) => (
                          <li key={i} className="text-lg text-charcoal">
                            {d.label}: {d.date} {d.recurring && "(yearly)"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {milestones.trim() && (
                    <div>
                      <p className="section-label mb-1.5">Milestones</p>
                      <p className="text-lg text-charcoal pl-5 whitespace-pre-wrap">{milestones.trim()}</p>
                    </div>
                  )}
                  {!humorTolerance && personalDates.length === 0 && !milestones.trim() && (
                    <p className="text-lg text-warm-gray italic pl-3">Select humor, add dates, or add milestones in the left column</p>
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
              Here&apos;s what Nuuge knows about {displayName}. Tap any section to edit.
            </p>

            <div className="space-y-4 mb-8">
              {/* Who */}
              <button
                onClick={() => setStep("who")}
                className="w-full card-surface p-4 text-left hover:border-sage transition-colors"
              >
                <p className="section-label mb-1">Who</p>
                <p className="text-lg text-charcoal font-medium">{displayName || "—"}</p>
                <p className="text-lg text-warm-gray">{resolvedRelationship}</p>
                {(firstName || lastName || nickname.trim()) && (
                  <p className="text-base text-warm-gray mt-1">
                    {[firstName, lastName].filter(Boolean).join(" ") && (
                      <span>First / last: {[firstName, lastName].filter(Boolean).join(" ")}</span>
                    )}
                    {nickname.trim() && (
                      <span className={firstName || lastName ? " · " : ""}>Nickname: {nickname.trim()}</span>
                    )}
                  </p>
                )}
                {lifestyle && (
                  <p className="text-base text-warm-gray mt-1">Life stage: {lifestyle}</p>
                )}
                {[addressStreet, addressCity, addressState, addressPostal].some((s) => s.trim()) && (
                  <p className="text-base text-warm-gray mt-1">
                    Address: {[addressStreet, addressCity, addressState, addressPostal].filter(Boolean).join(", ")}
                  </p>
                )}
              </button>

              {/* Personality & Interests */}
              <button
                onClick={() => setStep("personality")}
                className="w-full card-surface p-4 text-left hover:border-sage transition-colors"
              >
                <p className="section-label mb-1">Personality</p>
                <p className="text-lg text-charcoal">
                  {selectedTraits.length > 0 ? selectedTraits.join(", ") : <span className="text-warm-gray">None selected</span>}
                </p>
                <p className="section-label mt-3 mb-1">Interests</p>
                <p className="text-lg text-charcoal">
                  {selectedInterests.length > 0 ? selectedInterests.join(", ") : <span className="text-warm-gray">None selected</span>}
                </p>
              </button>

              {/* Preferences */}
              <button
                onClick={() => setStep("preferences")}
                className="w-full card-surface p-4 text-left hover:border-sage transition-colors"
              >
                <p className="section-label mb-1">Humor level</p>
                <p className="text-lg text-charcoal">
                  {humorTolerance
                    ? HUMOR_LEVELS.find((h) => h.id === humorTolerance)?.label || humorTolerance
                    : <span className="text-warm-gray">Not specified</span>
                  }
                </p>
                {personalDates.length > 0 && (
                  <>
                    <p className="section-label mt-3 mb-1">Personal dates</p>
                    <p className="text-lg text-charcoal">
                      {personalDates.map((d) => `${d.label}: ${d.date}`).join(", ")}
                    </p>
                  </>
                )}
                {milestones.trim() && (
                  <>
                    <p className="section-label mt-3 mb-1">Milestones &amp; important dates</p>
                    <p className="text-lg text-charcoal whitespace-pre-wrap">{milestones.trim()}</p>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("preferences")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={!displayName.trim() || !resolvedRelationship}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save {displayName}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

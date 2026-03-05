"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile, saveRecipient } from "@/lib/store";

// ─── Curated selection lists ────────────────────────────────────────

const RELATIONSHIP_TYPES = [
  "Parent", "Sibling", "Child", "Grandparent", "Grandchild",
  "Aunt / Uncle", "Niece / Nephew", "Cousin",
  "Friend", "Best friend",
  "Partner / Spouse",
  "Colleague", "Boss / Mentor",
  "Neighbor", "In-law",
];

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

const HUMOR_LEVELS = [
  { id: "serious", label: "Keep it sincere", desc: "No humor in cards" },
  { id: "light", label: "Light and gentle", desc: "A warm smile, nothing more" },
  { id: "warm", label: "Warm with a smile", desc: "Lighthearted but heartfelt" },
  { id: "playful", label: "Playful and fun", desc: "Jokes are welcome" },
  { id: "wild", label: "Go wild", desc: "The funnier the better" },
];

const TONE_PREFERENCES = [
  "Heartfelt and sincere",
  "Supportive and comforting",
  "Romantic and affectionate",
  "Joyful and celebratory",
  "Warm with a touch of humor",
  "Funny and playful",
  "Sarcastic and edgy",
  "Simple and understated",
];

const PERSONAL_DATE_TYPES = [
  "Birthday", "Anniversary", "Graduation", "Wedding",
  "Memorial", "Retirement", "Other",
];

// ─── Component ──────────────────────────────────────────────────────

type RecipientStep = "who" | "personality" | "preferences" | "review";

interface PersonalDate {
  label: string;
  date: string;
  recurring: boolean;
}

export default function NewRecipientPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userProfile, setUserProfile] = useState<ReturnType<typeof getUserProfile>>(null);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState<RecipientStep>("who");

  // Form state
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [humorTolerance, setHumorTolerance] = useState("");
  const [tonePreference, setTonePreference] = useState<string[]>([]);
  const [personalDates, setPersonalDates] = useState<PersonalDate[]>([]);
  const [addingDate, setAddingDate] = useState(false);
  const [newDateType, setNewDateType] = useState("Birthday");
  const [newDateValue, setNewDateValue] = useState("");
  const [milestones, setMilestones] = useState("");

  useEffect(() => {
    setMounted(true);
    setUserProfile(getUserProfile());
  }, []);

  if (!mounted) return null;

  if (!userProfile?.onboarding_complete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Hold on — we haven&apos;t met yet!
          </h1>
          <p className="text-gray-600 mb-8">
            Before adding people, let Nuuge get to know you first.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors"
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
    if (t && !selectedTraits.includes(t)) {
      setSelectedTraits((prev) => [...prev, t]);
      setCustomTrait("");
    }
  }

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function addCustomInterest() {
    const i = customInterest.trim();
    if (i && !selectedInterests.includes(i)) {
      setSelectedInterests((prev) => [...prev, i]);
      setCustomInterest("");
    }
  }

  function toggleTone(t: string) {
    setTonePreference((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 2 ? [...prev, t] : prev
    );
  }

  function addDate() {
    if (!newDateValue) return;
    setPersonalDates((prev) => [
      ...prev,
      { label: newDateType, date: newDateValue, recurring: newDateType !== "Memorial" },
    ]);
    setNewDateType("Birthday");
    setNewDateValue("");
    setAddingDate(false);
  }

  function removeDate(idx: number) {
    setPersonalDates((prev) => prev.filter((_, i) => i !== idx));
  }

  const resolvedRelationship = relationship === "__custom"
    ? customRelationship.trim()
    : relationship;

  function handleSave() {
    const milestonesArray = milestones
      .split("\n")
      .map((m) => m.trim())
      .filter(Boolean);

    saveRecipient({
      user_id: "local",
      name: recipientName.trim(),
      relationship_type: resolvedRelationship,
      personality_notes: selectedTraits.join(", ") || null,
      interests: selectedInterests,
      humor_tolerance: humorTolerance || null,
      tone_preference: tonePreference.join(", ") || "Not specified",
      important_dates: personalDates,
      milestones: milestonesArray,
    });
    setCompleted(true);
  }

  // ─── Completion screen ──────────────────────────────────────────

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {recipientName} is all set!
          </h1>
          <p className="text-gray-600 mb-8">
            Nuuge now knows enough to create personalized cards for {recipientName}.
          </p>
          <button
            onClick={() => {
              setCompleted(false);
              setStep("who");
              setRecipientName("");
              setRelationship("");
              setCustomRelationship("");
              setSelectedTraits([]);
              setSelectedInterests([]);
              setHumorTolerance("");
              setTonePreference([]);
              setPersonalDates([]);
              setMilestones("");
            }}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors mr-3"
          >
            Add another person
          </button>
          <button
            onClick={() => router.push("/")}
            className="bg-white text-indigo-600 border border-indigo-200 px-8 py-3 rounded-xl
                       font-medium hover:bg-indigo-50 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Wizard ───────────────────────────────────────────────────

  const stepNumber = step === "who" ? 1 : step === "personality" ? 2 : step === "preferences" ? 3 : 4;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {recipientName ? `About ${recipientName}` : "Add a person"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`w-8 h-1.5 rounded-full transition-colors ${
                  n <= stepNumber ? "bg-indigo-500" : "bg-gray-200"
                }`}
              />
            ))}
            <span className="text-xs text-gray-400 ml-2">Step {stepNumber} of 4</span>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-400 hover:text-gray-600 ml-4"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">

        {/* ─── Step 1: Who ─── */}
        {step === "who" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Who is this person?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Their name and how they&apos;re connected to you.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Their name
                </label>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="First name or nickname"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {RELATIONSHIP_TYPES.map((rel) => (
                    <button
                      key={rel}
                      onClick={() => { setRelationship(rel); setCustomRelationship(""); }}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors
                        ${relationship === rel
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                      {rel}
                    </button>
                  ))}
                  <button
                    onClick={() => setRelationship("__custom")}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors
                      ${relationship === "__custom"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    Other...
                  </button>
                </div>
                {relationship === "__custom" && (
                  <input
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value)}
                    placeholder="e.g. Godparent, Roommate..."
                    autoFocus
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                               outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 mt-2"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => router.push("/")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Dashboard
              </button>
              <button
                onClick={() => setStep("personality")}
                disabled={!recipientName.trim() || !resolvedRelationship}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Personality & Interests ─── */}
        {step === "personality" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              What is {recipientName} like?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              This helps Nuuge write messages that feel right for them.
            </p>

            {/* Personality */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personality — pick a few that fit {recipientName}
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PERSONALITY_TRAITS.map((trait) => (
                  <button
                    key={trait}
                    onClick={() => toggleTrait(trait)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors
                      ${selectedTraits.includes(trait)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {trait}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={customTrait}
                  onChange={(e) => setCustomTrait(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomTrait()}
                  placeholder="Add your own..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500"
                />
                <button
                  onClick={addCustomTrait}
                  disabled={!customTrait.trim()}
                  className="text-sm text-indigo-600 font-medium px-3 disabled:text-gray-300"
                >
                  Add
                </button>
              </div>
              {selectedTraits.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Selected: {selectedTraits.join(", ")}
                </p>
              )}
            </div>

            {/* Interests */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {recipientName}&apos;s interests
              </label>
              {Object.entries(INTEREST_CATEGORIES).map(([category, items]) => (
                <div key={category} className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((interest) => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors
                          ${selectedInterests.includes(interest)
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomInterest()}
                  placeholder="Add your own interest..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500"
                />
                <button
                  onClick={addCustomInterest}
                  disabled={!customInterest.trim()}
                  className="text-sm text-indigo-600 font-medium px-3 disabled:text-gray-300"
                >
                  Add
                </button>
              </div>
              {selectedInterests.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Selected: {selectedInterests.join(", ")}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("who")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("preferences")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Card Preferences ─── */}
        {step === "preferences" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Card preferences for {recipientName}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              What kind of cards work best for {recipientName}?
            </p>

            {/* Humor tolerance */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How much humor in their cards?
              </label>
              <div className="space-y-2">
                {HUMOR_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setHumorTolerance(level.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                      ${humorTolerance === level.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white hover:border-indigo-300"
                      }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{level.label}</span>
                    <span className="text-xs text-gray-500 ml-2">— {level.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone preference */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred tone for cards (pick 1-2)
              </label>
              <div className="flex flex-wrap gap-2">
                {TONE_PREFERENCES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTone(t)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors
                      ${tonePreference.includes(t)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Personal dates */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal dates
              </label>
              {personalDates.length > 0 && (
                <div className="space-y-2 mb-3">
                  {personalDates.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700">
                        {d.label}: {d.date} {d.recurring && <span className="text-xs text-gray-400">(yearly)</span>}
                      </span>
                      <button
                        onClick={() => removeDate(i)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {addingDate ? (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <div className="flex flex-wrap gap-2">
                      {PERSONAL_DATE_TYPES.map((dt) => (
                        <button
                          key={dt}
                          onClick={() => setNewDateType(dt)}
                          className={`px-3 py-1 rounded-full text-xs transition-colors
                            ${newDateType === dt
                              ? "bg-indigo-600 text-white"
                              : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
                            }`}
                        >
                          {dt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={newDateValue}
                      onChange={(e) => setNewDateValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                                 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addDate}
                      disabled={!newDateValue}
                      className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add date
                    </button>
                    <button
                      onClick={() => setAddingDate(false)}
                      className="text-sm text-gray-400 hover:text-gray-600 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingDate(true)}
                  className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
                >
                  + Add a date (birthday, anniversary, etc.)
                </button>
              )}
            </div>

            {/* Milestones & important dates */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Milestones &amp; important dates
              </label>
              <textarea
                value={milestones}
                onChange={(e) => setMilestones(e.target.value)}
                rows={3}
                placeholder={"e.g. Graduated college 2024\nFirst marathon 2023\nGot promoted last year"}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">Optional — one per line. These help Nuuge reference meaningful moments.</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("personality")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("review")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Review ─── */}
        {step === "review" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Look good?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Here&apos;s what Nuuge knows about {recipientName}. Tap any section to edit.
            </p>

            <div className="space-y-4 mb-8">
              {/* Who */}
              <button
                onClick={() => setStep("who")}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 transition-colors"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Who</p>
                <p className="text-sm text-gray-900 font-medium">{recipientName}</p>
                <p className="text-sm text-gray-500">{resolvedRelationship}</p>
              </button>

              {/* Personality & Interests */}
              <button
                onClick={() => setStep("personality")}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 transition-colors"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Personality</p>
                <p className="text-sm text-gray-700">
                  {selectedTraits.length > 0 ? selectedTraits.join(", ") : <span className="text-gray-400">None selected</span>}
                </p>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Interests</p>
                <p className="text-sm text-gray-700">
                  {selectedInterests.length > 0 ? selectedInterests.join(", ") : <span className="text-gray-400">None selected</span>}
                </p>
              </button>

              {/* Preferences */}
              <button
                onClick={() => setStep("preferences")}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 transition-colors"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Humor level</p>
                <p className="text-sm text-gray-700">
                  {humorTolerance
                    ? HUMOR_LEVELS.find((h) => h.id === humorTolerance)?.label || humorTolerance
                    : <span className="text-gray-400">Not specified</span>
                  }
                </p>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Preferred tone</p>
                <p className="text-sm text-gray-700">
                  {tonePreference.length > 0 ? tonePreference.join(", ") : <span className="text-gray-400">Not specified</span>}
                </p>
                {personalDates.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Personal dates</p>
                    <p className="text-sm text-gray-700">
                      {personalDates.map((d) => `${d.label}: ${d.date}`).join(", ")}
                    </p>
                  </>
                )}
                {milestones.trim() && (
                  <>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Milestones &amp; important dates</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{milestones.trim()}</p>
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("preferences")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSave}
                disabled={!recipientName.trim() || !resolvedRelationship}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save {recipientName}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

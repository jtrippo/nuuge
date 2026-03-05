"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveUserProfile, getUserProfile } from "@/lib/store";

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

const COMMUNICATION_STYLES = [
  { id: "sentimental", label: "Big and sentimental", desc: "I go all-in on feelings" },
  { id: "short", label: "Short and sweet", desc: "A few genuine words" },
  { id: "funny", label: "Funny first", desc: "Humor is how I show love" },
  { id: "thoughtful", label: "Thoughtful and specific", desc: "I reference details that matter" },
  { id: "understated", label: "Simple and understated", desc: "Less is more" },
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
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [commStyle, setCommStyle] = useState<string[]>([]);
  const [lifestyle, setLifestyle] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [humorStyle, setHumorStyle] = useState("");

  useEffect(() => {
    setMounted(true);
    const existing = getUserProfile();
    if (existing?.onboarding_complete) {
      setCompleted(true);
    }
  }, []);

  if (!mounted) return null;

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

  function toggleCommStyle(id: string) {
    setCommStyle((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  }

  const showPartner = ["In a relationship", "Married"].includes(lifestyle);

  function handleSave() {
    const commLabels = COMMUNICATION_STYLES
      .filter((s) => commStyle.includes(s.id))
      .map((s) => s.label);

    saveUserProfile({
      display_name: name.trim(),
      personality: selectedTraits.join(", "),
      humor_style: humorStyle || null,
      interests: selectedInterests,
      values: [],
      birthday: birthday || null,
      lifestyle: lifestyle || null,
      partner_name: showPartner && partnerName.trim() ? partnerName.trim() : null,
      communication_style: commLabels.join(", ") || null,
      onboarding_complete: true,
    });
    setCompleted(true);
  }

  // ─── Completion screen ──────────────────────────────────────────

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#10024;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            You&apos;re all set!
          </h1>
          <p className="text-gray-600 mb-8">
            Nuuge knows you now. Next, add someone you&apos;d like to send cards to.
          </p>
          <button
            onClick={() => router.push("/recipients/new")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors mr-3"
          >
            Add someone
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

  // ─── Intro screen ──────────────────────────────────────────────

  if (step === "intro") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to Nuuge
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Cards that actually sound like you.
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 text-left">
            <h2 className="text-md font-semibold text-gray-900 mb-4">
              Here&apos;s how this works
            </h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex gap-3">
                <span className="text-indigo-500 font-bold text-base mt-[-2px]">1</span>
                <p>
                  <span className="font-medium text-gray-800">Quick setup.</span>{" "}
                  Tell Nuuge a bit about yourself — your personality, what you&apos;re into,
                  how you like to communicate. Takes about a minute.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-500 font-bold text-base mt-[-2px]">2</span>
                <p>
                  <span className="font-medium text-gray-800">Add your people.</span>{" "}
                  For each person you send cards to, tell us a little about them
                  and your relationship.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-500 font-bold text-base mt-[-2px]">3</span>
                <p>
                  <span className="font-medium text-gray-800">Nuuge creates cards for you.</span>{" "}
                  Using what it knows about you and the recipient, Nuuge writes messages
                  and designs cards that feel genuinely personal.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep("basics")}
            className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-lg font-medium
                       hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            About you
          </h1>
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
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">

        {/* ─── Step 1: Basics ─── */}
        {step === "basics" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              The basics
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Just your name and birthday so Nuuge knows who&apos;s sending the cards.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name or nickname"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birthday
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="text-xs text-gray-400 mt-1">Optional — helps Nuuge remember your birthday</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep("intro")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("about")}
                disabled={!name.trim()}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: About You ─── */}
        {step === "about" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              A little about you
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Pick the traits and interests that fit. These help Nuuge write messages that sound like you.
            </p>

            {/* Personality traits */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personality — pick a few that fit
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
                Interests — what are you into?
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
                onClick={() => setStep("basics")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("style")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Your Style ─── */}
        {step === "style" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              How you communicate
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              This helps Nuuge match your natural voice when writing card messages.
            </p>

            {/* Communication style */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When you write a card, you tend to be... (pick 1-2)
              </label>
              <div className="space-y-2">
                {COMMUNICATION_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => toggleCommStyle(style.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                      ${commStyle.includes(style.id)
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white hover:border-indigo-300"
                      }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{style.label}</span>
                    <span className="text-xs text-gray-500 ml-2">— {style.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Humor */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your sense of humor
              </label>
              <input
                value={humorStyle}
                onChange={(e) => setHumorStyle(e.target.value)}
                placeholder="e.g. dry wit, dad jokes, goofy, deadpan, puns..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="text-xs text-gray-400 mt-1">Optional — helps Nuuge know when and how to be funny</p>
            </div>

            {/* Lifestyle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Life stage
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {LIFESTYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setLifestyle(lifestyle === opt ? "" : opt)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors
                      ${lifestyle === opt
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {showPartner && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Partner&apos;s name
                  </label>
                  <input
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="For co-signing cards together"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                               outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <p className="text-xs text-gray-400 mt-1">Optional — so you can sign cards &ldquo;from both of us&rdquo;</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("about")}
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
              Here&apos;s what Nuuge will use to write cards that sound like you. Tap any section to go back and edit.
            </p>

            <div className="space-y-4 mb-8">
              {/* Basics */}
              <button
                onClick={() => setStep("basics")}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 transition-colors"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Basics</p>
                <p className="text-sm text-gray-900 font-medium">{name}</p>
                {birthday && <p className="text-sm text-gray-500">Birthday: {birthday}</p>}
              </button>

              {/* Personality & Interests */}
              <button
                onClick={() => setStep("about")}
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

              {/* Style */}
              <button
                onClick={() => setStep("style")}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 transition-colors"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Communication style</p>
                <p className="text-sm text-gray-700">
                  {commStyle.length > 0
                    ? COMMUNICATION_STYLES.filter((s) => commStyle.includes(s.id)).map((s) => s.label).join(", ")
                    : <span className="text-gray-400">Not specified</span>
                  }
                </p>
                {humorStyle && (
                  <>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Humor</p>
                    <p className="text-sm text-gray-700">{humorStyle}</p>
                  </>
                )}
                {lifestyle && (
                  <>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Life stage</p>
                    <p className="text-sm text-gray-700">
                      {lifestyle}
                      {showPartner && partnerName.trim() ? ` — partner: ${partnerName.trim()}` : ""}
                    </p>
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("style")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSave}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
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

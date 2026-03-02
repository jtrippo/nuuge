"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getUserProfile,
  getRecipients,
  getCardsForRecipient,
  saveCard,
} from "@/lib/store";
import type { Recipient, UserProfile } from "@/types/database";

const OCCASIONS = [
  "Birthday",
  "Anniversary",
  "Thank You",
  "Congratulations",
  "Get Well",
  "Thinking of You",
  "Holiday",
  "Just Because",
  "Sympathy",
  "Encouragement",
  "New Baby",
  "Graduation",
  "Retirement",
];

const TONES = [
  "Heartfelt and sincere",
  "Warm with a touch of humor",
  "Funny and playful",
  "Sarcastic and edgy",
  "Simple and understated",
  "Sentimental and emotional",
  "Lighthearted and casual",
];

interface CardMessage {
  label: string;
  greeting: string;
  body: string;
  closing: string;
}

type Step =
  | "occasion"
  | "tone"
  | "notes"
  | "generating"
  | "select"
  | "preview"
  | "design_loading"
  | "design_pick"
  | "design_generating"
  | "design_preview"
  | "delivery"
  | "saved";

interface DesignConcept {
  title: string;
  description: string;
  image_prompt: string;
}

export default function CreateCardPage() {
  const router = useRouter();
  const params = useParams();
  const recipientId = params.recipientId as string;

  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<Step>("occasion");
  const [occasion, setOccasion] = useState("");
  const [tone, setTone] = useState("");
  const [notes, setNotes] = useState("");
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [coSign, setCoSign] = useState(false);
  const [messages, setMessages] = useState<CardMessage[]>([]);
  const [selected, setSelected] = useState<CardMessage | null>(null);
  const [editedMessage, setEditedMessage] = useState<CardMessage | null>(null);
  const [designConcepts, setDesignConcepts] = useState<DesignConcept[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignConcept | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [designFeedback, setDesignFeedback] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"digital" | "print_at_home" | "mail">("digital");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setProfile(getUserProfile());
    const all = getRecipients();
    setAllRecipients(all);
    const found = all.find((r) => r.id === recipientId);
    if (found) setRecipient(found);
  }, [recipientId]);

  if (!mounted) return null;

  if (!recipient) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white">
        <p className="text-gray-500 mb-4">Person not found.</p>
        <button
          onClick={() => router.push("/")}
          className="text-indigo-600 font-medium"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  function buildContextString(
    p: Partial<UserProfile> | null,
    r: Recipient
  ) {
    const sender = p
      ? `Name: ${p.display_name || "Unknown"}
Personality: ${p.personality || "Not specified"}
Humor style: ${p.humor_style || "Not specified"}
Interests: ${(p.interests || []).join(", ") || "Not specified"}
Lifestyle: ${p.lifestyle || "Not specified"}`
      : "No sender context available.";

    const recipientCtx = `Name: ${r.name}
Relationship: ${r.relationship_type}
Personality: ${r.personality_notes || "Not specified"}
Interests: ${(r.interests || []).join(", ") || "Not specified"}
Humor tolerance: ${r.humor_tolerance || "Not specified"}
Tone preference: ${r.tone_preference || "Not specified"}`;

    return { sender, recipient: recipientCtx };
  }

  async function generateMessages() {
    setStep("generating");
    setError(null);

    const ctx = buildContextString(profile, recipient!);
    const pastCards = getCardsForRecipient(recipient!.id);
    const cardHistory = pastCards.map(
      (c) => `[${c.occasion}] ${c.message_text}`
    );

    try {
      const res = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderContext: ctx.sender,
          recipientContext: ctx.recipient,
          occasion,
          tone,
          additionalNotes: notes,
          cardHistory,
          coSignWith: coSign ? profile?.partner_name : null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate");
      }

      const data = await res.json();
      setMessages(data.messages);
      setStep("select");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStep("notes");
    }
  }

  function selectMessage(msg: CardMessage) {
    setSelected(msg);
    setEditedMessage({ ...msg });
    setStep("preview");
  }

  const linkedRecipients = recipient
    ? (recipient.links || [])
        .map((link) => {
          const linked = allRecipients.find((r) => r.id === link.recipient_id);
          return linked ? { ...linked, linkLabel: link.label } : null;
        })
        .filter(Boolean) as (Recipient & { linkLabel: string })[]
    : [];

  const SHARED_OCCASIONS = ["Anniversary", "Holiday"];
  const showShareOption =
    linkedRecipients.length > 0 && SHARED_OCCASIONS.includes(occasion);

  async function loadDesignSuggestions() {
    if (!editedMessage || !recipient) return;
    setStep("design_loading");
    setError(null);

    const ctx = buildContextString(profile, recipient);
    const fullMessage = `${editedMessage.greeting}\n${editedMessage.body}\n${editedMessage.closing}`;

    try {
      const res = await fetch("/api/suggest-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderContext: ctx.sender,
          recipientContext: ctx.recipient,
          occasion,
          tone,
          messageText: fullMessage,
          additionalNotes: notes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to suggest designs");
      }

      const data = await res.json();
      setDesignConcepts(data.designs);
      setStep("design_pick");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStep("preview");
    }
  }

  async function generateDesignImage(prompt: string, refinement?: string) {
    setStep("design_generating");
    setError(null);
    setDesignFeedback("");

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: prompt,
          refinement,
          userId: "local",
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate image");
      }

      const data = await res.json();
      setGeneratedImageUrl(data.imageUrl);
      setStep("design_preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStep("design_pick");
    }
  }

  function handleSave() {
    if (!editedMessage || !recipient) return;
    const fullText = `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${editedMessage.closing}`;
    const allRecipientIds = [recipient.id, ...sharedWith];
    saveCard({
      user_id: "local",
      recipient_id: recipient.id,
      recipient_ids: allRecipientIds,
      occasion,
      message_text: fullText,
      image_url: generatedImageUrl,
      image_prompt: selectedDesign?.image_prompt || null,
      tone_used: tone,
      style: editedMessage.label,
      delivery_method: deliveryMethod,
      sent: false,
      co_signed_with: coSign ? profile?.partner_name || null : null,
    });
    setStep("saved");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Dashboard
          </button>
          <span className="text-sm text-gray-500">
            Card for {recipient.name}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Step: Occasion */}
        {step === "occasion" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              What&apos;s the occasion?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Creating a card for {recipient.name} ({recipient.relationship_type})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => {
                    setOccasion(o);
                    setStep("tone");
                  }}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm
                             text-gray-700 hover:border-indigo-400 hover:text-indigo-600
                             transition-colors text-left"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Tone */}
        {step === "tone" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              What tone should this card have?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {occasion} card for {recipient.name}
            </p>
            <div className="grid gap-3">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTone(t);
                    setStep("notes");
                  }}
                  className="bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm
                             text-gray-700 hover:border-indigo-400 hover:text-indigo-600
                             transition-colors text-left"
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("occasion")}
              className="text-sm text-gray-400 hover:text-gray-600 mt-4"
            >
              &larr; Back
            </button>
          </div>
        )}

        {/* Step: Additional notes */}
        {step === "notes" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Anything else Nuuge should know?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Optional — add any recent updates, inside jokes, or specific things
              you want mentioned. Or leave it blank and let Nuuge work with what
              it knows.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={`e.g. "We just got back from a trip to Italy together" or "He just got promoted at work"`}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                         outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100
                         transition-colors mb-4"
            />
            {showShareOption && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Show this card on linked profiles too?
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Since this is a shared occasion, you can save it to both profiles.
                </p>
                {linkedRecipients.map((lr) => (
                  <label key={lr.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={sharedWith.includes(lr.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSharedWith([...sharedWith, lr.id]);
                        } else {
                          setSharedWith(sharedWith.filter((id) => id !== lr.id));
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {lr.name}
                    <span className="text-xs text-gray-400 capitalize">({lr.linkLabel})</span>
                  </label>
                ))}
              </div>
            )}
            {profile?.partner_name && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={coSign}
                    onChange={(e) => setCoSign(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Sign from both {profile.display_name} &amp; {profile.partner_name}
                </label>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("tone")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={generateMessages}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Generate card messages
              </button>
            </div>
          </div>
        )}

        {/* Step: Generating */}
        {step === "generating" && (
          <div className="text-center py-20">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
            <p className="text-gray-500">
              Nuuge is writing your {occasion.toLowerCase()} card for{" "}
              {recipient.name}...
            </p>
          </div>
        )}

        {/* Step: Select from options */}
        {step === "select" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Pick your favorite
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Here are 3 options for {recipient.name}&apos;s {occasion.toLowerCase()} card.
              Click one to preview and edit.
            </p>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => selectMessage(msg)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left
                             hover:border-indigo-400 transition-colors"
                >
                  <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
                    {msg.label}
                  </span>
                  <p className="text-sm text-gray-800 mt-2 font-medium">
                    {msg.greeting}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{msg.body}</p>
                  <p className="text-sm text-gray-600 mt-1 italic">
                    {msg.closing}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("notes")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={generateMessages}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800 px-4 py-2"
              >
                Regenerate all
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview & Edit */}
        {step === "preview" && editedMessage && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Preview &amp; edit
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Adjust anything you want, then save.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Greeting
                </label>
                <input
                  value={editedMessage.greeting}
                  onChange={(e) =>
                    setEditedMessage({ ...editedMessage, greeting: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Message
                </label>
                <textarea
                  value={editedMessage.body}
                  onChange={(e) =>
                    setEditedMessage({ ...editedMessage, body: e.target.value })
                  }
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Closing
                </label>
                <input
                  value={editedMessage.closing}
                  onChange={(e) =>
                    setEditedMessage({ ...editedMessage, closing: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Card visual preview */}
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">
                Card preview
              </p>
              <div className="max-w-sm mx-auto bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-8 border border-indigo-100">
                <p className="text-lg font-medium text-gray-800 mb-3">
                  {editedMessage.greeting}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                  {editedMessage.body}
                </p>
                <p className="text-sm text-gray-600 italic">
                  {editedMessage.closing}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("select")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Pick a different one
              </button>
              <button
                onClick={loadDesignSuggestions}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Next: Design the card
              </button>
            </div>
          </div>
        )}

        {/* Step: Design loading */}
        {step === "design_loading" && (
          <div className="text-center py-20">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
            <p className="text-gray-500">
              Nuuge is dreaming up card designs for {recipient.name}...
            </p>
          </div>
        )}

        {/* Step: Pick a design concept */}
        {step === "design_pick" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Choose a card design direction
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Pick a concept and Nuuge will create the artwork. You can refine it after.
            </p>
            <div className="space-y-3">
              {designConcepts.map((concept, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDesign(concept);
                    generateDesignImage(concept.image_prompt);
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left
                             hover:border-indigo-400 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {concept.title}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">{concept.description}</p>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-2">
                Or describe your own idea:
              </p>
              <div className="flex gap-2">
                <input
                  value={designFeedback}
                  onChange={(e) => setDesignFeedback(e.target.value)}
                  placeholder="e.g. Two birds in a nest with baby birds..."
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={() => {
                    if (!designFeedback.trim()) return;
                    const custom: DesignConcept = {
                      title: "Custom",
                      description: designFeedback,
                      image_prompt: `Greeting card illustration: ${designFeedback}. Clean composition, no text, visually appealing, suitable for a ${occasion.toLowerCase()} card with a ${tone.toLowerCase()} tone.`,
                    };
                    setSelectedDesign(custom);
                    generateDesignImage(custom.image_prompt);
                  }}
                  disabled={!designFeedback.trim()}
                  className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-medium
                             hover:bg-indigo-700 transition-colors disabled:bg-gray-300"
                >
                  Generate
                </button>
              </div>
            </div>
            <button
              onClick={() => setStep("preview")}
              className="text-sm text-gray-400 hover:text-gray-600 mt-4"
            >
              &larr; Back to message
            </button>
          </div>
        )}

        {/* Step: Design generating */}
        {step === "design_generating" && (
          <div className="text-center py-20">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" />
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
            <p className="text-gray-500">
              Creating your card artwork...
            </p>
            <p className="text-xs text-gray-400 mt-2">
              This usually takes 10-15 seconds
            </p>
          </div>
        )}

        {/* Step: Design preview & iterate */}
        {step === "design_preview" && generatedImageUrl && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Your card design
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {selectedDesign?.title} — refine it or move on to delivery.
            </p>

            {/* Card front */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 text-center">
                Card front
              </p>
              <img
                src={generatedImageUrl}
                alt="Card design"
                className="w-full max-w-md mx-auto rounded-lg"
              />
            </div>

            {/* Card inside preview */}
            {editedMessage && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 text-center">
                  Card inside
                </p>
                <div className="max-w-sm mx-auto bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                  <p className="text-base font-medium text-gray-800 mb-2">
                    {editedMessage.greeting}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap">
                    {editedMessage.body}
                  </p>
                  <p className="text-sm text-gray-600 italic">
                    {editedMessage.closing}
                  </p>
                </div>
              </div>
            )}

            {/* Refinement input */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                Want to adjust the design?
              </p>
              <div className="flex gap-2">
                <input
                  value={designFeedback}
                  onChange={(e) => setDesignFeedback(e.target.value)}
                  placeholder="e.g. Make it more colorful, add a sunset background..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={() => {
                    if (!selectedDesign) return;
                    generateDesignImage(
                      selectedDesign.image_prompt,
                      designFeedback
                    );
                  }}
                  disabled={!designFeedback.trim()}
                  className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg text-sm
                             font-medium hover:bg-indigo-50 transition-colors disabled:text-gray-300
                             disabled:border-gray-200"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDesignFeedback("");
                  setStep("design_pick");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Pick different design
              </button>
              <button
                onClick={() => setStep("delivery")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Next: Choose delivery
              </button>
            </div>
          </div>
        )}

        {/* Step: Delivery */}
        {step === "delivery" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              How should this card be delivered?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {occasion} card for {recipient.name}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setDeliveryMethod("digital"); handleSave(); }}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left
                           hover:border-indigo-400 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">
                  Send digitally
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  Delivered via a link with an animated envelope opening experience
                </p>
              </button>
              <button
                onClick={() => { setDeliveryMethod("print_at_home"); handleSave(); }}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left
                           hover:border-indigo-400 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">
                  Print at home
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  Download a print-ready PDF to fold and give in person
                </p>
              </button>
              <button
                onClick={() => { setDeliveryMethod("mail"); handleSave(); }}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left
                           hover:border-indigo-400 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">
                  Mail it
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  Nuuge prints and mails a physical card (requires recipient address)
                </p>
              </button>
            </div>
            <button
              onClick={() => setStep("design_preview")}
              className="text-sm text-gray-400 hover:text-gray-600 mt-4"
            >
              &larr; Back to design
            </button>
          </div>
        )}

        {/* Step: Saved */}
        {step === "saved" && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Card saved!
            </h2>
            <p className="text-gray-500 mb-8">
              Your {occasion.toLowerCase()} card for {recipient.name} is ready
              {deliveryMethod === "digital" && " to send"}.
            </p>
            {deliveryMethod === "digital" && (
              <button
                onClick={() => {
                  const cards = getCardsForRecipient(recipient!.id);
                  const latest = cards[cards.length - 1];
                  if (latest) router.push(`/cards/view/${latest.id}`);
                }}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors mb-4 block mx-auto"
              >
                Preview &amp; share
              </button>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setStep("occasion");
                  setOccasion("");
                  setTone("");
                  setNotes("");
                  setMessages([]);
                  setSelected(null);
                  setEditedMessage(null);
                  setDesignConcepts([]);
                  setSelectedDesign(null);
                  setGeneratedImageUrl(null);
                  setDesignFeedback("");
                }}
                className="bg-white text-indigo-600 border border-indigo-200 px-6 py-3 rounded-xl
                           font-medium hover:bg-indigo-50 transition-colors"
              >
                Create another card
              </button>
              <button
                onClick={() => router.push("/")}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

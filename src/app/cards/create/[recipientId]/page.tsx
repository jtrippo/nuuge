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
import {
  SUBJECT_RECIPES,
  STYLE_RECIPES,
  MOOD_RECIPES,
  buildRecipePrompt,
  getMoodRecipe,
  toneToMoodId,
  pickRandom,
  calculateAge,
} from "@/lib/card-recipes";

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
  "Supportive and comforting",
  "Romantic and affectionate",
  "Joyful and celebratory",
  "Warm with a touch of humor",
  "Funny and playful",
  "Sarcastic and edgy",
  "Simple and understated",
];

/** Derived from recipes for backward compat with suggest-designs / view pages */
const TONE_TO_VISUAL: Record<string, string> = Object.fromEntries(
  MOOD_RECIPES.map((m) => [m.label, m.promptSnippets.join(". ")])
);

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
  | "design_subject"
  | "design_style"
  | "design_context"
  | "design_confirm_prompt"
  | "design_loading"
  | "design_pick"
  | "design_generating"
  | "design_confirm_refinement"
  | "design_preview"
  | "inside_design_ask"
  | "inside_position_pick"
  | "inside_design_loading"
  | "inside_design_pick"
  | "inside_design_generating"
  | "inside_design_preview"
  | "inside_confirm_refinement"
  | "front_text_loading"
  | "front_text"
  | "delivery"
  | "saved";

interface DesignConcept {
  title: string;
  description: string;
  image_prompt: string;
}

const IMAGE_SUBJECTS = SUBJECT_RECIPES.map((s) => ({
  id: s.id, label: s.label, emoji: s.emoji, examples: s.examples,
}));

const ART_STYLES = STYLE_RECIPES.map((s) => ({
  id: s.id, label: s.label, desc: s.desc,
}));


const INSIDE_POSITIONS = [
  { id: "top" as const, label: "Top banner", desc: "Horizontal strip across the top", icon: "▬ top", orientation: "horizontal" as const },
  { id: "middle" as const, label: "Middle band", desc: "Horizontal strip across the middle", icon: "▬ mid", orientation: "horizontal" as const },
  { id: "bottom" as const, label: "Bottom banner", desc: "Horizontal strip across the bottom", icon: "▬ btm", orientation: "horizontal" as const },
  { id: "left" as const, label: "Left edge", desc: "Vertical strip along the left", icon: "▮ left", orientation: "vertical" as const },
  { id: "right" as const, label: "Right edge", desc: "Vertical strip along the right", icon: "▮ right", orientation: "vertical" as const },
  { id: "behind" as const, label: "Watermark", desc: "Faded behind the text", icon: "◻ behind", orientation: "square" as const },
] as const;

type InsidePosition = typeof INSIDE_POSITIONS[number]["id"];

type SubjectId = string;
type StyleId = string;

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
  const [rejectedMessages, setRejectedMessages] = useState<string[]>([]);
  const [regenerationCount, setRegenerationCount] = useState(0);
  const [selected, setSelected] = useState<CardMessage | null>(null);
  const [editedMessage, setEditedMessage] = useState<CardMessage | null>(null);
  const [imageSubject, setImageSubject] = useState<SubjectId | null>(null);
  const [subjectDetail, setSubjectDetail] = useState("");
  const [artStyle, setArtStyle] = useState<StyleId | null>(null);
  const [activeProfileElements, setActiveProfileElements] = useState<Record<string, boolean>>({});
  const [personalContext, setPersonalContext] = useState("");
  const [designConcepts, setDesignConcepts] = useState<DesignConcept[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignConcept | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [previousImageUrl, setPreviousImageUrl] = useState<string | null>(null);
  const [previousSceneDescription, setPreviousSceneDescription] = useState<string | null>(null);
  const [designFeedback, setDesignFeedback] = useState("");
  const [currentSceneDescription, setCurrentSceneDescription] = useState("");
  const [pendingSceneDescription, setPendingSceneDescription] = useState("");
  const [merging, setMerging] = useState(false);
  const [insideConcepts, setInsideConcepts] = useState<DesignConcept[]>([]);
  const [selectedInsideConcept, setSelectedInsideConcept] = useState<DesignConcept | null>(null);
  const [insideImageUrl, setInsideImageUrl] = useState<string | null>(null);
  const [previousInsideImageUrl, setPreviousInsideImageUrl] = useState<string | null>(null);
  const [insideSceneDescription, setInsideSceneDescription] = useState("");
  const [insideDesignFeedback, setInsideDesignFeedback] = useState("");
  const [insideMerging, setInsideMerging] = useState(false);
  const [pendingInsideScene, setPendingInsideScene] = useState("");
  const [insideImagePosition, setInsideImagePosition] = useState<"top" | "middle" | "bottom" | "left" | "right" | "behind">("top");
  const [skipInsideDesign, setSkipInsideDesign] = useState(false);
  const [frontTextSuggestion, setFrontTextSuggestion] = useState<{ wording: string; position: string } | null>(null);
  const [frontText, setFrontText] = useState("");
  const [frontTextPosition, setFrontTextPosition] = useState("bottom-right");
  const [frontTextStyle, setFrontTextStyle] = useState<"dark_box" | "white_box" | "plain">("dark_box");
  const [font, setFont] = useState<"sans" | "script" | "block">("sans");
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");
  const [deliveryMethod, setDeliveryMethod] = useState<"digital" | "print_at_home" | "mail">("digital");
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
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

  const FONT_STYLES: Record<"sans" | "script" | "block", React.CSSProperties> = {
    sans: { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" },
    script: { fontFamily: "'Georgia', 'Palatino', serif", fontStyle: "italic" },
    block: { fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  };

  function extractProfileElements(r: Recipient): Record<string, boolean> {
    const elements: Record<string, boolean> = {};
    (r.interests || []).forEach((i) => { if (i.trim()) elements[`interest: ${i.trim()}`] = true; });
    (r.values || []).forEach((v) => { if (v.trim()) elements[`value: ${v.trim()}`] = true; });
    if (r.personality_notes) elements[`personality: ${r.personality_notes}`] = true;
    if (r.humor_style) elements[`humor style: ${r.humor_style}`] = true;
    if (r.humor_tolerance) elements[`humor tolerance: ${r.humor_tolerance}`] = true;
    if (r.occupation) elements[`occupation: ${r.occupation}`] = true;
    if (r.lifestyle) elements[`lifestyle: ${r.lifestyle}`] = true;
    if (r.pets) elements[`pets: ${r.pets}`] = true;
    if (r.favorite_foods) elements[`favorite foods: ${r.favorite_foods}`] = true;
    if (r.favorite_music) elements[`favorite music: ${r.favorite_music}`] = true;
    return elements;
  }

  function buildContextString(
    p: Partial<UserProfile> | null,
    r: Recipient,
    profileElements?: Record<string, boolean>
  ) {
    const sender = p
      ? `Name: ${p.display_name || "Unknown"}
Personality: ${p.personality || "Not specified"}
Humor style: ${p.humor_style || "Not specified"}
Interests: ${(p.interests || []).join(", ") || "Not specified"}
Lifestyle: ${p.lifestyle || "Not specified"}`
      : "No sender context available.";

    const active = profileElements
      ? Object.entries(profileElements).filter(([, v]) => v).map(([k]) => k)
      : null;

    const age = calculateAge(r.birthday);
    const ageLine = age != null ? `Age: ${age}` : "";

    let recipientCtx: string;
    if (active && active.length > 0) {
      const interests = active.filter((e) => e.startsWith("interest: ")).map((e) => e.slice(10));
      const otherDetails = active.filter((e) => !e.startsWith("interest: ")).map((e) => {
        const [label, ...rest] = e.split(": ");
        return `${label.charAt(0).toUpperCase() + label.slice(1)}: ${rest.join(": ")}`;
      });
      recipientCtx = `Name: ${r.name}
Relationship: ${r.relationship_type}
${ageLine}
${interests.length > 0 ? `Interests: ${interests.join(", ")}` : "Interests: Not specified"}
${otherDetails.join("\n")}
Tone preference: ${r.tone_preference || "Not specified"}`.replace(/\n{2,}/g, "\n");
    } else if (active && active.length === 0) {
      recipientCtx = `Name: ${r.name}
Relationship: ${r.relationship_type}
${ageLine}
(No specific profile details selected — write a more universal, occasion-focused message.)`.replace(/\n{2,}/g, "\n");
    } else {
      recipientCtx = `Name: ${r.name}
Relationship: ${r.relationship_type}
${ageLine}
Personality: ${r.personality_notes || "Not specified"}
Interests: ${(r.interests || []).join(", ") || "Not specified"}
Humor tolerance: ${r.humor_tolerance || "Not specified"}
Tone preference: ${r.tone_preference || "Not specified"}`.replace(/\n{2,}/g, "\n");
    }

    return { sender, recipient: recipientCtx };
  }

  async function generateMessages() {
    let nextRegenCount = regenerationCount;
    if (messages.length > 0) {
      const currentAsText = messages.map(
        (m) => `[${m.label}] ${m.greeting} ${m.body} ${m.closing}`
      );
      setRejectedMessages((prev) => [...prev, ...currentAsText]);
      nextRegenCount = regenerationCount + 1;
      setRegenerationCount(nextRegenCount);

      // Progressively deactivate profile elements on each regeneration
      if (nextRegenCount >= 2) {
        const keys = Object.keys(activeProfileElements);
        const activeKeys = keys.filter((k) => activeProfileElements[k]);
        const keepCount = Math.max(0, Math.floor(activeKeys.length * (nextRegenCount === 2 ? 0.5 : 0.2)));
        const updated = { ...activeProfileElements };
        activeKeys.slice(keepCount).forEach((k) => { updated[k] = false; });
        setActiveProfileElements(updated);
      }
    }

    // Initialize profile elements on first generation
    if (Object.keys(activeProfileElements).length === 0 && recipient) {
      const elements = extractProfileElements(recipient);
      setActiveProfileElements(elements);
    }

    setStep("generating");
    setError(null);

    const elementsToUse = Object.keys(activeProfileElements).length > 0
      ? activeProfileElements
      : (recipient ? extractProfileElements(recipient) : undefined);

    const ctx = buildContextString(profile, recipient!, elementsToUse);
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
          relationshipType: recipient!.relationship_type,
          regenerationCount,
          rejectedMessages: rejectedMessages.length > 0 ? rejectedMessages : undefined,
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

    const elementsForDesign = Object.keys(activeProfileElements).length > 0
      ? activeProfileElements
      : undefined;
    const ctx = buildContextString(profile, recipient, elementsForDesign);
    const fullMessage = `${editedMessage.greeting}\n${editedMessage.body}\n${editedMessage.closing}`;

    const pastCards = getCardsForRecipient(recipient.id);
    const pastDesignThemes = pastCards
      .map((c) => c.image_prompt)
      .filter((p): p is string => Boolean(p));

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
          pastDesignThemes: pastDesignThemes.length > 0 ? pastDesignThemes : undefined,
          preferredSubject: imageSubject ? IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label : undefined,
          preferredStyle: artStyle ? ART_STYLES.find((s) => s.id === artStyle)?.label : undefined,
          preferredMood: TONE_TO_VISUAL[tone] || undefined,
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

  function getActiveInterests(): string[] {
    const hasToggles = Object.keys(activeProfileElements).length > 0;
    if (!hasToggles) return recipient?.interests || [];
    return Object.entries(activeProfileElements)
      .filter(([k, v]) => v && k.startsWith("interest: "))
      .map(([k]) => k.slice(10));
  }

  function buildImagePromptFromSelections(): string {
    if (!imageSubject || !artStyle) return "";

    const interests = getActiveInterests();
    const age = calculateAge(recipient?.birthday);
    return buildRecipePrompt({
      subjectId: imageSubject,
      subjectDetail: subjectDetail.trim() || undefined,
      tone,
      styleId: artStyle,
      personalContext: personalContext.trim() || undefined,
      profileInterests: interests.length > 0 ? interests : undefined,
      occasion,
      recipientAge: age,
      relationshipType: recipient?.relationship_type || undefined,
    });
  }

  function generateFromSelections() {
    const prompt = buildImagePromptFromSelections();
    setPendingSceneDescription(prompt);
    setStep("design_confirm_prompt");
  }

  async function generateDesignImage(
    prompt: string,
    options?: { isInside?: boolean; editExisting?: boolean }
  ) {
    const isInside = options?.isInside ?? false;
    const editExisting = options?.editExisting ?? false;
    const stepToSet = isInside ? "inside_design_generating" : "design_generating";
    setStep(stepToSet);
    setError(null);
    if (!isInside) setDesignFeedback("");

    const existingImage = editExisting
      ? (isInside ? insideImageUrl : generatedImageUrl)
      : null;

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: prompt,
          userId: "local",
          isInsideIllustration: isInside,
          cardSize: isInside ? undefined : cardSize,
          existingImageBase64: existingImage || undefined,
          insideImageSize: isInside ? insideImageSize() : undefined,
          frontImageBase64: isInside ? (generatedImageUrl || undefined) : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate image");
      }

      const data = await res.json();
      if (isInside) {
        setInsideImageUrl(data.imageUrl);
        setStep("inside_design_preview");
      } else {
        setGeneratedImageUrl(data.imageUrl);
        setStep("design_preview");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStep(isInside ? "inside_design_pick" : "design_pick");
    }
  }

  async function requestRefinement(change: string) {
    if (!change.trim()) return;
    setMerging(true);
    setError(null);

    const styleLabel = ART_STYLES.find((s) => s.id === artStyle)?.label;
    const moodRecipe = getMoodRecipe(tone);
    const moodSnippet = moodRecipe ? moodRecipe.promptSnippets[0] : "warm";
    const styleContext = styleLabel
      ? `\nIMPORTANT: Keep the art style as "${styleLabel}" and the mood as "${moodSnippet}". Do NOT change these unless the user explicitly asks.`
      : "";

    try {
      const res = await fetch("/api/merge-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentScene: currentSceneDescription + styleContext,
          change: change.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to merge scene");
      }
      const data = await res.json();
      setPendingSceneDescription(data.mergedScene);
      setStep("design_confirm_refinement");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setMerging(false);
    }
  }

  function insideImageOrientation(): "horizontal" | "vertical" | "square" {
    return INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.orientation ?? "horizontal";
  }

  function insideImageSize(): "1536x1024" | "1024x1536" | "1024x1024" {
    const o = insideImageOrientation();
    if (o === "horizontal") return "1536x1024";
    if (o === "vertical") return "1024x1536";
    return "1024x1024";
  }

  async function requestInsideRefinement(change: string) {
    if (!change.trim()) return;
    setInsideMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/merge-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentScene: insideSceneDescription,
          change: change.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to merge scene");
      }
      const data = await res.json();
      setPendingInsideScene(data.mergedScene);
      setStep("inside_confirm_refinement");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setInsideMerging(false);
    }
  }

  async function loadFrontTextSuggestion() {
    setStep("front_text_loading");
    try {
      const res = await fetch("/api/suggest-front-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion,
          tone,
          recipientName: recipient?.name ?? "",
        }),
      });
      const data = await res.json();
      setFrontTextSuggestion(data);
      setFrontText(data.wording ?? "");
      setFrontTextPosition(data.position ?? "bottom-right");
    } catch {
      setFrontText("");
      setFrontTextPosition("bottom-right");
    }
    setStep("front_text");
  }

  function handleSave(options?: { deliveryMethodOverride?: "digital" | "print_at_home" | "mail" }) {
    if (!editedMessage || !recipient) return;
    const method = options?.deliveryMethodOverride ?? deliveryMethod;
    const fullText = `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${editedMessage.closing}`;
    const allRecipientIds = [recipient.id, ...sharedWith];
    const saved = saveCard({
      user_id: "local",
      recipient_id: recipient.id,
      recipient_ids: allRecipientIds,
      occasion,
      message_text: fullText,
      image_url: generatedImageUrl,
      image_prompt: selectedDesign?.image_prompt || null,
      inside_image_url: insideImageUrl,
      inside_image_prompt: selectedInsideConcept?.image_prompt || null,
      front_text: frontText.trim() || null,
      front_text_position: frontText.trim() ? frontTextPosition : null,
      front_text_style: frontTextStyle,
      front_text_font: font,
      font,
      inside_image_position: insideImageUrl ? insideImagePosition : undefined,
      image_subject: imageSubject,
      art_style: artStyle,
      image_mood: null,
      tone_used: tone,
      style: editedMessage.label,
      delivery_method: method,
      sent: false,
      co_signed_with: coSign ? profile?.partner_name || null : null,
      card_size: cardSize,
    }) as { id: string } | undefined;
    if (saved) {
      setSavedCardId(saved.id);
      setDeliveryMethod(method);
      if (method === "print_at_home") {
        router.push(`/cards/print/${saved.id}`);
        return;
      }
    }
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
            {/* Profile elements to include in message */}
            {recipient && (() => {
              const elements = Object.keys(activeProfileElements).length > 0
                ? activeProfileElements
                : extractProfileElements(recipient);
              if (Object.keys(activeProfileElements).length === 0 && Object.keys(elements).length > 0) {
                setTimeout(() => setActiveProfileElements(elements), 0);
              }
              const entries = Object.entries(elements);
              return entries.length > 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Profile details to use in the message
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Tap to remove any you don&apos;t want referenced. They&apos;ll stay in the profile.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entries.map(([key, active]) => (
                      <button
                        key={key}
                        onClick={() => setActiveProfileElements((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          active
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-gray-100 border-gray-200 text-gray-400 line-through"
                        }`}
                      >
                        {key.replace(/^[^:]+: /, "")}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

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
            {/* Profile element toggles for regeneration */}
            {Object.keys(activeProfileElements).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Profile details used
                  {regenerationCount > 0 && (
                    <span className="text-gray-400 normal-case ml-1">
                      — toggle off what you don&apos;t want
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(activeProfileElements).map(([key, active]) => (
                    <button
                      key={key}
                      onClick={() => setActiveProfileElements((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        active
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "bg-gray-100 border-gray-200 text-gray-400 line-through"
                      }`}
                    >
                      {key.replace(/^[^:]+: /, "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
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
                onClick={() => setStep("design_subject")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Next: Design the card
              </button>
            </div>
          </div>
        )}

        {/* Step: Design Subject (3-step builder — Step 1) */}
        {step === "design_subject" && (() => {
          const moodRec = getMoodRecipe(tone);
          const recommended = moodRec?.recommendedSubjects || [];
          const moodId = toneToMoodId(tone);
          const selectedSubjectRecipe = SUBJECT_RECIPES.find((s) => s.id === imageSubject);
          const sceneSketches = selectedSubjectRecipe?.sceneSketches[moodId] || [];

          return (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                Step 1 of 3
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              What should the picture show?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Pick the main subject for your card&apos;s front image.
              {recommended.length > 0 && (
                <span className="text-indigo-500"> Stars mark subjects that pair well with &ldquo;{tone.toLowerCase()}&rdquo;.</span>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {IMAGE_SUBJECTS.map((subj) => {
                const isRecommended = recommended.includes(subj.id);
                return (
                <button
                  key={subj.id}
                  onClick={() => setImageSubject(subj.id)}
                  className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all relative
                    ${imageSubject === subj.id
                      ? "border-indigo-500 bg-indigo-50 shadow-md"
                      : isRecommended
                        ? "border-indigo-200 bg-indigo-50/30 hover:border-indigo-400 hover:shadow-sm"
                        : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                    }`}
                >
                  {isRecommended && (
                    <span className="absolute top-1.5 right-2 text-indigo-400 text-xs" title="Recommended for this tone">★</span>
                  )}
                  <span className="text-3xl mb-2">{subj.emoji}</span>
                  <span className="text-sm font-semibold text-gray-900">{subj.label}</span>
                  <span className="text-xs text-gray-400 mt-1 text-center">{subj.examples}</span>
                </button>
                );
              })}
            </div>

            {imageSubject && (
              <>
                {sceneSketches.length > 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-2">
                      Scene ideas for {selectedSubjectRecipe?.label} + {tone.toLowerCase()}
                    </p>
                    <div className="space-y-1.5">
                      {sceneSketches.map((sketch, i) => (
                        <button
                          key={i}
                          onClick={() => setSubjectDetail(sketch)}
                          className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors
                            ${subjectDetail === sketch
                              ? "bg-indigo-100 text-indigo-800 font-medium"
                              : "text-gray-700 hover:bg-white/60"
                            }`}
                        >
                          &ldquo;{sketch}&rdquo;
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Tap to use a scene idea, or type your own below.
                    </p>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Get more specific (optional)
                  </label>
                  <input
                    value={subjectDetail}
                    onChange={(e) => setSubjectDetail(e.target.value)}
                    placeholder={`e.g. ${IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.examples || "describe what you want"}`}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                               outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("preview")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("design_style")}
                disabled={!imageSubject}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next: Choose a style
              </button>
            </div>
          </div>
          );
        })()}

        {/* Step: Art Style (4-step builder — Step 2) */}
        {step === "design_style" && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                Step 2 of 3
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Choose the artistic style
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              This sets the visual look and feel of your card.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {ART_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setArtStyle(style.id)}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left
                    ${artStyle === style.id
                      ? "border-indigo-500 bg-indigo-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                    }`}
                >
                  <span className="text-sm font-semibold text-gray-900">{style.label}</span>
                  <span className="text-xs text-gray-500 mt-1">{style.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("design_subject")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => {
                  if (!personalContext.trim()) {
                    const defaultContext = `Recipient: ${recipient!.name} (${recipient!.relationship_type}). ${
                      recipient!.interests?.length ? `Interests: ${recipient!.interests.join(", ")}.` : ""
                    } ${recipient!.personality_notes ? `Personality: ${recipient!.personality_notes}.` : ""}`;
                    setPersonalContext(defaultContext);
                  }
                  setStep("design_context");
                }}
                disabled={!artStyle}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next: Add personal touch
              </button>
            </div>
          </div>
        )}

        {/* Step: Personal Context (3-step builder — Step 3) */}
        {step === "design_context" && (() => {
          const moodRec = getMoodRecipe(tone);
          const palettePreview = moodRec ? pickRandom(moodRec.palette, 3).join(", ") : "";
          const lightingPreview = moodRec ? pickRandom(moodRec.lighting, 1)[0] : "";

          return (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                Step 3 of 3
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Add a personal touch
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Tell the AI what makes this card special. We&apos;ve pre-filled it from {recipient!.name}&apos;s
              profile, but you can edit or add anything.
            </p>

            <div className="mb-4">
              <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-3 w-full text-center">
                  <div>
                    <span className="block text-xs text-gray-400">Subject</span>
                    <span className="font-medium text-gray-800">
                      {IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label}
                      {subjectDetail && ` — ${subjectDetail}`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400">Style</span>
                    <span className="font-medium text-gray-800">
                      {ART_STYLES.find((s) => s.id === artStyle)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400">Tone</span>
                    <span className="font-medium text-gray-800">
                      {tone}
                    </span>
                  </div>
                </div>
              </div>

              {moodRec && (
                <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                  <p className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">
                    Recipe preview — what the AI will aim for
                  </p>
                  <p className="text-xs text-gray-600">
                    <strong>Lighting:</strong> {lightingPreview} &middot;{" "}
                    <strong>Palette:</strong> {palettePreview}
                  </p>
                </div>
              )}

              <textarea
                value={personalContext}
                onChange={(e) => setPersonalContext(e.target.value)}
                rows={4}
                placeholder="e.g. She loves sunflowers and her golden retriever Bailey. Maybe show a garden scene with a dog?"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Optional — but the more you tell Nuuge, the more personal the card feels.
              </p>
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Card size
              </p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cardSizeBuilder"
                    checked={cardSize === "4x6"}
                    onChange={() => setCardSize("4x6")}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">4&quot; × 6&quot;</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cardSizeBuilder"
                    checked={cardSize === "5x7"}
                    onChange={() => setCardSize("5x7")}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">5&quot; × 7&quot;</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("design_style")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={generateFromSelections}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Generate my card
              </button>
              <button
                onClick={loadDesignSuggestions}
                className="bg-white text-indigo-600 border border-indigo-200 px-5 py-3 rounded-xl text-sm font-medium
                           hover:bg-indigo-50 transition-colors"
              >
                Let Nuuge suggest instead
              </button>
            </div>
          </div>
          );
        })()}

        {/* Step: Review prompt before first generation */}
        {step === "design_confirm_prompt" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Review your image prompt
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              This is what we&apos;ll send to the AI. Feel free to tweak it before generating.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-3 gap-3 w-full text-center">
                  <div>
                    <span className="block text-xs text-gray-400">Subject</span>
                    <span className="font-medium text-gray-800">
                      {IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400">Style</span>
                    <span className="font-medium text-gray-800">
                      {ART_STYLES.find((s) => s.id === artStyle)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400">Tone</span>
                    <span className="font-medium text-gray-800">
                      {tone}
                    </span>
                  </div>
                </div>
              </div>

              <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                Image prompt
              </label>
              <textarea
                value={pendingSceneDescription}
                onChange={(e) => setPendingSceneDescription(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("design_context")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={() => {
                  const prompt = pendingSceneDescription.trim();
                  const concept: DesignConcept = {
                    title: "Custom Design",
                    description: `${IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label || ""} — ${ART_STYLES.find((s) => s.id === artStyle)?.label || ""} — ${tone}`,
                    image_prompt: prompt,
                  };
                  setSelectedDesign(concept);
                  setCurrentSceneDescription(prompt);
                  generateDesignImage(prompt);
                }}
                disabled={!pendingSceneDescription.trim()}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Looks good — generate image
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
            <p className="text-sm text-gray-500 mb-4">
              Pick a concept and Nuuge will create the artwork. You can refine it after.
            </p>
            <div className="mb-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Card size (for print)
              </p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cardSize"
                    checked={cardSize === "4x6"}
                    onChange={() => setCardSize("4x6")}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">4&quot; × 6&quot;</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cardSize"
                    checked={cardSize === "5x7"}
                    onChange={() => setCardSize("5x7")}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">5&quot; × 7&quot;</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              {designConcepts.map((concept, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDesign(concept);
                    setCurrentSceneDescription(concept.image_prompt);
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
                    setCurrentSceneDescription(custom.image_prompt);
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
              onClick={() => setStep("design_context")}
              className="text-sm text-gray-400 hover:text-gray-600 mt-4"
            >
              &larr; Back to design builder
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
              {previousImageUrl ? "Editing your card artwork..." : "Creating your card artwork..."}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              This usually takes 10-15 seconds
            </p>
          </div>
        )}

        {/* Step: Confirm refinement before generating */}
        {step === "design_confirm_refinement" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Confirm the updated scene
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              We merged your change into the full description. Edit it if anything looks off, then generate.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                Scene description
              </label>
              <textarea
                value={pendingSceneDescription}
                onChange={(e) => setPendingSceneDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPendingSceneDescription("");
                  setStep("design_preview");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Cancel
              </button>
              <button
                onClick={() => {
                  setPreviousImageUrl(generatedImageUrl);
                  setPreviousSceneDescription(currentSceneDescription);
                  setCurrentSceneDescription(pendingSceneDescription);
                  generateDesignImage(pendingSceneDescription, { editExisting: true });
                }}
                disabled={!pendingSceneDescription.trim()}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Looks good — edit image
              </button>
            </div>
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
                <div className="max-w-sm mx-auto bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100" style={FONT_STYLES[font]}>
                  <p className="text-base font-medium text-gray-800 mb-2">
                    {editedMessage.greeting}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap">
                    {editedMessage.body}
                  </p>
                  <p className="text-sm text-gray-600">
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
              <p className="text-xs text-gray-500 mb-2">
                Just describe what to change — the app will build the full description for you to review before generating.
              </p>
              <div className="flex gap-2">
                <input
                  value={designFeedback}
                  onChange={(e) => setDesignFeedback(e.target.value)}
                  placeholder="e.g. Remove the people, add two birds with musical notes..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={() => requestRefinement(designFeedback)}
                  disabled={!designFeedback.trim() || merging}
                  className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg text-sm
                             font-medium hover:bg-indigo-50 transition-colors disabled:text-gray-300
                             disabled:border-gray-200"
                >
                  {merging ? "Merging..." : "Refine"}
                </button>
              </div>
              {previousImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedImageUrl(previousImageUrl);
                    setCurrentSceneDescription(previousSceneDescription || currentSceneDescription);
                    setPreviousImageUrl(null);
                    setPreviousSceneDescription(null);
                    setDesignFeedback("");
                  }}
                  className="mt-3 text-sm text-gray-500 hover:text-gray-800 underline"
                >
                  ← Revert to previous image
                </button>
              )}
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
                  setCurrentSceneDescription("");
                  setPreviousImageUrl(null);
                  setPreviousSceneDescription(null);
                  setStep(designConcepts.length > 0 ? "design_pick" : "design_context");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; {designConcepts.length > 0 ? "Pick different design" : "Back to design builder"}
              </button>
              <button
                onClick={() => setStep("inside_design_ask")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Next: Inside &amp; front text
              </button>
            </div>
          </div>
        )}

        {/* Step: Inside design — add illustration? */}
        {step === "inside_design_ask" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Add an inside illustration?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Carry the front theme to the inside — a matching decorative element
              that makes the card feel cohesive.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("inside_position_pick")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex-1"
              >
                Yes, choose placement
              </button>
              <button
                onClick={() => loadFrontTextSuggestion()}
                className="bg-white border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 flex-1"
              >
                No, skip
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

        {/* Step: Pick inside image position */}
        {step === "inside_position_pick" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Where should the illustration go?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose placement and size. Your message text will flow around the illustration.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {INSIDE_POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setInsideImagePosition(pos.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                    ${insideImagePosition === pos.id
                      ? "border-indigo-500 bg-indigo-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                    }`}
                >
                  {/* Visual diagram of position */}
                  <div className="w-16 h-20 border border-gray-300 rounded bg-white relative mb-2 flex items-center justify-center overflow-hidden">
                    {pos.id === "top" && <div className="absolute top-0 left-0 right-0 h-4 bg-indigo-200 rounded-t" />}
                    {pos.id === "middle" && <div className="absolute left-0 right-0 h-4 bg-indigo-200" style={{ top: "40%" }} />}
                    {pos.id === "bottom" && <div className="absolute bottom-0 left-0 right-0 h-4 bg-indigo-200 rounded-b" />}
                    {pos.id === "left" && <div className="absolute top-0 bottom-0 left-0 w-4 bg-indigo-200 rounded-l" />}
                    {pos.id === "right" && <div className="absolute top-0 bottom-0 right-0 w-4 bg-indigo-200 rounded-r" />}
                    {pos.id === "behind" && <div className="absolute inset-2 bg-indigo-100 rounded opacity-40" />}
                    {/* Text lines */}
                    {pos.id !== "behind" && (
                      <div className="flex flex-col gap-0.5 px-1" style={{ fontSize: 3 }}>
                        {[1, 2, 3].map((l) => (
                          <div key={l} className="h-0.5 bg-gray-300 rounded" style={{ width: pos.id === "left" || pos.id === "right" ? 8 : 12 }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{pos.label}</span>
                  <span className="text-xs text-gray-400 mt-0.5 text-center">{pos.desc}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-600">
              {insideImagePosition === "top" || insideImagePosition === "middle" || insideImagePosition === "bottom"
                ? `Horizontal banner — approximately ${cardSize === "4x6" ? "4\"" : "5\""} wide × 1" tall`
                : insideImagePosition === "left" || insideImagePosition === "right"
                  ? `Vertical strip — approximately 1" wide × ${cardSize === "4x6" ? "6\"" : "7\""} tall`
                  : "Faded watermark behind the message text"
              }
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("inside_design_ask")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Back
              </button>
              <button
                onClick={async () => {
                  setStep("inside_design_loading");
                  if (!selectedDesign) return;
                  const orientation = insideImageOrientation();
                  try {
                    const res = await fetch("/api/suggest-inside-designs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        frontTitle: selectedDesign.title,
                        frontDescription: selectedDesign.description,
                        frontImagePrompt: selectedDesign.image_prompt,
                        occasion,
                        tone,
                        position: insideImagePosition,
                        orientation,
                        artStyle: ART_STYLES.find((s) => s.id === artStyle)?.label,
                      }),
                    });
                    if (!res.ok) throw new Error("Failed to load");
                    const data = await res.json();
                    setInsideConcepts(data.designs ?? []);
                    setStep("inside_design_pick");
                  } catch {
                    loadFrontTextSuggestion();
                  }
                }}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex-1"
              >
                Suggest illustrations
              </button>
            </div>
          </div>
        )}

        {/* Step: Inside design loading */}
        {step === "inside_design_loading" && (
          <div className="text-center py-20">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
            <p className="text-gray-500">Suggesting inside illustrations that match your front design...</p>
          </div>
        )}

        {/* Step: Inside design pick */}
        {step === "inside_design_pick" && insideConcepts.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Choose an inside decoration
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Each option uses elements from your front cover. You can refine after.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Position: <strong>{INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label}</strong>
            </p>
            <div className="space-y-4">
              {insideConcepts.map((concept, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedInsideConcept(concept);
                    setInsideSceneDescription(concept.image_prompt);
                    generateDesignImage(concept.image_prompt, { isInside: true });
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-400 transition-colors"
                >
                  <div className="flex gap-4 items-start">
                    {/* Mini card mockup showing front image in chosen position */}
                    {generatedImageUrl && (
                      <div
                        className="flex-shrink-0 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
                        style={{
                          width: 90,
                          height: 126,
                          display: "flex",
                          flexDirection: insideImagePosition === "left" || insideImagePosition === "right" ? "row" : "column",
                          position: "relative",
                        }}
                      >
                        {/* Watermark: front image fills entire mini card, faded */}
                        {insideImagePosition === "behind" && (
                          <img
                            src={generatedImageUrl}
                            alt=""
                            style={{
                              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                              objectFit: "cover", opacity: 0.12,
                            }}
                          />
                        )}

                        {/* Left strip */}
                        {insideImagePosition === "left" && (
                          <div style={{ width: "20%", height: "100%", flexShrink: 0 }}>
                            <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}

                        {/* Top banner */}
                        {insideImagePosition === "top" && (
                          <div style={{ width: "100%", height: "18%", flexShrink: 0 }}>
                            <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}

                        {/* Text placeholder lines */}
                        <div style={{
                          flex: 1, display: "flex", flexDirection: "column",
                          justifyContent: "center", alignItems: "center", gap: 3,
                          padding: 6, position: "relative", zIndex: 1,
                        }}>
                          {/* Middle band */}
                          {insideImagePosition === "middle" && (
                            <div style={{ width: "100%", height: 10, flexShrink: 0, marginBottom: 3 }}>
                              <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2 }} />
                            </div>
                          )}
                          {[1, 2, 3, 4].map((l) => (
                            <div
                              key={l}
                              style={{
                                height: 2, borderRadius: 1,
                                backgroundColor: "#d1d5db",
                                width: l === 1 ? "60%" : l === 4 ? "40%" : "80%",
                              }}
                            />
                          ))}
                        </div>

                        {/* Bottom banner */}
                        {insideImagePosition === "bottom" && (
                          <div style={{ width: "100%", height: "18%", flexShrink: 0 }}>
                            <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}

                        {/* Right strip */}
                        {insideImagePosition === "right" && (
                          <div style={{ width: "20%", height: "100%", flexShrink: 0 }}>
                            <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text description */}
                    <div className="flex-1 min-w-0 py-1">
                      <span className="text-sm font-semibold text-gray-900">{concept.title}</span>
                      <p className="text-sm text-gray-600 mt-1">{concept.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("inside_position_pick")}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                &larr; Change position
              </button>
              <button
                onClick={() => loadFrontTextSuggestion()}
                className="text-sm text-gray-400 hover:text-gray-600 ml-auto"
              >
                Skip inside illustration
              </button>
            </div>
          </div>
        )}

        {/* Step: Inside design generating */}
        {step === "inside_design_generating" && (
          <div className="text-center py-20">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" />
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
            <p className="text-gray-500">Creating inside illustration...</p>
          </div>
        )}

        {/* Step: Confirm inside refinement */}
        {step === "inside_confirm_refinement" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Confirm the updated illustration
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              We merged your change. Edit if anything looks off, then generate.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                Scene description
              </label>
              <textarea
                value={pendingInsideScene}
                onChange={(e) => setPendingInsideScene(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPendingInsideScene("");
                  setStep("inside_design_preview");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Cancel
              </button>
              <button
                onClick={() => {
                  setPreviousInsideImageUrl(insideImageUrl);
                  setInsideSceneDescription(pendingInsideScene);
                  generateDesignImage(pendingInsideScene, { isInside: true, editExisting: true });
                }}
                disabled={!pendingInsideScene.trim()}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors flex-1"
              >
                Looks good — edit image
              </button>
            </div>
          </div>
        )}

        {/* Step: Inside design preview & refine */}
        {step === "inside_design_preview" && insideImageUrl && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Inside illustration
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Position: <strong>{INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label}</strong>
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 text-center">
                Preview
              </p>
              <div className="flex justify-center">
                <img
                  src={insideImageUrl}
                  alt=""
                  className={
                    insideImageOrientation() === "horizontal"
                      ? "w-full max-w-md h-auto rounded-lg"
                      : insideImageOrientation() === "vertical"
                        ? "max-h-48 w-auto rounded-lg"
                        : "max-h-32 w-auto rounded-lg"
                  }
                />
              </div>
            </div>

            {/* Refinement input */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                Want to adjust the illustration?
              </p>
              <p className="text-xs text-gray-500 mb-2">
                Describe what to change — the app will build the full description for you.
              </p>
              <div className="flex gap-2">
                <input
                  value={insideDesignFeedback}
                  onChange={(e) => setInsideDesignFeedback(e.target.value)}
                  placeholder="e.g. Make the flowers warmer colors, add a small butterfly..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={() => requestInsideRefinement(insideDesignFeedback)}
                  disabled={!insideDesignFeedback.trim() || insideMerging}
                  className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg text-sm
                             font-medium hover:bg-indigo-50 transition-colors disabled:text-gray-300
                             disabled:border-gray-200"
                >
                  {insideMerging ? "Merging..." : "Refine"}
                </button>
              </div>
              {previousInsideImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setInsideImageUrl(previousInsideImageUrl);
                    setPreviousInsideImageUrl(null);
                    setInsideDesignFeedback("");
                  }}
                  className="mt-3 text-sm text-gray-500 hover:text-gray-800 underline"
                >
                  &larr; Revert to previous image
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("inside_design_pick")}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                &larr; Pick different
              </button>
              <button
                onClick={() => {
                  setStep("front_text_loading");
                  loadFrontTextSuggestion();
                }}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex-1"
              >
                Next: Front text
              </button>
            </div>
          </div>
        )}

        {/* Step: Front text loading */}
        {step === "front_text_loading" && (
          <div className="text-center py-20">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
            <p className="text-gray-500">Suggesting front text...</p>
          </div>
        )}

        {/* Step: Front text — suggestion to add wording on front */}
        {step === "front_text" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Front text &amp; font style
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Add words on the front (optional) and choose a font for the card.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Wording
              </label>
              <input
                value={frontText}
                onChange={(e) => setFrontText(e.target.value)}
                placeholder="e.g. Happy Birthday!"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mt-3 mb-2">
                Position
              </label>
              <select
                value={frontTextPosition}
                onChange={(e) => setFrontTextPosition(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="center">Center</option>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-center">Bottom center</option>
                <option value="top-center">Top center</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mt-3 mb-2">
                Text style
              </label>
              <div className="flex gap-2">
                {([
                  { value: "plain" as const, label: "Plain black" },
                  { value: "white_box" as const, label: "Black on white" },
                  { value: "dark_box" as const, label: "White on dark" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrontTextStyle(opt.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      frontTextStyle === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Text style preview */}
              {frontText.trim() && (
                <div className="mt-3 rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", padding: "1.5rem", position: "relative" }}>
                  <div style={{
                    ...FONT_STYLES[font],
                    fontSize: "1.1rem",
                    display: "inline-block",
                    ...(frontTextStyle === "dark_box" ? {
                      color: "#fff",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      borderRadius: "0.375rem",
                      padding: "0.4rem 0.75rem",
                      textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                    } : frontTextStyle === "white_box" ? {
                      color: "#111",
                      backgroundColor: "rgba(255,255,255,0.7)",
                      borderRadius: "0.375rem",
                      padding: "0.4rem 0.75rem",
                    } : {
                      color: "#111",
                      textShadow: "0 1px 3px rgba(255,255,255,0.5)",
                    }),
                  }}>
                    {frontText}
                  </div>
                </div>
              )}
            </div>

            {/* Font selection */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Font style (front text &amp; inside message)
              </label>
              <div className="space-y-2">
                {([
                  { value: "sans" as const, label: "Clean", sample: "Happy Birthday, Sarah!" },
                  { value: "script" as const, label: "Elegant", sample: "Happy Birthday, Sarah!" },
                  { value: "block" as const, label: "Bold", sample: "Happy Birthday, Sarah!" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFont(opt.value)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      font === opt.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xs font-medium text-gray-500 uppercase">{opt.label}</span>
                    <p className="text-lg text-gray-800 mt-1" style={FONT_STYLES[opt.value]}>
                      {opt.sample}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFrontText("");
                  setStep("delivery");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
              >
                Skip
              </button>
              <button
                onClick={() => setStep("delivery")}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex-1"
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
                onClick={() => handleSave({ deliveryMethodOverride: "digital" })}
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
                onClick={() => handleSave({ deliveryMethodOverride: "print_at_home" })}
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
                onClick={() => handleSave({ deliveryMethodOverride: "mail" })}
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
              onClick={() => setStep("front_text")}
              className="text-sm text-gray-400 hover:text-gray-600 mt-4"
            >
              &larr; Back to front text
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
              {deliveryMethod === "digital" && " to send"}
              {deliveryMethod === "print_at_home" && " to print"}
              {deliveryMethod === "mail" && " — mailing coming soon"}.
            </p>

            {/* Delivery-specific action */}
            {deliveryMethod === "digital" && savedCardId && (
              <button
                onClick={() => router.push(`/cards/view/${savedCardId}`)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors mb-4 block mx-auto"
              >
                Preview &amp; share
              </button>
            )}

            {deliveryMethod === "print_at_home" && savedCardId && (
              <button
                onClick={() => router.push(`/cards/print/${savedCardId}`)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors mb-4 block mx-auto"
              >
                Print your card
              </button>
            )}

            {deliveryMethod === "mail" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-sm mx-auto text-left">
                <p className="text-sm text-amber-800 font-medium mb-1">
                  Physical mailing is coming soon
                </p>
                <p className="text-sm text-amber-700">
                  In the meantime, you can print this card at home and mail it yourself.
                </p>
                {savedCardId && (
                  <button
                    onClick={() => router.push(`/cards/print/${savedCardId}`)}
                    className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-800"
                  >
                    Print at home instead &rarr;
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setStep("occasion");
                  setOccasion("");
                  setTone("");
                  setNotes("");
                  setMessages([]);
                  setRejectedMessages([]);
                  setRegenerationCount(0);
                  setSelected(null);
                  setEditedMessage(null);
                  setImageSubject(null);
                  setSubjectDetail("");
                  setArtStyle(null);
                  setActiveProfileElements({});
                  setPersonalContext("");
                  setDesignConcepts([]);
                  setSelectedDesign(null);
                  setGeneratedImageUrl(null);
                  setDesignFeedback("");
                  setCurrentSceneDescription("");
                  setPreviousImageUrl(null);
                  setPreviousSceneDescription(null);
                  setPendingSceneDescription("");
                  setInsideConcepts([]);
                  setSelectedInsideConcept(null);
                  setInsideImageUrl(null);
                  setPreviousInsideImageUrl(null);
                  setInsideSceneDescription("");
                  setInsideDesignFeedback("");
                  setPendingInsideScene("");
                  setInsideImagePosition("top");
                  setFont("sans");
                  setFrontTextSuggestion(null);
                  setFrontText("");
                  setFrontTextPosition("bottom-right");
                  setFrontTextStyle("dark_box");
                  setCardSize("5x7");
                  setSavedCardId(null);
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

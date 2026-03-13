"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  getUserProfile,
  getRecipients,
  getCardsForRecipient,
  saveCard,
  getCardById,
  updateCard,
  hydrateCardImages,
} from "@/lib/store";
import type { Recipient, UserProfile } from "@/types/database";
import {
  SUBJECT_RECIPES,
  STYLE_RECIPES,
  MOOD_RECIPES,
  buildUserFacingPrompt,
  getMoodRecipe,
  toneToMoodId,
  pickRandom,
  calculateAge,
  getBirthdayForAge,
} from "@/lib/card-recipes";
import { fontCSS, FONT_OPTIONS as CARD_FONT_OPTIONS } from "@/lib/card-ui-helpers";
import type { FontChoice } from "@/lib/card-ui-helpers";
import { logApiCall } from "@/lib/usage-store";
import AppHeader from "@/components/AppHeader";
import {
  OCCASION_CATEGORIES,
  ALL_OCCASIONS,
  SHARED_OCCASIONS,
  OTHER_OCCASION_VALUE,
  OTHER_OCCASION_LABEL,
} from "@/lib/occasions";

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
  | "faith"
  | "tone"
  | "notes"
  | "generating"
  | "select"
  | "preview"
  | "design_subject"
  | "design_style"
  | "design_confirm_prompt"
  | "design_loading"
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
  | "letter"
  | "delivery"
  | "saved";

interface DesignConcept {
  title: string;
  description: string;
  image_prompt: string;
}

type Stage = "message" | "design" | "details" | "deliver";

const STAGE_STEPS: Record<Stage, Step[]> = {
  message: ["occasion", "faith", "tone", "notes", "generating", "select", "preview"],  // faith/tone kept for draft compat
  design: [
    "design_subject", "design_style", "design_confirm_prompt", "design_loading",
    "design_generating", "design_confirm_refinement", "design_preview",
  ],
  details: [
    "inside_design_ask", "inside_position_pick", "inside_design_loading", "inside_design_pick",
    "inside_design_generating", "inside_design_preview", "inside_confirm_refinement",
    "front_text_loading", "front_text", "letter",
  ],
  deliver: ["delivery", "saved"],
};

const STAGE_ORDER: Stage[] = ["message", "design", "details", "deliver"];
const STAGE_LABELS: Record<Stage, string> = {
  message: "Message",
  design: "Design",
  details: "Details",
  deliver: "Deliver",
};

function getStage(step: Step): Stage {
  if (STAGE_STEPS.message.includes(step)) return "message";
  if (STAGE_STEPS.design.includes(step)) return "design";
  if (STAGE_STEPS.details.includes(step)) return "details";
  return "deliver";
}

const DRAFT_KEY_PREFIX = "nuuge_card_draft_";

interface CardDraft {
  recipientId: string;
  step: Step;
  occasion: string;
  occasionCustom: string;
  includeFaithBased: boolean;
  tone: string;
  notes: string;
  sharedWith: string[];
  coSign: boolean;
  activeProfileElements: Record<string, boolean>;
  selected: CardMessage | null;
  editedMessage: CardMessage | null;
  // design (choices only; no image URLs)
  imageSubject: SubjectId | null;
  subjectDetail: string;
  artStyle: StyleId | null;
  personalContext: string;
  currentSceneDescription: string;
  selectedDesignTitle: string | null;
  selectedDesignPrompt: string | null;
  insideImagePosition: "top" | "middle" | "bottom" | "left" | "right" | "behind";
  imageInterests: string[];
  frontText: string;
  frontTextPosition: string;
  frontTextStyle: string;
  cardSize: "4x6" | "5x7";
  updatedAt: number;
}

function getDraftKey(recipientId: string): string {
  return DRAFT_KEY_PREFIX + recipientId;
}

function loadDraft(recipientId: string): CardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getDraftKey(recipientId));
    if (!raw) return null;
    const d = JSON.parse(raw) as CardDraft;
    if (d.recipientId !== recipientId) return null;
    return d;
  } catch {
    return null;
  }
}

function saveDraft(draft: CardDraft): void {
  if (typeof window === "undefined") return;
  try {
    draft.updatedAt = Date.now();
    localStorage.setItem(getDraftKey(draft.recipientId), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function clearDraft(recipientId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getDraftKey(recipientId));
  } catch {
    // ignore
  }
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

export default function CreateCardPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><p className="text-warm-gray">Loading...</p></div>}>
      <CreateCardPage />
    </Suspense>
  );
}

function CreateCardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const recipientId = params.recipientId as string;
  const editCardId = searchParams.get("editCardId");
  const startStep = searchParams.get("startStep") as Step | null;
  const presetOccasion = searchParams.get("occasion");

  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [step, setStep] = useState<Step>("occasion");
  const [isLoading, setIsLoading] = useState(false);
  const toneRef = useRef<HTMLDivElement>(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [occasion, setOccasion] = useState("");
  const [occasionCustom, setOccasionCustom] = useState("");
  const [includeFaithBased, setIncludeFaithBased] = useState(false);
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
  const [imageInterests, setImageInterests] = useState<string[]>([]);
  const [designConcepts, setDesignConcepts] = useState<DesignConcept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [userOriginalPrompt, setUserOriginalPrompt] = useState("");
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
  const [frontTextSuggestions, setFrontTextSuggestions] = useState<{ wording: string; position: string }[]>([]);
  const [frontText, setFrontText] = useState("");
  const [frontTextPosition, setFrontTextPosition] = useState("bottom-right");
  const [frontTextStyle, setFrontTextStyle] = useState<"dark_box" | "white_box" | "plain" | "plain_white">("dark_box");
  const [font, setFont] = useState<string>("sans");
  const [insideFont, setInsideFont] = useState<string>("sans");
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");
  const [letterText, setLetterText] = useState("");
  const [letterFont, setLetterFont] = useState<string>("handwritten");
  const [deliveryMethod, setDeliveryMethod] = useState<"digital" | "print_at_home" | "mail">("digital");
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingChangeType, setPendingChangeType] = useState<"refine" | "redesign">("refine");
  const [pendingEditInstruction, setPendingEditInstruction] = useState("");
  const [sessionCost, setSessionCost] = useState(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<CardDraft | null>(null);

  useEffect(() => {
    setMounted(true);
    setProfile(getUserProfile());
    const all = getRecipients();
    setAllRecipients(all);
    const found = all.find((r) => r.id === recipientId);
    if (found) setRecipient(found);

    if (editCardId) {
      const existing = getCardById(editCardId);
      if (existing) {
        hydrateCardImages(existing).then((card) => {
          setEditMode(true);
          const o = (card.occasion ?? "").trim();
          if (o === OTHER_OCCASION_VALUE || !ALL_OCCASIONS.includes(o)) {
            setOccasion(OTHER_OCCASION_VALUE);
            setOccasionCustom((card.occasion_custom ?? (o === OTHER_OCCASION_VALUE ? "" : o)).trim());
          } else {
            setOccasion(o);
            setOccasionCustom("");
          }
          setTone(card.tone_used ?? "");
          setCardSize(card.card_size ?? "5x7");
          setFont(card.front_text_font ?? card.font ?? "sans");
          setInsideFont(card.font ?? "sans");
          setFrontText(card.front_text ?? "");
          setFrontTextPosition(card.front_text_position ?? "bottom-right");
          setFrontTextStyle((card.front_text_style as "dark_box" | "white_box" | "plain" | "plain_white") ?? "dark_box");
          setImageSubject(card.image_subject ?? null);
          setArtStyle(card.art_style ?? null);
          if (card.image_url) setGeneratedImageUrl(card.image_url);
          if (card.inside_image_url) setInsideImageUrl(card.inside_image_url);
          if (card.inside_image_position) {
            setInsideImagePosition(card.inside_image_position as typeof insideImagePosition);
          }
          if (card.inside_image_prompt) {
            setInsideSceneDescription(card.inside_image_prompt);
          }
          if (card.image_prompt) {
            setCurrentSceneDescription(card.image_prompt);
            setPendingSceneDescription(card.image_prompt);
          }
          if (card.delivery_method) {
            setDeliveryMethod(card.delivery_method);
          }
          if (card.letter_text) setLetterText(card.letter_text);
          if (card.letter_font) setLetterFont(card.letter_font);

          const parts = card.message_text.split("\n\n");
          const g = parts[0] || "";
          const b = parts.slice(1, -1).join("\n\n") || parts[1] || "";
          const c = parts[parts.length - 1] || "";
          const msg: CardMessage = { label: card.style ?? "Restored", greeting: g, body: b, closing: c };
          setSelected(msg);
          setEditedMessage(msg);
          setSavedCardId(editCardId);

          // Initialize profile elements from recipient so image generation
          // uses the same filtered baseline the message was built with
          if (found) {
            setActiveProfileElements(extractProfileElements(found));
          }

          setStep(startStep ?? "occasion");
        });
      }
    } else {
      const draft = loadDraft(recipientId);
      if (draft) {
        setPendingDraft(draft);
        setShowResumePrompt(true);
      } else if (presetOccasion) {
        const label = presetOccasion.trim();
        const labelLower = label.toLowerCase();
        const matched =
          ALL_OCCASIONS.find((o) => o.toLowerCase() === labelLower) ||
          ALL_OCCASIONS.find((o) => labelLower.includes(o.toLowerCase()) || o.toLowerCase().includes(labelLower));
        if (matched) {
          setOccasion(matched === OTHER_OCCASION_LABEL ? OTHER_OCCASION_VALUE : matched);
          setOccasionCustom("");
          setStep("occasion");
        } else {
          setOccasion(OTHER_OCCASION_VALUE);
          setOccasionCustom(label);
          setStep("occasion");
        }
      }
    }
  }, [recipientId, editCardId, startStep, presetOccasion]);

  // Auto-save draft when step and message/design state change (not in edit mode, not on saved, no pending resume)
  useEffect(() => {
    if (!mounted || !recipientId || editMode || editCardId || showResumePrompt || pendingDraft || step === "saved") return;
    const draft: CardDraft = {
      recipientId,
      step,
      occasion,
      occasionCustom,
      includeFaithBased,
      tone,
      notes,
      sharedWith,
      coSign,
      activeProfileElements,
      selected,
      editedMessage,
      imageSubject,
      subjectDetail,
      artStyle,
      personalContext,
      currentSceneDescription,
      selectedDesignTitle: selectedDesign?.title ?? null,
      selectedDesignPrompt: selectedDesign?.image_prompt ?? null,
      insideImagePosition,
      imageInterests,
      frontText,
      frontTextPosition,
      frontTextStyle,
      cardSize,
      updatedAt: 0,
    };
    saveDraft(draft);
  }, [
    mounted, recipientId, editMode, editCardId, showResumePrompt, pendingDraft, step,
    occasion, occasionCustom, includeFaithBased, tone, notes, sharedWith, coSign, activeProfileElements,
    selected, editedMessage, imageSubject, subjectDetail, artStyle, personalContext,
    currentSceneDescription, selectedDesign, insideImagePosition, imageInterests, frontText, frontTextPosition, frontTextStyle, cardSize,
  ]);

  if (!mounted) return null;

  if (!recipient) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray mb-4">Person not found.</p>
        <button
          onClick={() => router.push("/")}
          className="btn-link"
        >
          Back to Circle of People
        </button>
      </div>
    );
  }

  function applyDraft(d: CardDraft) {
    let stepToRestore = d.step;
    if (d.step === "faith" || d.step === "tone") stepToRestore = "occasion";
    if (d.step === "generating" || d.step === "select") stepToRestore = "notes";
    if (d.step === "design_style") stepToRestore = "design_subject";
    if (d.step === "design_loading") stepToRestore = "design_subject";
    if (d.step === "design_generating") stepToRestore = "design_confirm_prompt";
    if (d.step === "design_preview") stepToRestore = "design_confirm_prompt";
    if (d.step === "inside_position_pick") stepToRestore = "inside_design_ask";
    if (d.step === "inside_design_loading") stepToRestore = "inside_design_ask";
    if (d.step === "inside_design_generating") stepToRestore = "inside_design_pick";
    if (d.step === "inside_design_preview") stepToRestore = "inside_design_pick";
    if (d.step === "front_text_loading") stepToRestore = "inside_design_ask";
    setStep(stepToRestore);
    setOccasion(d.occasion);
    setOccasionCustom(d.occasionCustom ?? "");
    setIncludeFaithBased(d.includeFaithBased);
    setTone(d.tone);
    setNotes(d.notes);
    setSharedWith(d.sharedWith);
    setCoSign(d.coSign);
    setActiveProfileElements(normalizeProfileElements(d.activeProfileElements));
    setSelected(d.selected);
    setEditedMessage(d.editedMessage);
    setImageSubject(d.imageSubject);
    setSubjectDetail(d.subjectDetail);
    setArtStyle(d.artStyle);
    setPersonalContext(d.personalContext);
    setCurrentSceneDescription(d.currentSceneDescription);
    setPendingSceneDescription(d.currentSceneDescription);
    setInsideImagePosition(d.insideImagePosition);
    setImageInterests(d.imageInterests ?? []);
    setFrontText(d.frontText);
    setFrontTextPosition(d.frontTextPosition);
    setFrontTextStyle(d.frontTextStyle as "dark_box" | "white_box" | "plain" | "plain_white");
    setCardSize(d.cardSize);
    if (d.step === "design_preview") setGeneratedImageUrl(null);
    if (d.step === "inside_design_preview") setInsideImageUrl(null);
    if (d.selectedDesignTitle && d.selectedDesignPrompt) {
      setSelectedDesign({ title: d.selectedDesignTitle, description: "", image_prompt: d.selectedDesignPrompt });
    }
    setShowResumePrompt(false);
    setPendingDraft(null);
  }

  function handleStartFresh() {
    clearDraft(recipientId);
    setPendingDraft(null);
    setShowResumePrompt(false);
    setStep("occasion");
    setOccasion("");
    setOccasionCustom("");
    setIncludeFaithBased(false);
    setTone("");
    setNotes("");
    setSharedWith([]);
    setCoSign(false);
    setMessages([]);
    setRejectedMessages([]);
    setRegenerationCount(0);
    setSelected(null);
    setEditedMessage(null);
    setActiveProfileElements({});
    setImageInterests([]);
    setLetterText("");
    setLetterFont("handwritten");
    if (presetOccasion) {
      const label = presetOccasion.trim();
      const labelLower = label.toLowerCase();
      const matched =
        ALL_OCCASIONS.find((o) => o.toLowerCase() === labelLower) ||
        ALL_OCCASIONS.find((o) => labelLower.includes(o.toLowerCase()) || o.toLowerCase().includes(labelLower));
      if (matched) {
        setOccasion(matched === OTHER_OCCASION_LABEL ? OTHER_OCCASION_VALUE : matched);
        setOccasionCustom("");
      } else {
        setOccasion(OTHER_OCCASION_VALUE);
        setOccasionCustom(label);
      }
      setStep("occasion");
    }
  }

  // fontCSS() from card-ui-helpers replaces the old FONT_STYLES map

  function extractProfileElements(r: Recipient): Record<string, boolean> {
    const elements: Record<string, boolean> = {};
    (r.interests || []).forEach((i) => { if (i.trim()) elements[`interest: ${i.trim()}`] = false; });
    (r.values || []).forEach((v) => { if (v.trim()) elements[`value: ${v.trim()}`] = false; });
    if (r.personality_notes) {
      r.personality_notes.split(/,\s*/).forEach((trait) => {
        const t = trait.trim();
        if (t) elements[`personality: ${t}`] = true;
      });
    }
    if (r.humor_style) elements[`humor style: ${r.humor_style}`] = true;
    if (r.humor_tolerance) elements[`humor tolerance: ${r.humor_tolerance}`] = true;
    if (r.occupation) elements[`occupation: ${r.occupation}`] = false;
    if (r.lifestyle) elements[`lifestyle: ${r.lifestyle}`] = false;
    if (r.pets) elements[`pets: ${r.pets}`] = false;
    if (r.favorite_foods) elements[`favorite foods: ${r.favorite_foods}`] = false;
    if (r.favorite_music) elements[`favorite music: ${r.favorite_music}`] = false;
    return elements;
  }

  function normalizeProfileElements(raw: Record<string, boolean>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (key.startsWith("personality: ") && key.includes(",")) {
        const label = key.replace(/^personality: /, "");
        label.split(/,\s*/).forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) out[`personality: ${trimmed}`] = val;
        });
      } else {
        out[key] = val;
      }
    }
    return out;
  }

  /** Keys we eliminate first (interests, values, factual details). */
  function isInterestLikeKey(key: string): boolean {
    return key.startsWith("interest: ") || key.startsWith("value: ") ||
      key.startsWith("occupation: ") || key.startsWith("lifestyle: ") || key.startsWith("pets: ") ||
      key.startsWith("favorite foods: ") || key.startsWith("favorite music: ");
  }
  /** Keys we eliminate second (personality, humor — tone-related). */
  function isToneLikeKey(key: string): boolean {
    return key.startsWith("personality: ") || key.startsWith("humor style: ") || key.startsWith("humor tolerance: ");
  }

  function buildContextString(
    p: Partial<UserProfile> | null,
    r: Recipient,
    profileElements?: Record<string, boolean>
  ) {
    const sender = p
      ? `Name: ${p.display_name || "Unknown"}
Personality: ${p.personality || "Not specified"}
Communication style: ${p.communication_style || "Not specified"}
Emotional energy: ${(p as { emotional_energy?: string }).emotional_energy || "Not specified"}
Humor style (when humor applies): ${p.humor_style || "Not specified"}
Interests: ${(p.interests || []).join(", ") || "Not specified"}
Lifestyle: ${p.lifestyle || "Not specified"}`
      : "No sender context available.";

    const active = profileElements
      ? Object.entries(profileElements).filter(([, v]) => v).map(([k]) => k)
      : null;

    const age = calculateAge(getBirthdayForAge(r.birthday, r.important_dates));
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
`.replace(/\n{2,}/g, "\n");
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
Humor tolerance: ${r.humor_tolerance || "Not specified"}`.replace(/\n{2,}/g, "\n");
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

      // Progressively deactivate: interest-like first, then tone-like (so tone stays longer)
      if (nextRegenCount >= 2) {
        const updated = { ...activeProfileElements };
        const activeKeys = Object.keys(activeProfileElements).filter((k) => activeProfileElements[k]);
        const activeInterestLike = activeKeys.filter(isInterestLikeKey);
        const activeToneLike = activeKeys.filter(isToneLikeKey);

        if (nextRegenCount === 2) {
          // Regen 2: turn off ~50% of interest-like only; keep all tone-like
          const interestOffCount = Math.max(0, Math.floor(activeInterestLike.length * 0.5));
          activeInterestLike.slice(0, interestOffCount).forEach((k) => { updated[k] = false; });
        } else {
          // Regen 3+: turn off remaining interest-like, then tone-like (e.g. most or all)
          activeInterestLike.forEach((k) => { updated[k] = false; });
          const toneKeepCount = Math.max(0, Math.floor(activeToneLike.length * 0.2));
          activeToneLike.slice(toneKeepCount).forEach((k) => { updated[k] = false; });
        }
        setActiveProfileElements(updated);
      }
    }

    // Initialize profile elements on first generation
    if (Object.keys(activeProfileElements).length === 0 && recipient) {
      const elements = extractProfileElements(recipient);
      setActiveProfileElements(elements);
    }

    setIsLoading(true);
    setLoadingMessage(`Nuuge is writing your ${effectiveOccasion} card for ${recipient!.name}...`);
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
          occasion: effectiveOccasion,
          tone,
          includeFaithBased,
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
      setIsLoading(false);
      setStep("select");
      logApiCall("generate-card", { model: "gpt-4o", callType: "chat_completion", recipientId, cardId: editCardId || undefined });
      setSessionCost((c) => c + 0.025);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setIsLoading(false);
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

  const effectiveOccasion = (occasion === OTHER_OCCASION_VALUE && occasionCustom.trim()) ? occasionCustom.trim() : occasion;
  const showShareOption =
    linkedRecipients.length > 0 && SHARED_OCCASIONS.includes(occasion);

  async function loadDesignSuggestionsBackground() {
    if (!editedMessage || !recipient) return;
    setConceptsLoading(true);

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
          occasion: effectiveOccasion,
          tone,
          includeFaithBased,
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
      logApiCall("suggest-designs", { model: "gpt-4o", callType: "chat_completion", recipientId, cardId: editCardId || undefined });
      setSessionCost((c) => c + 0.025);
    } catch {
      // Non-blocking — alternatives just won't appear
    } finally {
      setConceptsLoading(false);
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

    const interests = imageInterests.length > 0 ? imageInterests : undefined;
    return buildUserFacingPrompt({
      subjectId: imageSubject,
      subjectDetail: subjectDetail.trim() || undefined,
      tone,
      styleId: artStyle,
      personalContext: personalContext.trim() || undefined,
      profileInterests: interests,
      occasion: effectiveOccasion,
    });
  }

  function generateFromSelections() {
    const prompt = buildImagePromptFromSelections();
    setPendingSceneDescription(prompt);
    setStep("design_confirm_prompt");
  }

  function reviewCardDesign() {
    const prompt = buildImagePromptFromSelections();
    setPendingSceneDescription(prompt);
    setUserOriginalPrompt(prompt);
    setDesignConcepts([]);
    loadDesignSuggestionsBackground();
    setStep("design_confirm_prompt");
  }

  async function generateDesignImage(
    prompt: string,
    options?: { isInside?: boolean; editExisting?: boolean; editInstruction?: string }
  ) {
    const isInside = options?.isInside ?? false;
    const editExisting = options?.editExisting ?? false;
    setIsLoading(true);
    setLoadingMessage(isInside ? "Creating inside illustration..." : "Creating card artwork...");
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
          editInstruction: editExisting ? (options?.editInstruction || undefined) : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate image");
      }

      const data = await res.json();
      const imgCallType = editExisting ? "image_edit" : "image_generate";
      logApiCall("generate-image", { model: "gpt-image-1", callType: imgCallType as "image_edit" | "image_generate", recipientId, cardId: editCardId || undefined });
      setSessionCost((c) => c + 0.08);
      setIsLoading(false);
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
      setIsLoading(false);
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
          currentInterests: imageInterests.length > 0 ? imageInterests : [],
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to merge scene");
      }
      const data = await res.json();
      setPendingSceneDescription(data.mergedScene);
      setPendingChangeType(data.changeType === "redesign" ? "redesign" : "refine");
      setPendingEditInstruction(data.editInstruction || "");
      setStep("design_confirm_refinement");
      logApiCall("merge-scene", { model: "gpt-4o-mini", callType: "chat_completion", recipientId, cardId: editCardId || undefined });
      setSessionCost((c) => c + 0.005);
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
          currentInterests: imageInterests.length > 0 ? imageInterests : [],
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to merge scene");
      }
      const data = await res.json();
      setPendingInsideScene(data.mergedScene);
      setPendingChangeType(data.changeType === "redesign" ? "redesign" : "refine");
      setPendingEditInstruction(data.editInstruction || "");
      setStep("inside_confirm_refinement");
      logApiCall("merge-scene", { model: "gpt-4o-mini", callType: "chat_completion", recipientId, cardId: editCardId || undefined });
      setSessionCost((c) => c + 0.005);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setInsideMerging(false);
    }
  }

  async function loadFrontTextSuggestions() {
    const previousWordings = frontTextSuggestions.map((s) => s.wording);
    setIsLoading(true);
    setLoadingMessage("Thinking of front text options...");
    try {
      const res = await fetch("/api/suggest-front-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: effectiveOccasion,
          tone,
          recipientName: recipient?.name ?? "",
          relationshipType: recipient?.relationship_type || undefined,
          previousWordings: previousWordings.length > 0 ? previousWordings : undefined,
          messageText: editedMessage ? `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${editedMessage.closing}` : undefined,
          artStyle: artStyle || undefined,
          imageSubject: imageSubject || undefined,
        }),
      });
      const data = await res.json();
      const suggestions: { wording: string; position: string }[] = Array.isArray(data.suggestions)
        ? data.suggestions
        : data.wording
          ? [{ wording: data.wording, position: data.position ?? "bottom-right" }]
          : [];
      setFrontTextSuggestions(suggestions);
      if (suggestions.length > 0) {
        setFrontText(suggestions[0].wording);
        setFrontTextPosition(suggestions[0].position);
      }
      logApiCall("suggest-front-text", { model: "gpt-4o", callType: "chat_completion", recipientId, cardId: editCardId || undefined });
      setSessionCost((c) => c + 0.025);
    } catch {
      setFrontTextSuggestions([]);
      setFrontText("");
      setFrontTextPosition("bottom-right");
    }
    setIsLoading(false);
    setStep("front_text");
  }

  function handleSave(options?: { deliveryMethodOverride?: "digital" | "print_at_home" | "mail" }) {
    if (!editedMessage || !recipient) return;
    const method = options?.deliveryMethodOverride ?? deliveryMethod;
    const fullText = `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${editedMessage.closing}`;
    const cardData: Partial<import("@/types/database").Card> = {
      user_id: "local",
      recipient_id: recipient.id,
      recipient_ids: [recipient.id, ...sharedWith],
      occasion,
      occasion_custom: (occasion === OTHER_OCCASION_VALUE && occasionCustom.trim()) ? occasionCustom.trim() : null,
      message_text: fullText,
      image_url: generatedImageUrl,
      image_prompt: selectedDesign?.image_prompt || currentSceneDescription || null,
      inside_image_url: insideImageUrl,
      inside_image_prompt: selectedInsideConcept?.image_prompt || null,
      front_text: frontText.trim() || null,
      front_text_position: frontText.trim() ? frontTextPosition : null,
      front_text_style: frontTextStyle,
      front_text_font: font,
      font: insideFont,
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
      letter_text: letterText.trim() || null,
      letter_font: letterText.trim() ? letterFont : null,
    };

    if (editMode && editCardId) {
      updateCard(editCardId, cardData);
      setSavedCardId(editCardId);
      setDeliveryMethod(method);
      if (method === "print_at_home") {
        clearDraft(recipientId);
        router.push(`/cards/print/${editCardId}`);
        return;
      }
    } else {
      const saved = saveCard(cardData) as { id: string } | undefined;
      if (saved) {
        setSavedCardId(saved.id);
        setDeliveryMethod(method);
        if (method === "print_at_home") {
          clearDraft(recipientId);
          router.push(`/cards/print/${saved.id}`);
          return;
        }
      }
    }
    clearDraft(recipientId);
    setStep("saved");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader>
        {/* Row 1: back button + recipient name */}
        <div className="relative flex items-center w-full" style={{ minHeight: "2rem" }}>
          <button
            onClick={() => editMode && editCardId
              ? router.push(`/cards/edit/${editCardId}`)
              : router.push("/")
            }
            className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            {editMode ? "Back to edit" : "Circle of People"}
          </button>
          <h1
            className="absolute inset-0 flex items-center justify-center text-lg font-semibold pointer-events-none"
            style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-heading)" }}
          >
            {editMode ? "Regenerating for" : (effectiveOccasion && step !== "occasion") ? `${effectiveOccasion} card for` : "Card for"} {recipient.name}
          </h1>
          {sessionCost > 0 && (
            <span className="ml-auto relative z-10 text-xs text-warm-gray" title="Estimated AI cost this session">
              ~${sessionCost.toFixed(2)}
            </span>
          )}
        </div>

        {/* Row 2: progress steps */}
        {!showResumePrompt && step !== "saved" && (
          <div className="flex items-center justify-center gap-2 w-full mt-1">
            {STAGE_ORDER.map((stage, i) => {
              const current = getStage(step);
              const currentIdx = STAGE_ORDER.indexOf(current);
              const isActive = current === stage;
              const isPast = i < currentIdx;
              const stepNum = i + 1;
              return (
                <div key={stage} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
                    style={{
                      background: isActive
                        ? "var(--color-brand)"
                        : isPast
                          ? "var(--color-sage)"
                          : "var(--color-light-gray)",
                      color: isActive || isPast ? "#fff" : "var(--color-warm-gray)",
                    }}
                  >
                    {isPast ? "✓" : stepNum}
                  </div>
                  <span
                    className={`text-xs whitespace-nowrap ${isActive ? "font-semibold" : ""}`}
                    style={{ color: isActive ? "var(--color-brand)" : isPast ? "var(--color-sage)" : "var(--color-warm-gray)" }}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                  {i < STAGE_ORDER.length - 1 && (
                    <div
                      className="w-8 h-px"
                      style={{ background: isPast ? "var(--color-sage)" : "var(--color-light-gray)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AppHeader>

      <main className="max-w-2xl mx-auto px-6 py-8 relative">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-cream/80 backdrop-blur-sm rounded-xl" style={{ minHeight: "200px" }}>
            <div className="animate-spin h-8 w-8 border-4 rounded-full mb-4" style={{ borderColor: "var(--color-sage-light)", borderTopColor: "var(--color-brand)" }} />
            <p className="text-base font-medium text-charcoal">{loadingMessage}</p>
            <p className="text-sm text-warm-gray mt-1">This may take a moment</p>
          </div>
        )}

        {/* Resume draft prompt */}
        {showResumePrompt && pendingDraft && (
          <div className="rounded-xl p-6 border-2 text-center" style={{ background: "var(--color-white)", borderColor: "var(--color-sage-light)" }}>
            <p className="text-lg font-medium text-charcoal mb-1">Resume your draft?</p>
            <p className="text-sm text-warm-gray mb-4">
              You have a card in progress for {recipient.name}. Pick up where you left off or start over.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => applyDraft(pendingDraft)}
                className="btn-primary"
              >
                Resume
              </button>
              <button
                onClick={handleStartFresh}
                className="btn-secondary"
              >
                Start fresh
              </button>
            </div>
          </div>
        )}

        {!showResumePrompt && (
        <>
        {/* Step: Occasion */}
        {step === "occasion" && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-5">
              What&apos;s the occasion?
            </h2>
            <div className="space-y-4">
              {OCCASION_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-2">{cat.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {cat.occasions.map((o) => {
                      const isSelected = o === OTHER_OCCASION_LABEL
                        ? occasion === OTHER_OCCASION_VALUE
                        : occasion === o;
                      return (
                        <button
                          key={o}
                          onClick={() => {
                            if (o === OTHER_OCCASION_LABEL) {
                              setOccasion(OTHER_OCCASION_VALUE);
                            } else {
                              setOccasion(o);
                            }
                            setTimeout(() => toneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                          }}
                          className="rounded-full px-4 py-2 text-sm font-medium transition-all"
                          style={isSelected ? {
                            background: "var(--color-brand)",
                            color: "#fff",
                            boxShadow: "0 0 0 2px var(--color-brand)",
                          } : {
                            background: "var(--color-white)",
                            color: "var(--color-charcoal)",
                            border: "1.5px solid var(--color-sage-light)",
                          }}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {occasion === OTHER_OCCASION_VALUE && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-light-gray)" }}>
                <label className="block text-sm font-medium text-charcoal mb-2">What&apos;s the occasion?</label>
                <input
                  type="text"
                  value={occasionCustom}
                  onChange={(e) => setOccasionCustom(e.target.value)}
                  placeholder="e.g. Housewarming, New job"
                  className="input-field rounded-xl w-full text-base py-3"
                  autoFocus
                />
              </div>
            )}

            {/* Faith toggle + Tone — shown once an occasion is selected */}
            {((occasion && occasion !== OTHER_OCCASION_VALUE) || (occasion === OTHER_OCCASION_VALUE && occasionCustom.trim())) && (
              <div ref={toneRef} className="mt-8 pt-6 border-t space-y-6" style={{ borderColor: "var(--color-light-gray)" }}>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <span className="text-lg font-medium text-charcoal">Include faith-based themes?</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeFaithBased}
                      onClick={() => {
                        const next = !includeFaithBased;
                        setIncludeFaithBased(next);
                        if (next && ["Funny and playful", "Sarcastic and edgy"].includes(tone)) {
                          setTone("");
                        }
                      }}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{ background: includeFaithBased ? "var(--color-brand)" : "var(--color-light-gray)" }}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                        style={{ transform: includeFaithBased ? "translateX(1.375rem)" : "translateX(0.25rem)" }}
                      />
                    </button>
                  </label>
                  {includeFaithBased && (
                    <p className="text-xs mt-1" style={{ color: "var(--color-brand)" }}>
                      Message will be sincere and respectful, no humor or sarcasm.
                    </p>
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-charcoal mb-4">What tone should this card have?</h2>
                  <div className="flex flex-wrap gap-2">
                    {((includeFaithBased || occasion === "Apology")
                      ? TONES.filter((t) => !["Funny and playful", "Sarcastic and edgy"].includes(t))
                      : TONES
                    ).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className="rounded-full px-4 py-2 text-sm font-medium transition-all"
                        style={tone === t ? {
                          background: "var(--color-brand)",
                          color: "#fff",
                          boxShadow: "0 0 0 2px var(--color-brand)",
                        } : {
                          background: "var(--color-white)",
                          color: "var(--color-charcoal)",
                          border: "1.5px solid var(--color-sage-light)",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setStep("notes")}
                  disabled={!tone}
                  className="btn-primary text-base px-6 py-3 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Additional notes */}
        {step === "notes" && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">
              Add a personal touch
            </h2>
            <p className="text-sm text-warm-gray mb-4">
              Optional — give Nuuge something specific to weave into the message, or leave it blank.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder={"Ideas:\n• A recent trip or shared memory\n• A milestone (promotion, new home)\n• An inside joke\n• Something they said recently"}
              className="input-field rounded-xl mb-4"
            />
            {showShareOption && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-brand-light)", border: "1.5px solid var(--color-sage)" }}>
                <p className="text-sm font-medium text-charcoal mb-2">
                  Show this card on linked profiles too?
                </p>
                <p className="text-xs text-warm-gray mb-3">
                  Since this is a shared occasion, you can save it to both profiles.
                </p>
                {linkedRecipients.map((lr) => (
                  <label key={lr.id} className="flex items-center gap-2 text-sm text-charcoal">
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
                      className="rounded"
                      style={{ accentColor: "var(--color-brand)" }}
                    />
                    {lr.name}
                    <span className="text-xs text-warm-gray capitalize">({lr.linkLabel})</span>
                  </label>
                ))}
              </div>
            )}
            {profile?.partner_name && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-base text-charcoal">Co-sign with {profile.partner_name}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={coSign}
                    onClick={() => setCoSign(!coSign)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ background: coSign ? "var(--color-brand)" : "var(--color-light-gray)" }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: coSign ? "translateX(1.375rem)" : "translateX(0.25rem)" }}
                    />
                  </button>
                </label>
                {coSign && (
                  <p className="text-xs text-warm-gray mt-1">
                    The message will use &ldquo;we&rdquo; and &ldquo;our&rdquo; and sign from both of you.
                  </p>
                )}
              </div>
            )}
            {/* Profile topics to include — split into Interests (opt-in) and Personality (opt-out) */}
            {recipient && (() => {
              const raw = Object.keys(activeProfileElements).length > 0
                ? normalizeProfileElements(activeProfileElements)
                : extractProfileElements(recipient);
              if (Object.keys(activeProfileElements).length === 0 && Object.keys(raw).length > 0) {
                setTimeout(() => setActiveProfileElements(raw), 0);
              }
              const elements = raw;
              const allEntries = Object.entries(elements);
              const interestEntries = allEntries.filter(([k]) => isInterestLikeKey(k));
              const toneEntries = allEntries.filter(([k]) => isToneLikeKey(k));

              const renderPills = (entries: [string, boolean][]) => (
                <div className="flex flex-wrap gap-2">
                  {entries.map(([key, active]) => (
                    <button
                      key={key}
                      onClick={() => setActiveProfileElements((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="text-sm px-3 py-1.5 rounded-full font-medium transition-all"
                      style={active ? {
                        background: "var(--color-brand-light)",
                        border: "1.5px solid var(--color-brand)",
                        color: "var(--color-brand)",
                      } : {
                        background: "var(--color-faint-gray)",
                        border: "1.5px solid var(--color-light-gray)",
                        color: "var(--color-warm-gray)",
                      }}
                    >
                      {active ? "✓ " : ""}{key.replace(/^[^:]+: /, "")}
                    </button>
                  ))}
                </div>
              );

              return allEntries.length > 0 ? (
                <div className="space-y-4 mb-4">
                  {interestEntries.length > 0 && (
                    <div className="rounded-xl p-4" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                      <p className="text-base font-medium text-charcoal mb-1">
                        Interests &amp; details
                      </p>
                      <p className="text-sm text-warm-gray mb-3">
                        Select any of {recipient.name}&apos;s interests you&apos;d like referenced in the message.
                      </p>
                      {renderPills(interestEntries)}
                    </div>
                  )}
                  {toneEntries.length > 0 && (
                    <div className="rounded-xl p-4" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                      <p className="text-base font-medium text-charcoal mb-1">
                        Personality &amp; style
                      </p>
                      <p className="text-sm text-warm-gray mb-3">
                        These shape the tone of the message. Deselect any that don&apos;t fit.
                      </p>
                      {renderPills(toneEntries)}
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {error && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("occasion")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={generateMessages}
                className="btn-primary"
              >
                Generate card messages
              </button>
            </div>
          </div>
        )}


        {/* Step: Select from options */}
        {step === "select" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Pick your favorite
            </h2>
            <p className="text-sm text-warm-gray mb-6">
              Here are 3 options for {recipient.name}&apos;s {effectiveOccasion.toLowerCase()} card.
              Click one to preview and edit.
            </p>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => selectMessage(msg)}
                  className="w-full card-surface card-surface-clickable p-5 text-left"
                >
                  <span className="text-xs font-medium text-brand uppercase tracking-wide">
                    {msg.label}
                  </span>
                  <p className="text-sm text-charcoal mt-2 font-medium">
                    {msg.greeting}
                  </p>
                  <p className="text-sm text-warm-gray mt-1">{msg.body}</p>
                  <p className="text-sm text-warm-gray mt-1 italic whitespace-pre-line">
                    {msg.closing}
                  </p>
                </button>
              ))}
            </div>
            {/* Profile element toggles for regeneration */}
            {Object.keys(activeProfileElements).length > 0 && (() => {
              const normalized = normalizeProfileElements(activeProfileElements);
              return (
              <div className="rounded-xl p-4 mt-4" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">
                  Profile details used
                  {regenerationCount > 0 && (
                    <span className="text-warm-gray normal-case ml-1">
                      — toggle off what you don&apos;t want
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(normalized).map(([key, active]) => (
                    <button
                      key={key}
                      onClick={() => setActiveProfileElements((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        active
                          ? "bg-brand-light border-sage text-brand"
                          : "bg-faint-gray border-light-gray text-warm-gray line-through"
                      }`}
                    >
                      {key.replace(/^[^:]+: /, "")}
                    </button>
                  ))}
                </div>
              </div>
              );
            })()}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setStep("notes")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={generateMessages}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                Regenerate all
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview & Edit */}
        {step === "preview" && editedMessage && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Preview &amp; edit
            </h2>
            <p className="text-sm text-warm-gray mb-6">
              Adjust anything you want, then save.
            </p>
            <div className="card-surface p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-1">
                  Greeting
                </label>
                <input
                  value={editedMessage.greeting}
                  onChange={(e) =>
                    setEditedMessage({ ...editedMessage, greeting: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-1">
                  Message
                </label>
                <textarea
                  value={editedMessage.body}
                  onChange={(e) =>
                    setEditedMessage({ ...editedMessage, body: e.target.value })
                  }
                  rows={4}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-1">
                  Closing
                </label>
                <textarea
                  value={editedMessage.closing}
                  onChange={(e) =>
                    setEditedMessage({ ...editedMessage, closing: e.target.value })
                  }
                  rows={2}
                  placeholder="e.g. Love,&#10;Your name"
                  className="input-field resize-none"
                />
                <p className="text-xs text-warm-gray mt-0.5">Put your name(s) on a new line below the phrase.</p>
              </div>
            </div>

            {/* Card visual preview */}
            <div className="mt-6 card-surface p-8 text-center">
              <p className="text-xs text-warm-gray uppercase tracking-wide mb-4">
                Card preview
              </p>
              <div className="max-w-sm mx-auto rounded-xl p-8" style={{ background: "var(--color-brand-light)", border: "1.5px solid var(--color-sage)" }}>
                <p className="text-lg font-medium text-charcoal mb-3">
                  {editedMessage.greeting}
                </p>
                <p className="text-sm text-charcoal leading-relaxed mb-3 whitespace-pre-wrap">
                  {editedMessage.body}
                </p>
                <p className="text-sm text-warm-gray italic whitespace-pre-line">
                  {editedMessage.closing}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setStep("select")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Pick a different one
              </button>
              {editMode && generatedImageUrl && (
                <button
                  onClick={() => {
                    handleSave({ deliveryMethodOverride: deliveryMethod });
                  }}
                  className="btn-brand"
                >
                  Save &amp; finish
                </button>
              )}
              <button
                onClick={() => setStep("design_subject")}
                className="btn-primary"
              >
                {editMode && generatedImageUrl ? "Continue: Redesign image" : "Next: Design the card"}
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
            <h2 className="text-xl font-bold text-charcoal mb-1">
              Design your card
            </h2>
            <p className="text-base text-warm-gray mb-6">
              Pick the main subject for your card&apos;s front image.
              {recommended.length > 0 && (
                <span className="text-brand"> Stars mark subjects that pair well with &ldquo;{tone.toLowerCase()}&rdquo;.</span>
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
                      ? "border-brand bg-brand-light shadow-md"
                      : isRecommended
                        ? "border-sage-light bg-brand-light/30 hover:border-sage hover:shadow-sm"
                        : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                    }`}
                >
                  {isRecommended && (
                    <span className="absolute top-1.5 right-2 text-sage text-sm" title="Recommended for this tone">★</span>
                  )}
                  <span className="text-3xl mb-2">{subj.emoji}</span>
                  <span className="text-base font-semibold text-charcoal">{subj.label}</span>
                  <span className="text-sm text-warm-gray mt-1 text-center">{subj.examples}</span>
                </button>
                );
              })}
            </div>

            {imageSubject && (
              <>
                {sceneSketches.length > 0 && (
                  <div className="mb-4 p-4 rounded-xl" style={{ background: "var(--color-brand-light)", border: "1.5px solid var(--color-sage)" }}>
                    <p className="text-sm font-medium text-brand uppercase tracking-wide mb-2">
                      Scene ideas for {selectedSubjectRecipe?.label} + {tone.toLowerCase()}
                    </p>
                    <div className="space-y-1.5">
                      {sceneSketches.map((sketch, i) => (
                        <button
                          key={i}
                          onClick={() => setSubjectDetail(sketch)}
                          className={`block w-full text-left text-base px-3 py-2.5 rounded-lg transition-colors
                            ${subjectDetail === sketch
                              ? "bg-brand-light text-brand-hover font-medium"
                              : "text-charcoal hover:bg-white/60"
                            }`}
                        >
                          &ldquo;{sketch}&rdquo;
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-warm-gray mt-2">
                      Tap to use a scene idea, or type your own below.
                    </p>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-base font-medium text-charcoal mb-1">
                    Get more specific (optional)
                  </label>
                  <input
                    value={subjectDetail}
                    onChange={(e) => setSubjectDetail(e.target.value)}
                    placeholder={`e.g. ${IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.examples || "describe what you want"}`}
                    className="input-field rounded-xl"
                  />
                </div>
              </>
            )}

            {/* Art style section — shown once a subject is selected */}
            {imageSubject && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--color-light-gray)" }}>
                <h3 className="text-lg font-bold text-charcoal mb-1">
                  Choose the artistic style
                </h3>
                <p className="text-base text-warm-gray mb-4">
                  This sets the visual look and feel of your card.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ART_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setArtStyle(style.id)}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left
                        ${artStyle === style.id
                          ? "border-brand bg-brand-light shadow-md"
                          : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                        }`}
                    >
                      <span className="text-base font-semibold text-charcoal">{style.label}</span>
                      <span className="text-sm text-warm-gray mt-1">{style.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Personal touch section — shown once both subject and style are selected */}
            {imageSubject && artStyle && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--color-light-gray)" }}>
                <h3 className="text-lg font-bold text-charcoal mb-1">
                  Add a personal touch
                </h3>
                <p className="text-base text-warm-gray mb-4">
                  Optional details to make the image more personal.
                </p>

                {(() => {
                  const available = getActiveInterests();
                  if (available.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-charcoal mb-2">
                        Which interests should influence the image?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {available.map((interest) => {
                          const active = imageInterests.includes(interest);
                          return (
                            <button
                              key={interest}
                              onClick={() => {
                                if (active) {
                                  setImageInterests(imageInterests.filter((i) => i !== interest));
                                } else if (imageInterests.length < 3) {
                                  setImageInterests([...imageInterests, interest]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                active
                                  ? "border-brand bg-brand-light text-brand"
                                  : "border-light-gray text-warm-gray hover:border-warm-gray"
                              } ${!active && imageInterests.length >= 3 ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                              {interest}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-sm text-warm-gray mt-1">
                        Pick up to 3 that fit this card&apos;s image.
                      </p>
                    </div>
                  );
                })()}

                <div className="mb-2">
                  <p className="text-sm font-medium text-charcoal mb-1">
                    Anything else for the image?
                  </p>
                  <textarea
                    value={personalContext}
                    onChange={(e) => setPersonalContext(e.target.value)}
                    rows={3}
                    placeholder="e.g. She loves sunflowers and her golden retriever Bailey. Maybe show a garden scene with a dog?"
                    className="input-field rounded-xl resize-none"
                  />
                  <p className="text-sm text-warm-gray mt-1">
                    Describe specific details you&apos;d like Nuuge to include.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={reviewCardDesign}
                disabled={!imageSubject || !artStyle}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Review card design
              </button>
            </div>
          </div>
          );
        })()}

        {/* Step: Unified review — user prompt + Nuuge alternatives */}
        {step === "design_confirm_prompt" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Review your card design
            </h2>
            <p className="text-base text-warm-gray mb-4">
              Your design is loaded and ready to generate. Nuuge also created a few alternative ideas below — tap any to try it, or go with yours.
            </p>

            {/* My design card */}
            <div className="mb-2">
              <p className="text-sm font-medium text-charcoal mb-2">My design</p>
              <button
                onClick={() => setPendingSceneDescription(userOriginalPrompt)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  pendingSceneDescription === userOriginalPrompt
                    ? "border-brand bg-brand-light shadow-md"
                    : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                }`}
              >
                <span className="text-base font-semibold text-charcoal">
                  {IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label || "Custom"}
                  {subjectDetail && ` — ${subjectDetail}`}
                </span>
                <p className="text-sm text-warm-gray mt-1">
                  {ART_STYLES.find((s) => s.id === artStyle)?.label || ""} &middot; {tone}
                </p>
              </button>
            </div>

            {/* Nuuge alternatives section */}
            <div className="mb-4">
              <p className="text-sm font-medium text-charcoal mb-2 mt-4">Design ideas from Nuuge</p>

              {conceptsLoading && (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--color-light-gray)", borderTopColor: "var(--color-brand)" }} />
                  <span className="text-sm text-warm-gray">Nuuge is brainstorming alternatives&hellip;</span>
                </div>
              )}

              {!conceptsLoading && designConcepts.length > 0 && (
                <div className="space-y-3">
                  {designConcepts.map((concept, i) => {
                    const isActive = pendingSceneDescription === concept.image_prompt;
                    return (
                      <button
                        key={i}
                        onClick={() => setPendingSceneDescription(concept.image_prompt)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          isActive
                            ? "border-brand bg-brand-light shadow-md"
                            : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                        }`}
                      >
                        <span className="text-base font-semibold text-charcoal">
                          {concept.title}
                        </span>
                        <p className="text-sm text-warm-gray mt-1">{concept.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {!conceptsLoading && designConcepts.length === 0 && (
                <p className="text-sm text-warm-gray py-4">
                  Couldn&apos;t load design alternatives. You can still generate from your prompt below.
                </p>
              )}
            </div>

            {/* Active prompt editor */}
            <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--color-light-gray)" }}>
              <label className="text-sm font-medium text-charcoal mb-2 block">
                Image prompt (editable)
              </label>
              <textarea
                value={pendingSceneDescription}
                onChange={(e) => setPendingSceneDescription(e.target.value)}
                rows={6}
                className="input-field resize-y mb-4"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("design_subject")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
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
                className="btn-primary"
              >
                Generate image
              </button>
            </div>
          </div>
        )}


        {/* Step: Confirm refinement before generating */}
        {step === "design_confirm_refinement" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Generate from updated description
            </h2>
            <p className="text-sm text-warm-gray mb-4">
              Your addition is merged into the scene below. We&apos;ll generate a new image from this full description (no edit of the current image). You can revert if you prefer the previous version.
            </p>

            {pendingChangeType === "refine" && pendingEditInstruction && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
                <label className="text-xs text-brand uppercase tracking-wide mb-2 block font-medium">
                  What will change
                </label>
                <textarea
                  value={pendingEditInstruction}
                  onChange={(e) => setPendingEditInstruction(e.target.value)}
                  rows={2}
                  className="input-field resize-y" style={{ borderColor: "var(--color-brand)" }}
                />
              </div>
            )}

            <div className="card-surface p-4 mb-6">
              <label className="text-xs text-warm-gray uppercase tracking-wide mb-2 block">
                Full scene description
              </label>
              <textarea
                value={pendingSceneDescription}
                onChange={(e) => setPendingSceneDescription(e.target.value)}
                rows={4}
                className="input-field resize-y"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep("design_preview");
                }}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2"
              >
                &larr; Cancel
              </button>
              <button
                onClick={() => {
                  setPreviousImageUrl(generatedImageUrl);
                  setPreviousSceneDescription(currentSceneDescription);
                  setCurrentSceneDescription(pendingSceneDescription);
                  // Always generate from the full scene description (original + added instructions). No image edit — avoids muddling until we have in-region edits.
                  generateDesignImage(pendingSceneDescription, { editExisting: false });
                }}
                disabled={!pendingSceneDescription.trim()}
                className="flex-1 btn-primary"
              >
                Generate new image
              </button>
            </div>
          </div>
        )}

        {/* Step: Design preview & iterate */}
        {step === "design_preview" && generatedImageUrl && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Your card design
            </h2>
            <p className="text-sm text-warm-gray mb-6">
              {selectedDesign?.title} — request a change or move on to delivery.
            </p>

            {/* Card front */}
            <div className="card-surface p-4 mb-4">
              <p className="text-xs text-warm-gray uppercase tracking-wide mb-3 text-center">
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
              <div className="card-surface p-4 mb-6">
                <p className="text-xs text-warm-gray uppercase tracking-wide mb-3 text-center">
                  Card inside
                </p>
                <div className="max-w-sm mx-auto rounded-xl p-6" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", ...fontCSS(insideFont as FontChoice) }}>
                  <p className="text-base font-medium text-charcoal mb-2">
                    {editedMessage.greeting}
                  </p>
                  <p className="text-sm text-charcoal leading-relaxed mb-2 whitespace-pre-wrap">
                    {editedMessage.body}
                  </p>
                  <p className="text-sm text-warm-gray whitespace-pre-line">
                    {editedMessage.closing}
                  </p>
                </div>
              </div>
            )}

            {/* Refinement input */}
            <div className="card-surface p-4 mb-6">
              <p className="text-sm text-charcoal mb-2">
                Want to change something?
              </p>
              <p className="text-xs text-warm-gray mb-2">
                Describe what to add or change. Nuuge will re-create the whole image with your edit — small tweaks (e.g. add an element, adjust a color) tend to work best; the rest of the scene may shift slightly.
              </p>
              <div className="flex gap-2">
                <input
                  value={designFeedback}
                  onChange={(e) => setDesignFeedback(e.target.value)}
                  placeholder="e.g. Add a fire ring with smoke in the center, make the sky warmer..."
                  className="input-field flex-1"
                />
                <button
                  onClick={() => requestRefinement(designFeedback)}
                  disabled={!designFeedback.trim() || merging}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {merging ? "Merging..." : "Request change"}
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
                  className="mt-3 text-sm text-warm-gray hover:text-charcoal underline"
                >
                  ← Revert to previous image
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
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
                  setStep("design_confirm_prompt");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                {designConcepts.length > 0 ? "Pick different design" : "Back to design builder"}
              </button>
              {editMode && (
                <button
                  onClick={() => {
                    handleSave({ deliveryMethodOverride: deliveryMethod });
                  }}
                  className="btn-brand"
                >
                  Save &amp; finish
                </button>
              )}
              <button
                onClick={() => setStep("inside_design_ask")}
                className="btn-primary"
              >
                {editMode ? "Continue: Inside & front text" : "Next: Inside & front text"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Inside design — add illustration? */}
        {step === "inside_design_ask" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Add an inside illustration?
            </h2>
            <p className="text-sm text-warm-gray mb-4">
              Carry the front theme to the inside — a matching decorative element.
              Pick a placement below, or skip this step.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {INSIDE_POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setInsideImagePosition(pos.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                    ${insideImagePosition === pos.id
                      ? "border-brand bg-brand-light shadow-md"
                      : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                    }`}
                >
                  <div className="w-16 h-20 border border-light-gray rounded bg-white relative mb-2 flex items-center justify-center overflow-hidden">
                    {pos.id === "top" && <div className="absolute top-0 left-0 right-0 h-4 bg-sage-light rounded-t" />}
                    {pos.id === "middle" && <div className="absolute left-0 right-0 h-4 bg-sage-light" style={{ top: "40%" }} />}
                    {pos.id === "bottom" && <div className="absolute bottom-0 left-0 right-0 h-4 bg-sage-light rounded-b" />}
                    {pos.id === "left" && <div className="absolute top-0 bottom-0 left-0 w-4 bg-sage-light rounded-l" />}
                    {pos.id === "right" && <div className="absolute top-0 bottom-0 right-0 w-4 bg-sage-light rounded-r" />}
                    {pos.id === "behind" && <div className="absolute inset-2 bg-brand-light rounded opacity-40" />}
                    {pos.id !== "behind" && (
                      <div className="flex flex-col gap-0.5 px-1" style={{ fontSize: 3 }}>
                        {[1, 2, 3].map((l) => (
                          <div key={l} className="h-0.5 bg-light-gray rounded" style={{ width: pos.id === "left" || pos.id === "right" ? 8 : 12 }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-charcoal">{pos.label}</span>
                  <span className="text-xs text-warm-gray mt-0.5 text-center">{pos.desc}</span>
                </button>
              ))}
            </div>

            {insideImagePosition && (
              <div className="bg-faint-gray rounded-xl p-3 mb-4 text-sm text-warm-gray">
                {insideImagePosition === "top" || insideImagePosition === "middle" || insideImagePosition === "bottom"
                  ? `Horizontal banner — approximately ${cardSize === "4x6" ? "4\"" : "5\""} wide × 1" tall`
                  : insideImagePosition === "left" || insideImagePosition === "right"
                    ? `Vertical strip — approximately 1" wide × ${cardSize === "4x6" ? "6\"" : "7\""} tall`
                    : "Faded watermark behind the message text"
                }
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setStep("design_preview")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button
                onClick={async () => {
                  setIsLoading(true);
                  setLoadingMessage("Suggesting inside illustrations...");
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
                        occasion: effectiveOccasion,
                        tone,
                        position: insideImagePosition,
                        orientation,
                        artStyle: ART_STYLES.find((s) => s.id === artStyle)?.label,
                      }),
                    });
                    if (!res.ok) throw new Error("Failed to load");
                    const data = await res.json();
                    setInsideConcepts(data.designs ?? []);
                    setIsLoading(false);
                    setStep("inside_design_pick");
                    logApiCall("suggest-inside-designs", { model: "gpt-4o", callType: "chat_completion", recipientId, cardId: editCardId || undefined });
                    setSessionCost((c) => c + 0.025);
                  } catch {
                    setIsLoading(false);
                    loadFrontTextSuggestions();
                  }
                }}
                disabled={!insideImagePosition}
                className="btn-primary disabled:opacity-40"
              >
                Suggest illustrations
              </button>
              <button
                onClick={() => {
                  if (editMode) {
                    handleSave({ deliveryMethodOverride: deliveryMethod });
                  } else {
                    loadFrontTextSuggestions();
                  }
                }}
                className="btn-secondary"
              >
                {editMode ? "Save & finish" : "Skip"}
              </button>
            </div>
          </div>
        )}


        {/* Step: Inside design pick */}
        {step === "inside_design_pick" && insideConcepts.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Choose an inside decoration
            </h2>
            <p className="text-sm text-warm-gray mb-2">
              Each option uses elements from your front cover. You can request changes after (the image will be re-created with your edit).
            </p>
            <p className="text-xs text-warm-gray mb-4">
              Position: <strong>{INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label}</strong>
            </p>
            <div className="space-y-4">
              {insideConcepts.map((concept, i) => {
                // Each suggestion crops a different region of the front cover
                const cropPositions = ["top left", "center", "bottom right", "top right", "bottom left"];
                const cropPos = cropPositions[i % cropPositions.length];

                // Decoration strip preview dimensions (readable size)
                const isHorizontal = ["top", "middle", "bottom"].includes(insideImagePosition);
                const isVertical = ["left", "right"].includes(insideImagePosition);
                const stripWidth = isHorizontal ? 260 : isVertical ? 56 : 160;
                const stripHeight = isHorizontal ? 52 : isVertical ? 180 : 120;

                return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedInsideConcept(concept);
                    setInsideSceneDescription(concept.image_prompt);
                    generateDesignImage(concept.image_prompt, { isInside: true });
                  }}
                  className="w-full card-surface card-surface-clickable p-4 text-left"
                >
                  <div className="flex gap-4 items-start">
                    {/* Decoration strip preview — shows a unique crop of the front image */}
                    {generatedImageUrl && (
                      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                        <div
                          className="rounded-lg overflow-hidden border border-light-gray shadow-sm"
                          style={{ width: stripWidth, height: stripHeight }}
                        >
                          {insideImagePosition === "behind" ? (
                            <img
                              src={generatedImageUrl}
                              alt=""
                              style={{
                                width: "100%", height: "100%",
                                objectFit: "cover", objectPosition: cropPos,
                                opacity: 0.15,
                              }}
                            />
                          ) : (
                            <img
                              src={generatedImageUrl}
                              alt=""
                              style={{
                                width: "100%", height: "100%",
                                objectFit: "cover", objectPosition: cropPos,
                              }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-warm-gray">
                          {INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label} preview
                        </span>
                      </div>
                    )}

                    {/* Text description */}
                    <div className="flex-1 min-w-0 py-1">
                      <span className="text-sm font-semibold text-charcoal">{concept.title}</span>
                      <p className="text-sm text-warm-gray mt-1">{concept.description}</p>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep("inside_design_ask")}
                className="text-sm px-4 py-2 rounded-full text-warm-gray hover:text-charcoal"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                &larr; Change position
              </button>
              <button
                onClick={() => loadFrontTextSuggestions()}
                className="text-sm px-4 py-2 rounded-full text-warm-gray hover:text-charcoal ml-auto"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                Skip inside illustration
              </button>
            </div>
          </div>
        )}


        {/* Step: Confirm inside refinement */}
        {step === "inside_confirm_refinement" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Generate from updated description
            </h2>
            <p className="text-sm text-warm-gray mb-4">
              Your addition is merged into the scene below. We&apos;ll generate a new illustration from this full description. You can revert if you prefer the previous version.
            </p>

            {pendingChangeType === "refine" && pendingEditInstruction && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
                <label className="text-xs text-brand uppercase tracking-wide mb-2 block font-medium">
                  What will change
                </label>
                <textarea
                  value={pendingEditInstruction}
                  onChange={(e) => setPendingEditInstruction(e.target.value)}
                  rows={2}
                  className="input-field resize-y" style={{ borderColor: "var(--color-brand)" }}
                />
              </div>
            )}

            <div className="card-surface p-4 mb-6">
              <label className="text-xs text-warm-gray uppercase tracking-wide mb-2 block">
                Full scene description
              </label>
              <textarea
                value={pendingInsideScene}
                onChange={(e) => setPendingInsideScene(e.target.value)}
                rows={4}
                className="input-field resize-y"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPendingInsideScene("");
                  setStep("inside_design_preview");
                }}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2"
              >
                &larr; Cancel
              </button>
              <button
                onClick={() => {
                  setPreviousInsideImageUrl(insideImageUrl);
                  setInsideSceneDescription(pendingInsideScene);
                  // Always generate from the full scene description (original + added instructions). No image edit.
                  generateDesignImage(pendingInsideScene, { isInside: true, editExisting: false });
                }}
                disabled={!pendingInsideScene.trim()}
                className="flex-1 btn-primary"
              >
                Generate new illustration
              </button>
            </div>
          </div>
        )}

        {/* Step: Inside design preview & refine */}
        {step === "inside_design_preview" && insideImageUrl && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Inside illustration
            </h2>
            <p className="text-sm text-warm-gray mb-4">
              Position: <strong>{INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label}</strong>
            </p>

            <div className="card-surface p-4 mb-4">
              <p className="text-sm text-warm-gray uppercase tracking-wide mb-3 text-center">
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
            <div className="card-surface p-4 mb-6">
              <p className="text-base text-charcoal mb-2">
                Want to change something?
              </p>
              <p className="text-sm text-warm-gray mb-2">
                Describe what to add or change. The illustration will be re-created with your edit — small tweaks work best; the rest may shift slightly.
              </p>
              <div className="flex gap-2">
                <input
                  value={insideDesignFeedback}
                  onChange={(e) => setInsideDesignFeedback(e.target.value)}
                  placeholder="e.g. Warmer flower colors, add a small butterfly..."
                  className="input-field flex-1"
                />
                <button
                  onClick={() => requestInsideRefinement(insideDesignFeedback)}
                  disabled={!insideDesignFeedback.trim() || insideMerging}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {insideMerging ? "Merging..." : "Request change"}
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
                  className="mt-3 text-sm text-warm-gray hover:text-charcoal underline"
                >
                  &larr; Revert to previous image
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("inside_design_pick")}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2 rounded-full"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                &larr; Pick different
              </button>
              {editMode && (
                <button
                  onClick={() => {
                    handleSave({ deliveryMethodOverride: deliveryMethod });
                  }}
                  className="btn-brand"
                >
                  Save &amp; finish
                </button>
              )}
              <button
                onClick={() => {
                  loadFrontTextSuggestions();
                }}
                className="btn-primary"
              >
                {editMode ? "Continue: Front text" : "Next: Front text"}
              </button>
            </div>
          </div>
        )}


        {/* Step: Front text — suggestion to add wording on front */}
        {step === "front_text" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Front text &amp; font style
            </h2>
            <p className="text-sm text-warm-gray mb-6">
              Pick a suggestion, edit your own, or skip. Choose a font for the card.
            </p>

            {/* Suggestion cards */}
            {frontTextSuggestions.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">
                  Suggestions
                </label>
                <div className="grid gap-2">
                  {frontTextSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setFrontText(s.wording);
                        setFrontTextPosition(s.position);
                      }}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        frontText === s.wording
                          ? "border-brand bg-brand-light"
                          : "border-light-gray hover:border-warm-gray"
                      }`}
                    >
                      <span className="text-base font-medium text-charcoal">&ldquo;{s.wording}&rdquo;</span>
                      <span className="block text-xs text-warm-gray mt-0.5">{s.position.replace("-", " ")}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => loadFrontTextSuggestions()}
                  className="mt-2 text-sm text-brand hover:underline"
                >
                  Suggest new options
                </button>
              </div>
            )}

            <div className="card-surface p-4 mb-4">
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">
                Wording
              </label>
              <p className="text-xs text-warm-gray mb-1">Edit or type your own. Use Enter for line breaks.</p>
              <textarea
                value={frontText}
                onChange={(e) => setFrontText(e.target.value)}
                placeholder="e.g. Happy Birthday!"
                rows={3}
                className="input-field resize-y"
              />
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mt-3 mb-2">
                Position
              </label>
              <select
                value={frontTextPosition}
                onChange={(e) => setFrontTextPosition(e.target.value)}
                className="input-field"
              >
                <option value="center">Center</option>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-center">Bottom center</option>
                <option value="top-center">Top center</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mt-3 mb-2">
                Text style
              </label>
              <div className="flex gap-2">
                {([
                  { value: "white_box" as const, label: "Plain black" },
                  { value: "plain" as const, label: "Black on white" },
                  { value: "plain_white" as const, label: "Plain white" },
                  { value: "dark_box" as const, label: "White on dark" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrontTextStyle(opt.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      frontTextStyle === opt.value
                        ? "border-brand bg-brand-light text-brand"
                        : "border-light-gray text-warm-gray hover:border-light-gray"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Text style preview */}
              {frontText.trim() && (
                <div className="mt-3 rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-sage) 100%)", padding: "1.5rem", position: "relative" }}>
                  <div style={{
                    ...fontCSS(font as FontChoice),
                    fontSize: "1.1rem",
                    display: "inline-block",
                    ...(frontTextStyle === "dark_box" ? {
                      color: "#fff",
                      backgroundColor: "rgba(0,0,0,0.45)",
                      borderRadius: "0.375rem",
                      padding: "0.4rem 0.75rem",
                    } : frontTextStyle === "plain" ? {
                      color: "#111",
                      backgroundColor: "rgba(255,255,255,0.7)",
                      borderRadius: "0.375rem",
                      padding: "0.4rem 0.75rem",
                    } : frontTextStyle === "plain_white" ? {
                      color: "#fff",
                      textShadow: "0 1px 4px rgba(0,0,0,0.7)",
                    } : {
                      color: "#111",
                      textShadow: "0 1px 3px rgba(255,255,255,0.5)",
                    }),
                    whiteSpace: "pre-line",
                  }}>
                    {frontText}
                  </div>
                </div>
              )}
            </div>

            {/* Font selection — front cover */}
            <div className="card-surface p-4 mb-4">
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-3">
                Front cover font
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFont(opt.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      font === opt.id
                        ? "border-brand bg-brand-light"
                        : "border-light-gray hover:border-light-gray"
                    }`}
                  >
                    <span className="text-[0.65rem] font-medium text-warm-gray uppercase">{opt.label}</span>
                    <p className="text-base text-charcoal mt-1" style={fontCSS(opt.id)}>
                      {frontText || "Happy Birthday!"}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Font selection — inside message */}
            <div className="card-surface p-4 mb-4">
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-3">
                Inside message font
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setInsideFont(opt.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      insideFont === opt.id
                        ? "border-brand bg-brand-light"
                        : "border-light-gray hover:border-light-gray"
                    }`}
                  >
                    <span className="text-[0.65rem] font-medium text-warm-gray uppercase">{opt.label}</span>
                    <p className="text-sm text-charcoal mt-1 leading-snug" style={fontCSS(opt.id)}>
                      Wishing you all the best
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFrontText("");
                  if (editMode) {
                    handleSave({ deliveryMethodOverride: deliveryMethod });
                  } else {
                    setStep("letter");
                  }
                }}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2 rounded-full"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                Skip
              </button>
              {editMode ? (
                <button
                  onClick={() => {
                    handleSave({ deliveryMethodOverride: deliveryMethod });
                  }}
                  className="btn-brand flex-1"
                >
                  Save &amp; finish
                </button>
              ) : (
                <button
                  onClick={() => setStep("letter")}
                  className="btn-primary"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Letter insert */}
        {step === "letter" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              Include a personal letter?
            </h2>
            <p className="text-sm text-warm-gray mb-6">
              A handwritten-style note tucked inside the card — more personal than the printed message.
              You can also add or edit this later.
            </p>

            {letterText.trim() ? (
              <div className="card-surface p-5 mb-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">
                      Your letter
                    </label>
                    <p className="text-xs text-warm-gray mb-1">
                      Use blank lines to separate greeting, body, and closing — just like writing a real letter.
                    </p>
                    <textarea
                      value={letterText}
                      onChange={(e) => setLetterText(e.target.value)}
                      rows={8}
                      placeholder={"Dear " + (recipient?.first_name || recipient?.name || "friend") + ",\n\nI wanted to write you a personal note...\n\nWith love,\n" + (profile?.first_name || "Me")}
                      style={fontCSS(letterFont)}
                      className="w-full input-field rounded-lg px-3 py-2 text-sm resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Font</label>
                    <select
                      value={letterFont}
                      onChange={(e) => setLetterFont(e.target.value)}
                      className="input-field rounded-lg px-2 py-1.5 text-sm"
                      style={{ maxWidth: 200 }}
                    >
                      {CARD_FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-surface p-5 mb-4">
                <textarea
                  value={letterText}
                  onChange={(e) => setLetterText(e.target.value)}
                  rows={8}
                  placeholder={"Dear " + (recipient?.first_name || recipient?.name || "friend") + ",\n\nI wanted to write you a personal note...\n\nWith love,\n" + (profile?.first_name || "Me")}
                  style={fontCSS(letterFont)}
                  className="w-full input-field rounded-lg px-3 py-2 text-sm resize-y"
                />
                <div className="mt-2">
                  <label className="block text-xs text-warm-gray mb-1">Font</label>
                  <select
                    value={letterFont}
                    onChange={(e) => setLetterFont(e.target.value)}
                    className="input-field rounded-lg px-2 py-1.5 text-sm"
                    style={{ maxWidth: 200 }}
                  >
                    {CARD_FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("front_text")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back to front text
              </button>
              <button
                onClick={() => {
                  setLetterText("");
                  setStep("delivery");
                }}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2 rounded-full"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                Skip
              </button>
              <button
                onClick={() => setStep("delivery")}
                className="btn-primary ml-auto"
              >
                {letterText.trim() ? "Next: Choose delivery" : "Next"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Delivery */}
        {step === "delivery" && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">
              How should this card be delivered?
            </h2>
            <p className="text-sm text-warm-gray mb-6">
              {effectiveOccasion} card for {recipient.name}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleSave({ deliveryMethodOverride: "digital" })}
                className="w-full card-surface card-surface-clickable p-5 text-left"
              >
                <span className="text-sm font-semibold text-charcoal">
                  Send digitally
                </span>
                <p className="text-sm text-warm-gray mt-1">
                  Delivered via a link with an animated envelope opening experience
                </p>
              </button>
              <button
                onClick={() => handleSave({ deliveryMethodOverride: "print_at_home" })}
                className="w-full card-surface card-surface-clickable p-5 text-left"
              >
                <span className="text-sm font-semibold text-charcoal">
                  Print at home
                </span>
                <p className="text-sm text-warm-gray mt-1">
                  Download a print-ready PDF to fold and give in person
                </p>
              </button>
              <button
                onClick={() => handleSave({ deliveryMethodOverride: "mail" })}
                className="w-full card-surface card-surface-clickable p-5 text-left"
              >
                <span className="text-sm font-semibold text-charcoal">
                  Mail it
                </span>
                <p className="text-sm text-warm-gray mt-1">
                  Nuuge prints and mails a physical card (requires recipient address)
                </p>
              </button>
            </div>
            <button
              onClick={() => setStep("letter")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors mt-4"
              style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>
        )}

        {/* Step: Saved */}
        {step === "saved" && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-2xl font-bold text-charcoal mb-3">
              Card {editMode ? "updated" : "saved"}!
            </h2>
            <p className="text-warm-gray mb-8">
              Your {effectiveOccasion.toLowerCase()} card for {recipient.name} is ready
              {deliveryMethod === "digital" && " to send"}
              {deliveryMethod === "print_at_home" && " to print"}
              {deliveryMethod === "mail" && " — mailing coming soon"}.
            </p>

            {/* Delivery-specific action */}
            {deliveryMethod === "digital" && savedCardId && (
              <button
                onClick={() => router.push(`/cards/view/${savedCardId}`)}
                className="btn-primary mb-4 block mx-auto"
              >
                Preview &amp; share
              </button>
            )}

            {deliveryMethod === "print_at_home" && savedCardId && (
              <button
                onClick={() => router.push(`/cards/print/${savedCardId}`)}
                className="btn-primary mb-4 block mx-auto"
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
                    className="btn-link text-sm mt-3"
                  >
                    Print at home instead &rarr;
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center flex-wrap">
              {editMode && savedCardId && (
                <button
                  onClick={() => router.push(`/cards/edit/${savedCardId}`)}
                  className="btn-primary"
                >
                  Back to edit
                </button>
              )}
              {!editMode && (
                <button
                  onClick={() => {
                    clearDraft(recipientId);
                    setStep("occasion");
                    setOccasion("");
                    setOccasionCustom("");
                    setIncludeFaithBased(false);
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
                    setInsideFont("sans");
                    setFrontTextSuggestions([]);
                    setFrontText("");
                    setFrontTextPosition("bottom-right");
                    setFrontTextStyle("dark_box");
                    setCardSize("5x7");
                    setSavedCardId(null);
                  }}
                  className="btn-secondary"
                >
                  Create another card
                </button>
              )}
              <button
                onClick={() => router.push("/")}
                className="btn-secondary"
              >
                Back to Circle of People
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}

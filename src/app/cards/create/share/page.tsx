"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getUserProfile,
  saveCard,
  updateCard,
  hydrateCardImages,
  getRecipients,
} from "@/lib/store";
import type { Recipient } from "@/types/database";
import type { UserProfile } from "@/types/database";
import { NEWS_RECIPIENT_ID } from "@/types/database";
import { SUBJECT_RECIPES, STYLE_RECIPES, MOOD_RECIPES, buildUserFacingPrompt, getMoodRecipe, toneToMoodId } from "@/lib/card-recipes";
import { getDefaultUserDisplayName, getDefaultDisplayName, USER_KEY, MAX_SIGNERS } from "@/lib/signer-helpers";
import { fontCSS, textStyleCSS, FONT_OPTIONS as CARD_FONT_OPTIONS, isAccentPosition, cornerStyle, cornerImgStyle, edgeStyle, edgeImgStyle, frameImgStyle } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";
import { shareCard } from "@/lib/share-card";
import { copyToClipboard } from "@/lib/clipboard";
import { logApiCall, tagSessionWithCardId } from "@/lib/usage-store";
import { saveImage, getImage } from "@/lib/image-store";
import AppHeader from "@/components/AppHeader";
import { NEWS_CATEGORIES, NEWS_CATEGORY_GROUPS } from "@/lib/news-categories";

const SHARE_DRAFT_KEY = "nuuge_share_draft";

const TONES = [
  "Heartfelt and sincere",
  "Supportive and comforting",
  "Joyful and celebratory",
  "Nostalgic and reflective",
  "Warm with a touch of humor",
  "Simple and understated",
];

interface CardMessage {
  label: string;
  greeting: string;
  body: string;
  closing: string;
}

type Step =
  | "category"
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

type Stage = "message" | "design" | "details" | "deliver";
const STAGE_STEPS: Record<Stage, Step[]> = {
  message: ["category", "tone", "notes", "generating", "select", "preview"],
  design: ["design_subject", "design_style", "design_confirm_prompt", "design_loading", "design_generating", "design_confirm_refinement", "design_preview"],
  details: ["inside_design_ask", "inside_position_pick", "inside_design_loading", "inside_design_pick", "inside_design_generating", "inside_design_preview", "inside_confirm_refinement", "front_text_loading", "front_text", "letter"],
  deliver: ["delivery", "saved"],
};
const STAGE_ORDER: Stage[] = ["message", "design", "details", "deliver"];
const STAGE_LABELS: Record<Stage, string> = { message: "Message", design: "Design", details: "Details", deliver: "Deliver" };
function getStage(step: Step): Stage {
  if (STAGE_STEPS.message.includes(step)) return "message";
  if (STAGE_STEPS.design.includes(step)) return "design";
  if (STAGE_STEPS.details.includes(step)) return "details";
  return "deliver";
}

const IMAGE_SUBJECTS = SUBJECT_RECIPES.map((s) => ({ id: s.id, label: s.label, emoji: s.emoji, examples: s.examples }));
const ART_STYLES = STYLE_RECIPES.map((s) => ({ id: s.id, label: s.label, desc: s.desc }));

const INSIDE_POSITIONS = [
  { id: "top" as const, label: "Top banner", desc: "Horizontal strip across the top", icon: "▬ top", orientation: "horizontal" as const },
  { id: "middle" as const, label: "Middle band", desc: "Horizontal strip across the middle", icon: "▬ mid", orientation: "horizontal" as const },
  { id: "bottom" as const, label: "Bottom banner", desc: "Horizontal strip across the bottom", icon: "▬ btm", orientation: "horizontal" as const },
  { id: "left" as const, label: "Left edge", desc: "Vertical strip along the left", icon: "▮ left", orientation: "vertical" as const },
  { id: "right" as const, label: "Right edge", desc: "Vertical strip along the right", icon: "▮ right", orientation: "vertical" as const },
  { id: "behind" as const, label: "Watermark", desc: "Faded behind the text", icon: "◻ behind", orientation: "square" as const },
] as const;

type InsidePosition = typeof INSIDE_POSITIONS[number]["id"];

const TONE_TO_VISUAL: Record<string, string> = Object.fromEntries(
  MOOD_RECIPES.map((m) => [m.label, m.promptSnippets.join(". ")])
);

type SubjectId = string;
type StyleId = string;

interface DesignConcept {
  title: string;
  description: string;
  image_prompt: string;
}

interface ShareDraft {
  step: Step;
  newsCategory: string;
  newsDescription: string;
  tone: string;
  notes: string;
  rejectedMessages: string[];
  regenerationCount: number;
  activeProfileElements: Record<string, boolean>;
  messages: CardMessage[];
  selected: CardMessage | null;
  editedMessage: CardMessage | null;
  imageSubject: SubjectId | null;
  subjectDetail: string;
  artStyle: StyleId | null;
  personalContext: string;
  currentSceneDescription: string;
  pendingSceneDescription: string;
  userOriginalPrompt: string;
  selectedDesignTitle: string | null;
  selectedDesignPrompt: string | null;
  imageInterests: string[];
  insideImagePosition: string;
  accentPositions: number[];
  insideDesignGuidance: string;
  frontText: string;
  frontTextPosition: string;
  frontTextStyle: TextStyleChoice;
  letterText: string;
  letterFont: string;
  cardSize: "4x6" | "5x7";
  updatedAt: number;
}

function loadShareDraft(): ShareDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SHARE_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShareDraft;
  } catch {
    return null;
  }
}

function saveShareDraft(draft: ShareDraft): void {
  if (typeof window === "undefined") return;
  try {
    draft.updatedAt = Date.now();
    localStorage.setItem(SHARE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function clearShareDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SHARE_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export default function CreateSharePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("category");
  const [newsCategory, setNewsCategory] = useState("");
  const [newsDescription, setNewsDescription] = useState("");
  const [tone, setTone] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectedMessages, setRejectedMessages] = useState<string[]>([]);
  const [regenerationCount, setRegenerationCount] = useState(0);
  const [activeProfileElements, setActiveProfileElements] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<CardMessage[]>([]);
  const [selected, setSelected] = useState<CardMessage | null>(null);
  const [editedMessage, setEditedMessage] = useState<CardMessage | null>(null);
  const [imageSubject, setImageSubject] = useState<SubjectId | null>(null);
  const [subjectDetail, setSubjectDetail] = useState("");
  const [artStyle, setArtStyle] = useState<StyleId | null>(null);
  const [personalContext, setPersonalContext] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [currentSceneDescription, setCurrentSceneDescription] = useState("");
  const [designConcepts, setDesignConcepts] = useState<DesignConcept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [pendingSceneDescription, setPendingSceneDescription] = useState("");
  const [userOriginalPrompt, setUserOriginalPrompt] = useState("");
  const [selectedDesign, setSelectedDesign] = useState<DesignConcept | null>(null);
  const [insideConcepts, setInsideConcepts] = useState<DesignConcept[]>([]);
  const [insideDesignGuidance, setInsideDesignGuidance] = useState("");
  const [frontTextSuggestions, setFrontTextSuggestions] = useState<{ wording: string; position: string }[]>([]);
  const [imageInterests, setImageInterests] = useState<string[]>([]);
  const [previousImageUrl, setPreviousImageUrl] = useState<string | null>(null);
  const [previousSceneDescription, setPreviousSceneDescription] = useState<string | null>(null);
  const [designFeedback, setDesignFeedback] = useState("");
  const [merging, setMerging] = useState(false);
  const [selectedInsideConcept, setSelectedInsideConcept] = useState<DesignConcept | null>(null);
  const [insideImageUrl, setInsideImageUrl] = useState<string | null>(null);
  const [previousInsideImageUrl, setPreviousInsideImageUrl] = useState<string | null>(null);
  const [insideSceneDescription, setInsideSceneDescription] = useState("");
  const [insideDesignFeedback, setInsideDesignFeedback] = useState("");
  const [insideMerging, setInsideMerging] = useState(false);
  const [pendingInsideScene, setPendingInsideScene] = useState("");
  const [pendingChangeType, setPendingChangeType] = useState<"refine" | "redesign">("refine");
  const [pendingEditInstruction, setPendingEditInstruction] = useState("");
  const [insideImagePosition, setInsideImagePosition] = useState<InsidePosition | "corner_flourish" | "top_edge_accent" | "frame">("top");
  const [decorationType, setDecorationType] = useState<"banner" | "accent" | null>(null);
  const [accentStyle, setAccentStyle] = useState<"corner_flourish" | "top_edge_accent" | "frame" | null>(null);
  const [accentPositions, setAccentPositions] = useState<number[]>([3]);
  const [frontText, setFrontText] = useState("");
  const [frontTextPosition, setFrontTextPosition] = useState("bottom-right");
  const [frontTextStyle, setFrontTextStyle] = useState<TextStyleChoice>("plain_black");
  const [font, setFont] = useState("sans");
  const [insideFont, setInsideFont] = useState("sans");
  const [letterText, setLetterText] = useState("");
  const [letterFont, setLetterFont] = useState("handwritten");
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");
  const [deliveryMethod, setDeliveryMethod] = useState<"digital" | "print_at_home" | "mail">("digital");
  const [envelopeLabel, setEnvelopeLabel] = useState("");
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [signerRecipientIds, setSignerRecipientIds] = useState<string[]>([]);
  const [signerDisplayOverrides, setSignerDisplayOverrides] = useState<Record<string, string>>({});
  const [signerGroupName, setSignerGroupName] = useState("");
  const [useGroupSignature, setUseGroupSignature] = useState(false);
  const [customSignerNames, setCustomSignerNames] = useState<string[]>([]);
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionCost, setSessionCost] = useState(0);
  const sessionIdRef = useState(`ses_${Date.now()}`)[0];
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<ShareDraft | null>(null);

  const categoryLabel = NEWS_CATEGORIES.find((c) => c.id === newsCategory)?.label ?? newsCategory;
  const effectiveOccasion = categoryLabel || "Share a moment";

  useEffect(() => {
    setMounted(true);
    setProfile(getUserProfile());
    setAllRecipients(getRecipients().filter((r) => r.setup_complete !== false));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const draft = loadShareDraft();
    if (draft) {
      setPendingDraft(draft);
      setShowResumePrompt(true);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || showResumePrompt || pendingDraft || step === "saved") return;
    const draft: ShareDraft = {
      step,
      newsCategory,
      newsDescription,
      tone,
      notes,
      rejectedMessages,
      regenerationCount,
      activeProfileElements,
      messages,
      selected,
      editedMessage,
      imageSubject,
      subjectDetail,
      artStyle,
      personalContext,
      currentSceneDescription,
      pendingSceneDescription,
      userOriginalPrompt,
      selectedDesignTitle: selectedDesign?.title ?? null,
      selectedDesignPrompt: selectedDesign?.image_prompt ?? null,
      imageInterests,
      insideImagePosition,
      accentPositions,
      insideDesignGuidance,
      frontText,
      frontTextPosition,
      frontTextStyle,
      letterText,
      letterFont,
      cardSize,
      updatedAt: 0,
    };
    saveShareDraft(draft);
    if (generatedImageUrl?.startsWith("data:image/")) {
      saveImage("draft_share_front", generatedImageUrl).catch(() => {});
    }
    if (insideImageUrl?.startsWith("data:image/")) {
      saveImage("draft_share_inside", insideImageUrl).catch(() => {});
    }
  }, [
    mounted, showResumePrompt, pendingDraft, step,
    newsCategory, newsDescription, tone, notes, rejectedMessages, regenerationCount,
    activeProfileElements, messages, selected, editedMessage, imageSubject, subjectDetail,
    artStyle, personalContext, currentSceneDescription, pendingSceneDescription, userOriginalPrompt,
    selectedDesign, imageInterests, insideImagePosition, accentPositions, insideDesignGuidance, frontText, frontTextPosition,
    frontTextStyle, letterText, letterFont, cardSize,
    generatedImageUrl, insideImageUrl,
  ]);

  useEffect(() => {
    if (step !== "front_text_loading") return;
    loadFrontTextSuggestions();
  }, [step]);

  function extractSenderProfileElements(p: Partial<UserProfile> | null): Record<string, boolean> {
    if (!p) return {};
    const elements: Record<string, boolean> = {};
    (p.interests || []).forEach((i) => { if (typeof i === "string" && i.trim()) elements[`interest: ${i.trim()}`] = false; });
    (p.values || []).forEach((v) => { if (typeof v === "string" && v.trim()) elements[`value: ${v.trim()}`] = false; });
    if (p.personality) {
      (p.personality as string).split(/,\s*/).forEach((trait) => {
        const t = trait.trim();
        if (t) elements[`personality: ${t}`] = false;
      });
    }
    if (p.humor_style) elements[`humor style: ${p.humor_style}`] = false;
    if (p.occupation) elements[`occupation: ${p.occupation}`] = false;
    if (p.lifestyle) elements[`lifestyle: ${p.lifestyle}`] = false;
    if (p.pets) elements[`pets: ${p.pets}`] = false;
    if (p.favorite_foods) elements[`favorite foods: ${p.favorite_foods}`] = false;
    if (p.favorite_music) elements[`favorite music: ${p.favorite_music}`] = false;
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

  function isInterestLikeKey(key: string): boolean {
    return key.startsWith("interest: ") || key.startsWith("value: ") ||
      key.startsWith("occupation: ") || key.startsWith("lifestyle: ") || key.startsWith("pets: ") ||
      key.startsWith("favorite foods: ") || key.startsWith("favorite music: ");
  }
  function isToneLikeKey(key: string): boolean {
    return key.startsWith("personality: ") || key.startsWith("humor style: ");
  }

  function buildSenderContext(profileElements?: Record<string, boolean>): string {
    const p = profile;
    const base = p
      ? `Name: ${p.display_name || "Unknown"}
Personality: ${p.personality || "Not specified"}
Communication style: ${p.communication_style || "Not specified"}
Humor style (when humor applies): ${p.humor_style || "Not specified"}
Lifestyle: ${p.lifestyle || "Not specified"}`
      : "No sender context available.";

    if (!profileElements || Object.keys(profileElements).length === 0) {
      return p && p.interests?.length
        ? `${base}\nInterests: ${(p.interests as string[]).join(", ")}`
        : base;
    }

    const active = Object.entries(profileElements).filter(([, v]) => v).map(([k]) => k);
    if (active.length === 0) {
      return `${base}\n(No specific profile details selected — write a more universal, occasion-focused message.)`;
    }

    const interests = active.filter((e) => e.startsWith("interest: ")).map((e) => e.slice(10));
    const otherDetails = active.filter((e) => !e.startsWith("interest: ")).map((e) => {
      const [label, ...rest] = e.split(": ");
      return `${label.charAt(0).toUpperCase() + label.slice(1)}: ${rest.join(": ")}`;
    });

    return `${base}
${interests.length > 0 ? `Interests (use these): ${interests.join(", ")}` : "Interests: Not specified"}
${otherDetails.join("\n")}`.replace(/\n{2,}/g, "\n");
  }

  async function generateMessages() {
    let nextRegenCount = regenerationCount;
    let effectiveRejected = rejectedMessages;
    if (messages.length > 0) {
      const currentAsText = messages.map((m) => `[${m.label}] ${m.greeting} ${m.body} ${m.closing}`);
      effectiveRejected = [...rejectedMessages, ...currentAsText];
      setRejectedMessages(effectiveRejected);
      nextRegenCount = regenerationCount + 1;
      setRegenerationCount(nextRegenCount);

      if (nextRegenCount >= 2) {
        const updated = { ...activeProfileElements };
        const activeKeys = Object.keys(activeProfileElements).filter((k) => activeProfileElements[k]);
        const activeInterestLike = activeKeys.filter(isInterestLikeKey);
        const activeToneLike = activeKeys.filter(isToneLikeKey);

        if (nextRegenCount === 2) {
          const interestOffCount = Math.max(0, Math.floor(activeInterestLike.length * 0.5));
          activeInterestLike.slice(0, interestOffCount).forEach((k) => { updated[k] = false; });
        } else {
          activeInterestLike.forEach((k) => { updated[k] = false; });
          const toneKeepCount = Math.max(0, Math.floor(activeToneLike.length * 0.2));
          activeToneLike.slice(toneKeepCount).forEach((k) => { updated[k] = false; });
        }
        setActiveProfileElements(updated);
      }
    }

    if (Object.keys(activeProfileElements).length === 0 && profile) {
      const elements = extractSenderProfileElements(profile);
      setActiveProfileElements(elements);
    }

    setIsLoading(true);
    setLoadingMessage("Writing your message...");
    setError(null);

    const elementsToUse = Object.keys(activeProfileElements).length > 0
      ? activeProfileElements
      : (profile ? extractSenderProfileElements(profile) : undefined);

    try {
      const res = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "news",
          senderContext: buildSenderContext(elementsToUse),
          newsCategory: categoryLabel,
          newsDescription: newsDescription.trim() || "General update to share with others",
          tone,
          additionalNotes: notes,
          cardHistory: [],
          regenerationCount: nextRegenCount,
          rejectedMessages: effectiveRejected.length > 0 ? effectiveRejected : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate");
      }
      const data = await res.json();
      setMessages(data.messages);
      setStep("select");
      logApiCall("generate-card", { model: "gpt-4o", callType: "chat_completion", sessionId: sessionIdRef });
      setSessionCost((c) => c + 0.025);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  function getActiveInterests(): string[] {
    if (imageInterests.length > 0) return imageInterests;
    return (profile?.interests as string[]) || [];
  }

  function buildImagePrompt(): string {
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

  function reviewCardDesign() {
    const prompt = buildImagePrompt();
    setPendingSceneDescription(prompt);
    setUserOriginalPrompt(prompt);
    setDesignConcepts([]);
    setConceptsLoading(true);
    const fullMessage = editedMessage ? `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${editedMessage.closing}` : "";
    const senderCtx = buildSenderContext(Object.keys(activeProfileElements).length > 0 ? activeProfileElements : undefined);
    const recipientCtx = "This card has no specific recipient. The sender is sharing a moment, reflection, or life update. Design concepts should feel personal to the sender and universally appreciable.";
    fetch("/api/suggest-designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderContext: senderCtx,
        recipientContext: recipientCtx,
        occasion: effectiveOccasion,
        tone,
        messageText: fullMessage,
        additionalNotes: notes,
        preferredSubject: imageSubject ? IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label : undefined,
        preferredStyle: artStyle ? ART_STYLES.find((s) => s.id === artStyle)?.label : undefined,
        preferredMood: TONE_TO_VISUAL[tone] || undefined,
      }),
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Failed")))
      .then((data) => {
        setDesignConcepts(data.designs ?? []);
        logApiCall("suggest-designs", { model: "gpt-4o", callType: "chat_completion", sessionId: sessionIdRef });
        setSessionCost((c) => c + 0.025);
      })
      .catch(() => setDesignConcepts([]))
      .finally(() => setConceptsLoading(false));
    setStep("design_confirm_prompt");
  }


  function insideImageOrientation(): "horizontal" | "vertical" | "square" {
    if (insideImagePosition === "corner_flourish") return "square";
    if (insideImagePosition === "frame") return "vertical";
    if (insideImagePosition === "top_edge_accent") return "horizontal";
    return INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.orientation ?? "horizontal";
  }

  function insideImageSizeStr(): "1536x1024" | "1024x1536" | "1024x1024" {
    const o = insideImageOrientation();
    if (o === "horizontal") return "1536x1024";
    if (o === "vertical") return "1024x1536";
    return "1024x1024";
  }

  function buildAccentPrompt(accent: "corner_flourish" | "top_edge_accent" | "frame"): string {
    const styleLabel = ART_STYLES.find((s) => s.id === artStyle)?.label || "elegant";
    const base = `${styleLabel}-style decorative element for a greeting card interior. Delicate, subtle, refined ornamental design. PURE WHITE (#FFFFFF) background — absolutely no cream, ivory, beige, or off-white tones. The background must be perfectly white. No text, no words, no letters.`;
    switch (accent) {
      case "corner_flourish":
        return `Create a single corner flourish ornament in ${base} The design should be a decorative scroll or floral motif for one corner only, occupying roughly the bottom-right quarter of the image. The rest of the image must be pure white/empty. The flourish should be elegant and minimal — thin delicate lines.`;
      case "top_edge_accent":
        return `Create a horizontal decorative ornamental strip in ${base} A wide, short decorative motif or garland suitable for the top edge of a card. Centered composition, symmetrical, with ornamental scrollwork or subtle botanical flourishes. The strip should span the full width but be short in height.`;
      case "frame":
        return `Create a subtle ornamental border frame in ${base} A delicate decorative frame around the edges of the image with a completely white/empty center (at least 70% of the area must be empty white space). Light decorative flourish corners, thin ornamental lines along the edges. The frame should be refined and minimal — not heavy or ornate.`;
    }
  }

  async function generateDesignImage(
    prompt: string,
    options?: { isInside?: boolean; editExisting?: boolean; editInstruction?: string; isAccent?: boolean }
  ) {
    const isInside = options?.isInside ?? false;
    const editExisting = options?.editExisting ?? false;
    const isAccent = options?.isAccent ?? false;
    setIsLoading(true);
    setLoadingMessage(isInside ? (isAccent ? "Creating decorative accent..." : "Creating inside illustration...") : "Creating card artwork...");
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
          insideImageSize: isInside ? insideImageSizeStr() : undefined,
          frontImageBase64: (isInside && !isAccent) ? (generatedImageUrl || undefined) : undefined,
          editInstruction: editExisting ? (options?.editInstruction || undefined) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate image");
      }
      const data = await res.json();
      if (isInside) {
        setInsideImageUrl(data.imageUrl);
        setStep("inside_design_preview");
      } else {
        setGeneratedImageUrl(data.imageUrl);
        setCurrentSceneDescription(prompt);
        setStep("design_preview");
      }
      logApiCall("generate-image", { model: "gpt-image-1", callType: editExisting ? "image_edit" as "image_edit" : "image_generate", sessionId: sessionIdRef });
      setSessionCost((c) => c + 0.08);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
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
      logApiCall("merge-scene", { model: "gpt-4o-mini", callType: "chat_completion", sessionId: sessionIdRef });
      setSessionCost((c) => c + 0.005);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setMerging(false);
    }
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
      logApiCall("merge-scene", { model: "gpt-4o-mini", callType: "chat_completion", sessionId: sessionIdRef });
      setSessionCost((c) => c + 0.005);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInsideMerging(false);
    }
  }

  async function loadFrontTextSuggestions() {
    const previousWordings = frontTextSuggestions.map((s) => s.wording);
    setIsLoading(true);
    setLoadingMessage("Thinking of front text options...");
    const fullMessage = editedMessage ? `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${editedMessage.closing}` : "";
    try {
      const res = await fetch("/api/suggest-front-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: effectiveOccasion,
          tone,
          recipientName: "",
          relationshipType: undefined,
          previousWordings: previousWordings.length > 0 ? previousWordings : undefined,
          messageText: fullMessage,
          artStyle: artStyle ? ART_STYLES.find((s) => s.id === artStyle)?.label : undefined,
          imageSubject: imageSubject ? IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label : undefined,
          sceneDescription: currentSceneDescription || undefined,
        }),
      });
      const data = await res.json();
      const suggestions: { wording: string; position: string }[] = Array.isArray(data.suggestions)
        ? data.suggestions
        : data.wording ? [{ wording: data.wording, position: data.position ?? "bottom-right" }] : [];
      setFrontTextSuggestions(suggestions);
      if (suggestions.length > 0) {
        setFrontText(suggestions[0].wording);
        setFrontTextPosition(suggestions[0].position);
      }
      logApiCall("suggest-front-text", { model: "gpt-4o", callType: "chat_completion", sessionId: sessionIdRef });
      setSessionCost((c) => c + 0.025);
    } catch {
      setFrontTextSuggestions([]);
      setFrontText("");
      setFrontTextPosition("bottom-right");
    } finally {
      setIsLoading(false);
      setStep("front_text");
    }
  }

  async function handleSave(options?: { deliveryMethodOverride?: "digital" | "print_at_home" | "mail" }) {
    if (!editedMessage) return;
    const method = options?.deliveryMethodOverride ?? deliveryMethod;
    const overriddenName = signerDisplayOverrides[USER_KEY]?.trim();
    const profileName = profile?.display_name || profile?.first_name || "";
    let closingText = editedMessage.closing;
    if (overriddenName && profileName && overriddenName !== profileName && closingText.includes(profileName)) {
      closingText = closingText.replace(new RegExp(profileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), overriddenName);
    }
    const fullText = `${editedMessage.greeting}\n\n${editedMessage.body}\n\n${closingText}`;
    const cardData: Partial<import("@/types/database").Card> = {
      user_id: "local",
      recipient_id: NEWS_RECIPIENT_ID,
      recipient_ids: [] as string[],
      card_type: "news" as const,
      news_category: categoryLabel,
      news_description: newsDescription.trim() || null,
      occasion: categoryLabel,
      message_text: fullText,
      image_url: generatedImageUrl,
      image_prompt: selectedDesign?.image_prompt || currentSceneDescription || null,
      inside_image_url: insideImageUrl,
      inside_image_prompt: selectedInsideConcept?.image_prompt || insideSceneDescription || null,
      front_text: frontText.trim() || null,
      front_text_position: frontText.trim() ? frontTextPosition : null,
      front_text_style: frontTextStyle,
      front_text_font: font,
      font: insideFont,
      inside_image_position: insideImageUrl ? insideImagePosition : undefined,
      accent_positions: insideImageUrl && isAccentPosition(insideImagePosition) ? accentPositions : undefined,
      image_subject: imageSubject,
      art_style: artStyle,
      tone_used: tone,
      style: editedMessage.label,
      delivery_method: method,
      sent: false,
      envelope_label: envelopeLabel.trim() || null,
      signer_recipient_ids: signerRecipientIds.length ? signerRecipientIds : undefined,
      signer_display_overrides: Object.keys(signerDisplayOverrides).length ? signerDisplayOverrides : undefined,
      signer_group_name: useGroupSignature && signerGroupName.trim() ? signerGroupName.trim() : null,
      card_size: cardSize,
      msg_font_scale: 0,
      ft_font_scale: 1,
      letter_text: letterText.trim() || null,
      letter_font: letterText.trim() ? letterFont : null,
      letter_font_scale: 1,
    };

    const saved = await saveCard(cardData);
    if (saved && typeof saved === "object" && "id" in saved) {
      setSavedCardId(saved.id);
      tagSessionWithCardId(sessionIdRef, saved.id);
      setDeliveryMethod(method);
      clearShareDraft();
      if (method === "print_at_home") {
        router.push(`/cards/print/${saved.id}`);
        return;
      }
      setStep("saved");
    }
  }

  function applyShareDraft(d: ShareDraft) {
    let stepToRestore = d.step;
    if (d.step === "generating" || d.step === "select") stepToRestore = "notes";
    if (d.step === "design_style" || d.step === "design_loading") stepToRestore = "design_subject";
    if (d.step === "design_generating" || d.step === "design_confirm_refinement") stepToRestore = "design_confirm_prompt";
    if (d.step === "design_preview") stepToRestore = "design_confirm_prompt";
    if (d.step === "inside_design_loading") stepToRestore = "inside_design_ask";
    if (d.step === "inside_position_pick") stepToRestore = "inside_design_ask";
    if (d.step === "inside_design_generating" || d.step === "inside_confirm_refinement") stepToRestore = "inside_design_pick";
    if (d.step === "inside_design_preview") stepToRestore = "inside_design_pick";
    if (d.step === "front_text_loading") stepToRestore = "inside_design_ask";
    setStep(stepToRestore);
    setNewsCategory(d.newsCategory);
    setNewsDescription(d.newsDescription ?? "");
    setTone(d.tone);
    setNotes(d.notes);
    setRejectedMessages(d.rejectedMessages ?? []);
    setRegenerationCount(d.regenerationCount ?? 0);
    setActiveProfileElements(normalizeProfileElements(d.activeProfileElements ?? {}));
    setMessages(d.messages ?? []);
    setSelected(d.selected);
    setEditedMessage(d.editedMessage);
    setImageSubject(d.imageSubject);
    setSubjectDetail(d.subjectDetail ?? "");
    setArtStyle(d.artStyle);
    setPersonalContext(d.personalContext ?? "");
    setCurrentSceneDescription(d.currentSceneDescription ?? "");
    setPendingSceneDescription(d.pendingSceneDescription ?? d.currentSceneDescription ?? "");
    setUserOriginalPrompt(d.userOriginalPrompt ?? d.currentSceneDescription ?? "");
    if (d.selectedDesignTitle && d.selectedDesignPrompt) {
      setSelectedDesign({ title: d.selectedDesignTitle, description: "", image_prompt: d.selectedDesignPrompt });
    }
    setImageInterests(d.imageInterests ?? []);
    setInsideImagePosition((d.insideImagePosition as typeof insideImagePosition) ?? "top");
    setAccentPositions(d.accentPositions ?? [3]);
    if (isAccentPosition(d.insideImagePosition)) {
      setDecorationType("accent");
      setAccentStyle(d.insideImagePosition as "corner_flourish" | "top_edge_accent" | "frame");
    }
    setInsideDesignGuidance(d.insideDesignGuidance ?? "");
    setFrontText(d.frontText ?? "");
    setFrontTextPosition(d.frontTextPosition ?? "bottom-right");
    setFrontTextStyle((d.frontTextStyle as TextStyleChoice) ?? "plain_black");
    setLetterText(d.letterText ?? "");
    setLetterFont(d.letterFont ?? "handwritten");
    setCardSize(d.cardSize ?? "5x7");
    getImage("draft_share_front").then((img) => { if (img) setGeneratedImageUrl(img); }).catch(() => {});
    getImage("draft_share_inside").then((img) => { if (img) setInsideImageUrl(img); }).catch(() => {});
    setShowResumePrompt(false);
    setPendingDraft(null);
  }

  function handleStartFreshShare() {
    clearShareDraft();
    setPendingDraft(null);
    setShowResumePrompt(false);
    setStep("category");
    setNewsCategory("");
    setNewsDescription("");
    setTone("");
    setNotes("");
    setRejectedMessages([]);
    setRegenerationCount(0);
    setActiveProfileElements({});
    setMessages([]);
    setSelected(null);
    setEditedMessage(null);
    setImageSubject(null);
    setSubjectDetail("");
    setArtStyle(null);
    setPersonalContext("");
    setImageInterests([]);
    setGeneratedImageUrl(null);
    setPreviousImageUrl(null);
    setPreviousSceneDescription(null);
    setCurrentSceneDescription("");
    setPendingSceneDescription("");
    setUserOriginalPrompt("");
    setSelectedDesign(null);
    setDesignFeedback("");
    setDecorationType(null);
    setAccentStyle(null);
    setAccentPositions([3]);
    setInsideImageUrl(null);
    setPreviousInsideImageUrl(null);
    setInsideSceneDescription("");
    setInsideDesignFeedback("");
    setSelectedInsideConcept(null);
    setFrontText("");
    setLetterText("");
  }

  async function handleShare() {
    if (!savedCardId || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const all = (await import("@/lib/store")).getCards();
      const card = all.find((c) => c.id === savedCardId);
      if (!card) throw new Error("Card not found");
      const hydrated = await hydrateCardImages(card);
      const profile = getUserProfile();
      const senderNames = getDefaultUserDisplayName(profile);
      const result = await shareCard(hydrated, "To someone special", senderNames);
      if ("error" in result) throw new Error(result.error);
      setShareUrl(result.shareUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setSharing(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader>
        <div className="relative flex items-center w-full" style={{ minHeight: "2rem" }}>
          <button
            onClick={() => router.push("/")}
            className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Home
          </button>
          <h1 className="absolute inset-0 flex items-center justify-center text-lg font-semibold pointer-events-none" style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-heading)" }}>
            Share a moment
          </h1>
          {sessionCost > 0 && (
            <span className="ml-auto relative z-10 text-xs text-warm-gray" title="Estimated AI cost this session">
              ~${sessionCost.toFixed(2)}
            </span>
          )}
        </div>
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
                      background: isActive ? "var(--color-brand)" : isPast ? "var(--color-sage)" : "var(--color-light-gray)",
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
                    <div className="w-8 h-px" style={{ background: isPast ? "var(--color-sage)" : "var(--color-light-gray)" }} />
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
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>
            {error}
          </div>
        )}

        {showResumePrompt && pendingDraft && (
          <div className="rounded-xl p-6 border-2 text-center" style={{ background: "var(--color-white)", borderColor: "var(--color-sage-light)" }}>
            <p className="text-lg font-medium text-charcoal mb-1">Resume your draft?</p>
            <p className="text-sm text-warm-gray mb-4">
              You have a Share a moment card in progress. Pick up where you left off or start over.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={() => applyShareDraft(pendingDraft)} className="btn-primary">
                Resume
              </button>
              <button onClick={handleStartFreshShare} className="btn-secondary">
                Start fresh
              </button>
            </div>
          </div>
        )}

        {step === "category" && !showResumePrompt && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">Share a moment</h2>
            <p className="text-warm-gray mb-6">Choose what this card is about. We&apos;ll help you write something personal and design it beautifully.</p>
            <div className="space-y-5 mb-6">
              {NEWS_CATEGORY_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--color-warm-gray)" }}>{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setNewsCategory(c.id)}
                        className="rounded-xl px-4 py-3 text-left text-sm font-medium transition-all"
                        style={newsCategory === c.id ? { background: "var(--color-brand)", color: "#fff" } : { background: "var(--color-white)", border: "1.5px solid var(--color-sage-light)" }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <label className="block text-sm font-medium text-charcoal mb-2">Tell us more (optional)</label>
            <textarea
              value={newsDescription}
              onChange={(e) => setNewsDescription(e.target.value)}
              placeholder="Add details about your news — names, dates, or anything you want in the message"
              className="input-field rounded-xl w-full py-3 min-h-[100px] resize-none"
              rows={4}
            />
            <button
              onClick={() => setStep("tone")}
              disabled={!newsCategory}
              className="btn-primary mt-6 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        {step === "tone" && !showResumePrompt && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-4">What tone?</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-all"
                  style={tone === t ? { background: "var(--color-brand)", color: "#fff" } : { background: "var(--color-white)", border: "1.5px solid var(--color-sage-light)" }}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setStep("notes")} className="btn-primary">
              Next
            </button>
          </div>
        )}

        {step === "notes" && !showResumePrompt && (
          <div>
            <h2 className="text-2xl font-bold text-charcoal mb-2">Add a personal touch</h2>
            <p className="text-sm text-warm-gray mb-4">
              Optional — give Nuuge something specific to weave into the message, or leave it blank.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. mention the date, a special memory..."
              className="input-field rounded-xl w-full py-3 min-h-[80px] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setStep("tone")} className="btn-secondary">Back</button>
              <button onClick={generateMessages} className="btn-primary">
                Generate card messages
              </button>
            </div>
          </div>
        )}

        {step === "select" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Pick your favorite</h2>
            <p className="text-sm text-warm-gray mb-6">
              Here are 3 options for your {effectiveOccasion.toLowerCase()} message. Click one to preview and edit.
            </p>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelected(msg);
                    setEditedMessage({ ...msg });
                    setStep("preview");
                  }}
                  className="w-full text-left p-5 rounded-xl border transition-all hover:opacity-90"
                  style={{ borderColor: "var(--color-sage-light)", background: "var(--color-white)" }}
                >
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-brand)" }}>{msg.label}</span>
                  <p className="text-sm font-medium text-charcoal mt-2">{msg.greeting}</p>
                  <p className="text-sm text-warm-gray mt-1">{msg.body}</p>
                  <p className="text-sm text-warm-gray mt-1 italic whitespace-pre-line">{msg.closing}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep("notes")} className="btn-secondary">Back</button>
              <button onClick={generateMessages} className="btn-primary">
                Regenerate all
              </button>
            </div>
          </div>
        )}

        {step === "preview" && editedMessage && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Preview &amp; edit</h2>
            <p className="text-sm text-warm-gray mb-6">Adjust anything you want, then continue.</p>
            <div className="rounded-xl p-6 space-y-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <div>
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-1">Greeting</label>
                <input
                  value={editedMessage.greeting}
                  onChange={(e) => setEditedMessage({ ...editedMessage, greeting: e.target.value })}
                  className="input-field rounded-lg w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-1">Message</label>
                <textarea
                  value={editedMessage.body}
                  onChange={(e) => setEditedMessage({ ...editedMessage, body: e.target.value })}
                  rows={4}
                  className="input-field rounded-lg w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-1">Closing</label>
                <textarea
                  value={editedMessage.closing}
                  onChange={(e) => setEditedMessage({ ...editedMessage, closing: e.target.value })}
                  rows={2}
                  placeholder="e.g. Love,&#10;Your name"
                  className="input-field rounded-lg w-full resize-none"
                />
                <p className="text-xs text-warm-gray mt-0.5">Put your name on a new line below the phrase.</p>
              </div>
            </div>
            <div className="rounded-xl p-8 text-center mb-6" style={{ background: "var(--color-brand-light)", border: "1.5px solid var(--color-sage)" }}>
              <p className="text-xs text-warm-gray uppercase tracking-wide mb-4">Card preview</p>
              <p className="text-charcoal text-left max-w-sm mx-auto" style={fontCSS(insideFont)}>
                <span className="font-medium">{editedMessage.greeting}</span>
                {"\n\n"}
                <span className="whitespace-pre-wrap">{editedMessage.body}</span>
                {"\n\n"}
                <span className="italic whitespace-pre-line text-warm-gray">{editedMessage.closing}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("select")} className="btn-secondary">Pick a different one</button>
              <button onClick={() => setStep("design_subject")} className="btn-primary">Next: Design the card</button>
            </div>
          </div>
        )}

        {step === "design_subject" && !showResumePrompt && (() => {
          const moodRec = getMoodRecipe(tone);
          const recommended = moodRec?.recommendedSubjects || [];
          const moodId = toneToMoodId(tone);
          const selectedSubjectRecipe = SUBJECT_RECIPES.find((s) => s.id === imageSubject);
          const sceneSketches = selectedSubjectRecipe?.sceneSketches?.[moodId] || [];
          return (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-1">Design your card</h2>
            <p className="text-base text-warm-gray mb-6">
              Pick the main subject for your card&apos;s front image.
              {recommended.length > 0 && (
                <span className="text-brand"> Stars mark subjects that pair well with &ldquo;{tone.toLowerCase()}&rdquo;.</span>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {IMAGE_SUBJECTS.map((s) => {
                const isRecommended = recommended.includes(s.id);
                return (
                <button
                  key={s.id}
                  onClick={() => setImageSubject(s.id)}
                  className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all relative
                    ${imageSubject === s.id
                      ? "border-brand bg-brand-light shadow-md"
                      : isRecommended
                        ? "border-sage-light hover:border-sage hover:shadow-sm"
                        : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                    }`}
                  style={imageSubject === s.id
                    ? { borderColor: "var(--color-brand)", background: "var(--color-brand-light)" }
                    : isRecommended
                      ? { borderColor: "var(--color-sage-light)", background: "rgba(232, 245, 233, 0.3)" }
                      : { borderColor: "var(--color-light-gray)", background: "var(--color-white)" }}
                >
                  {isRecommended && (
                    <span className="absolute top-1.5 right-2 text-sage text-sm" title="Recommended for this tone">★</span>
                  )}
                  <span className="text-3xl mb-2">{s.emoji}</span>
                  <span className="text-base font-semibold text-charcoal">{s.label}</span>
                  <span className="text-sm text-warm-gray mt-1 text-center">{s.examples}</span>
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
                      {sceneSketches.map((sketch: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setSubjectDetail(sketch)}
                          className={`block w-full text-left text-base px-3 py-2.5 rounded-lg transition-colors
                            ${subjectDetail === sketch
                              ? "bg-brand-light text-brand-hover font-medium"
                              : "text-charcoal hover:bg-white/60"
                            }`}
                          style={subjectDetail === sketch ? { background: "var(--color-brand-light)", color: "var(--color-brand)" } : {}}
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
                    placeholder={`e.g. ${IMAGE_SUBJECTS.find((x) => x.id === imageSubject)?.examples || "describe what you want"}`}
                    className="input-field rounded-xl"
                  />
                </div>
              </>
            )}

            {imageSubject && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--color-light-gray)" }}>
                <h3 className="text-lg font-bold text-charcoal mb-1">
                  Choose the artistic style
                </h3>
                <p className="text-base text-warm-gray mb-4">
                  This sets the visual look and feel of your card.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ART_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setArtStyle(s.id)}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left
                        ${artStyle === s.id
                          ? "border-brand bg-brand-light shadow-md"
                          : "border-light-gray bg-white hover:border-sage hover:shadow-sm"
                        }`}
                      style={artStyle === s.id ? { borderColor: "var(--color-brand)", background: "var(--color-brand-light)" } : {}}
                    >
                      <span className="text-base font-semibold text-charcoal">{s.label}</span>
                      <span className="text-sm text-warm-gray mt-1">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep("preview")} className="btn-secondary">Back</button>
              <button
                onClick={reviewCardDesign}
                disabled={!imageSubject || !artStyle}
                className="btn-primary disabled:opacity-40"
              >
                Review card design
              </button>
            </div>
          </div>
          );
        })()}

        {step === "design_confirm_prompt" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Review your card design</h2>
            <p className="text-sm text-warm-gray mb-4">
              Your design is ready. Nuuge also created a few alternative ideas below — tap any to try it, or go with yours.
            </p>
            <div className="mb-2">
              <p className="text-sm font-medium text-charcoal mb-2">My design</p>
              <button
                onClick={() => setPendingSceneDescription(userOriginalPrompt)}
                className="w-full p-4 rounded-xl border-2 text-left transition-all"
                style={pendingSceneDescription === userOriginalPrompt
                  ? { borderColor: "var(--color-brand)", background: "var(--color-brand-light)" }
                  : { borderColor: "var(--color-light-gray)", background: "var(--color-white)" }}
              >
                <span className="text-base font-semibold text-charcoal">
                  {IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label || "Custom"}
                  {subjectDetail && ` — ${subjectDetail}`}
                </span>
                <p className="text-sm text-warm-gray mt-1">
                  {ART_STYLES.find((s) => s.id === artStyle)?.label || ""} · {tone}
                </p>
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium text-charcoal mb-2 mt-4">Design ideas from Nuuge</p>
              {conceptsLoading && (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--color-light-gray)", borderTopColor: "var(--color-brand)" }} />
                  <span className="text-sm text-warm-gray">Nuuge is brainstorming alternatives…</span>
                </div>
              )}
              {!conceptsLoading && designConcepts.length > 0 && (
                <div className="space-y-3">
                  {designConcepts.map((concept, i) => (
                    <button
                      key={i}
                      onClick={() => setPendingSceneDescription(concept.image_prompt)}
                      className="w-full p-4 rounded-xl border-2 text-left transition-all"
                      style={pendingSceneDescription === concept.image_prompt
                        ? { borderColor: "var(--color-brand)", background: "var(--color-brand-light)" }
                        : { borderColor: "var(--color-light-gray)", background: "var(--color-white)" }}
                    >
                      <span className="text-base font-semibold text-charcoal">{concept.title}</span>
                      <p className="text-sm text-warm-gray mt-1">{concept.description}</p>
                    </button>
                  ))}
                </div>
              )}
              {!conceptsLoading && designConcepts.length === 0 && (
                <p className="text-sm text-warm-gray py-4">Couldn&apos;t load alternatives. You can still generate from your prompt below.</p>
              )}
            </div>
            <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--color-light-gray)" }}>
              <label className="text-sm font-medium text-charcoal mb-2 block">Image prompt (editable)</label>
              <textarea
                value={pendingSceneDescription}
                onChange={(e) => setPendingSceneDescription(e.target.value)}
                rows={6}
                className="input-field resize-y mb-4 w-full"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("design_subject")} className="btn-secondary">Back</button>
              <button
                onClick={() => {
                  const p = pendingSceneDescription.trim();
                  const matchedConcept = designConcepts.find((c) => c.image_prompt === p);
                  setSelectedDesign(matchedConcept || { title: "Custom", description: "", image_prompt: p });
                  setCurrentSceneDescription(p);
                  generateDesignImage(p);
                }}
                disabled={!pendingSceneDescription.trim() || conceptsLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {conceptsLoading ? "Waiting for Nuuge ideas…" : "Generate image"}
              </button>
            </div>
          </div>
        )}

        {step === "design_confirm_refinement" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Generate from updated description</h2>
            <p className="text-sm text-warm-gray mb-4">
              Your addition is merged into the scene below. We&apos;ll generate a new image from this full description. You can revert if you prefer the previous version.
            </p>
            {pendingChangeType === "refine" && pendingEditInstruction && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
                <label className="text-xs text-brand uppercase tracking-wide mb-2 block font-medium">What will change</label>
                <textarea value={pendingEditInstruction} onChange={(e) => setPendingEditInstruction(e.target.value)} rows={2} className="input-field resize-y" style={{ borderColor: "var(--color-brand)" }} />
              </div>
            )}
            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <label className="text-xs text-warm-gray uppercase tracking-wide mb-2 block">Full scene description</label>
              <textarea value={pendingSceneDescription} onChange={(e) => setPendingSceneDescription(e.target.value)} rows={4} className="input-field resize-y" />
            </div>
            {error && <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => setStep("design_preview")} className="text-sm text-warm-gray hover:text-charcoal px-4 py-2">&larr; Cancel</button>
              <button
                onClick={() => {
                  setPreviousImageUrl(generatedImageUrl);
                  setPreviousSceneDescription(currentSceneDescription);
                  setCurrentSceneDescription(pendingSceneDescription);
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

        {step === "design_preview" && generatedImageUrl && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Your card design</h2>
            <p className="text-sm text-warm-gray mb-6">
              {selectedDesign?.title} — request a change or move on.
            </p>
            <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <p className="text-xs text-warm-gray uppercase tracking-wide mb-3 text-center">Card front</p>
              <img src={generatedImageUrl} alt="Card design" className="w-full max-w-md mx-auto rounded-lg" />
            </div>
            {editedMessage && (
              <div className="rounded-xl p-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
                <p className="text-xs text-warm-gray uppercase tracking-wide mb-3 text-center">Card inside</p>
                <div className="max-w-sm mx-auto rounded-xl p-6" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", ...fontCSS(insideFont as FontChoice) }}>
                  <p className="text-base font-medium text-charcoal mb-2">{editedMessage.greeting}</p>
                  <p className="text-sm text-charcoal leading-relaxed mb-2 whitespace-pre-wrap">{editedMessage.body}</p>
                  <p className="text-sm text-warm-gray whitespace-pre-line">{editedMessage.closing}</p>
                </div>
              </div>
            )}
            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <p className="text-sm text-charcoal mb-2">Want to change something?</p>
              <p className="text-xs text-warm-gray mb-2">Describe what to add or change. Nuuge will re-create the whole image with your edit — small tweaks tend to work best.</p>
              <div className="flex gap-2">
                <input value={designFeedback} onChange={(e) => setDesignFeedback(e.target.value)} placeholder="e.g. Add a warm sunset glow, make the colors softer..." className="input-field flex-1" />
                <button onClick={() => requestRefinement(designFeedback)} disabled={!designFeedback.trim() || merging} className="btn-secondary text-sm disabled:opacity-50">
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
                  &larr; Revert to previous image
                </button>
              )}
            </div>
            {error && <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>{error}</div>}
            <div className="flex gap-3">
              <button
                onClick={() => { setDesignFeedback(""); setCurrentSceneDescription(""); setPreviousImageUrl(null); setPreviousSceneDescription(null); setStep("design_confirm_prompt"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                {designConcepts.length > 0 ? "Pick different design" : "Back to design builder"}
              </button>
              <button onClick={() => setStep("inside_design_ask")} className="btn-primary">
                Next: Inside &amp; front text
              </button>
            </div>
          </div>
        )}

        {step === "inside_design_ask" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Add an inside decoration?</h2>
            <p className="text-sm text-warm-gray mb-6">Enhance the inside of your card with artwork or a decorative touch.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => { setDecorationType(decorationType === "banner" ? null : "banner"); }}
                className={`flex flex-col items-center p-5 rounded-xl border-2 transition-all ${decorationType === "banner" ? "border-brand bg-brand-light shadow-md" : "border-light-gray bg-white hover:border-sage hover:shadow-sm"}`}
              >
                <div className="w-20 h-24 border border-light-gray rounded bg-white relative mb-3 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-5 bg-sage-light rounded-t" />
                  <div className="flex flex-col gap-0.5 items-center justify-center px-2 mt-7" style={{ fontSize: 3 }}>
                    {[1,2,3].map((l) => <div key={l} className="h-0.5 bg-light-gray rounded" style={{ width: 14 }} />)}
                  </div>
                </div>
                <span className="text-sm font-semibold text-charcoal">Image banner</span>
                <span className="text-xs text-warm-gray mt-1 text-center">Extends your front image inside</span>
              </button>
              <button
                onClick={() => { setDecorationType(decorationType === "accent" ? null : "accent"); setAccentStyle(null); }}
                className={`flex flex-col items-center p-5 rounded-xl border-2 transition-all ${decorationType === "accent" ? "border-brand bg-brand-light shadow-md" : "border-light-gray bg-white hover:border-sage hover:shadow-sm"}`}
              >
                <div className="w-20 h-24 border border-light-gray rounded bg-white relative mb-3 overflow-hidden flex items-center justify-center">
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl" style={{ borderColor: "var(--color-sage)" }} />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr" style={{ borderColor: "var(--color-sage)" }} />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl" style={{ borderColor: "var(--color-sage)" }} />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br" style={{ borderColor: "var(--color-sage)" }} />
                  <div className="flex flex-col gap-0.5 px-2" style={{ fontSize: 3 }}>
                    {[1,2,3].map((l) => <div key={l} className="h-0.5 bg-light-gray rounded" style={{ width: 10 }} />)}
                  </div>
                </div>
                <span className="text-sm font-semibold text-charcoal">Decorative accent</span>
                <span className="text-xs text-warm-gray mt-1 text-center">Corners, edge motif, or frame</span>
              </button>
            </div>
            {decorationType === "banner" && (
              <div className="rounded-xl p-4 mb-4 space-y-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
                <p className="text-sm font-medium text-charcoal">Choose banner placement</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {INSIDE_POSITIONS.map((pos) => (
                    <button key={pos.id} onClick={() => setInsideImagePosition(pos.id)} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${insideImagePosition === pos.id ? "border-brand bg-brand-light shadow-md" : "border-light-gray bg-white hover:border-sage hover:shadow-sm"}`}>
                      <div className="w-14 border border-light-gray rounded bg-white relative mb-1.5 flex items-center justify-center overflow-hidden" style={{ height: 72 }}>
                        {pos.id === "top" && <div className="absolute top-0 left-0 right-0 h-3.5 bg-sage-light rounded-t" />}
                        {pos.id === "middle" && <div className="absolute left-0 right-0 h-3.5 bg-sage-light" style={{ top: "40%" }} />}
                        {pos.id === "bottom" && <div className="absolute bottom-0 left-0 right-0 h-3.5 bg-sage-light rounded-b" />}
                        {pos.id === "left" && <div className="absolute top-0 bottom-0 left-0 w-3.5 bg-sage-light rounded-l" />}
                        {pos.id === "right" && <div className="absolute top-0 bottom-0 right-0 w-3.5 bg-sage-light rounded-r" />}
                        {pos.id === "behind" && <div className="absolute inset-2 bg-brand-light rounded opacity-40" />}
                      </div>
                      <span className="text-xs font-semibold text-charcoal">{pos.label}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal mb-1 block">Focus suggestion <span className="text-warm-gray font-normal">(optional)</span></label>
                  <input value={insideDesignGuidance} onChange={(e) => setInsideDesignGuidance(e.target.value)} placeholder="e.g. Focus on the floral elements..." className="input-field w-full" />
                </div>
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
                          frontTitle: selectedDesign.title, frontDescription: selectedDesign.description, frontImagePrompt: selectedDesign.image_prompt,
                          occasion: effectiveOccasion, tone, position: insideImagePosition, orientation,
                          artStyle: ART_STYLES.find((s) => s.id === artStyle)?.label, userGuidance: insideDesignGuidance.trim() || undefined,
                        }),
                      });
                      if (!res.ok) throw new Error("Failed to load");
                      const data = await res.json();
                      setInsideConcepts(data.designs ?? []);
                      setIsLoading(false);
                      setStep("inside_design_pick");
                      logApiCall("suggest-inside-designs", { model: "gpt-4o", callType: "chat_completion", sessionId: sessionIdRef });
                      setSessionCost((c) => c + 0.025);
                    } catch {
                      setIsLoading(false);
                      loadFrontTextSuggestions();
                    }
                  }}
                  disabled={!insideImagePosition}
                  className="btn-primary disabled:opacity-40 w-full"
                >Suggest illustrations</button>
              </div>
            )}
            {decorationType === "accent" && (
              <div className="rounded-xl p-4 mb-4 space-y-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
                <p className="text-sm font-medium text-charcoal">Choose accent style</p>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => { setAccentStyle("corner_flourish"); setAccentPositions([3]); }} className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${accentStyle === "corner_flourish" ? "border-brand bg-brand-light shadow-md" : "border-light-gray bg-white hover:border-sage hover:shadow-sm"}`}>
                    <div className="w-14 border border-light-gray rounded bg-white relative mb-1.5 overflow-hidden flex items-center justify-center" style={{ height: 72 }}>
                      <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl" style={{ borderColor: "var(--color-brand)" }} />
                      <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br" style={{ borderColor: "var(--color-brand)" }} />
                    </div>
                    <span className="text-xs font-semibold text-charcoal">Corner</span>
                  </button>
                  <button onClick={() => { setAccentStyle("top_edge_accent"); setAccentPositions([1]); }} className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${accentStyle === "top_edge_accent" ? "border-brand bg-brand-light shadow-md" : "border-light-gray bg-white hover:border-sage hover:shadow-sm"}`}>
                    <div className="w-14 border border-light-gray rounded bg-white relative mb-1.5 overflow-hidden flex items-center justify-center" style={{ height: 72 }}>
                      <div className="absolute top-0 left-0 right-0 h-3" style={{ borderBottom: "2px solid var(--color-brand)" }} />
                    </div>
                    <span className="text-xs font-semibold text-charcoal">Edge motif</span>
                  </button>
                  <button onClick={() => { setAccentStyle("frame"); setAccentPositions([]); }} className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${accentStyle === "frame" ? "border-brand bg-brand-light shadow-md" : "border-light-gray bg-white hover:border-sage hover:shadow-sm"}`}>
                    <div className="w-14 rounded bg-white relative mb-1.5 overflow-hidden flex items-center justify-center" style={{ height: 72, border: "2px solid var(--color-brand)" }}>
                      <div className="absolute inset-1.5 rounded" style={{ border: "1px solid var(--color-sage)" }} />
                    </div>
                    <span className="text-xs font-semibold text-charcoal">Frame</span>
                  </button>
                </div>
                {accentStyle === "corner_flourish" && (
                  <div>
                    <p className="text-xs text-warm-gray mb-2">Select which corners to decorate:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[{ slot: 1, label: "Top left" }, { slot: 2, label: "Top right" }, { slot: 4, label: "Bottom left" }, { slot: 3, label: "Bottom right" }].map(({ slot, label }) => {
                        const active = accentPositions.includes(slot);
                        return (<button key={slot} onClick={() => setAccentPositions((prev) => active ? prev.filter((s) => s !== slot) : [...prev, slot])} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${active ? "border-brand bg-brand-light text-charcoal" : "border-light-gray bg-white text-warm-gray hover:border-sage"}`}>{label}</button>);
                      })}
                    </div>
                  </div>
                )}
                {accentStyle === "top_edge_accent" && (
                  <div>
                    <p className="text-xs text-warm-gray mb-2">Select edge positions:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ slot: 1, label: "Top edge" }, { slot: 2, label: "Bottom edge" }].map(({ slot, label }) => {
                        const active = accentPositions.includes(slot);
                        return (<button key={slot} onClick={() => setAccentPositions((prev) => active ? prev.filter((s) => s !== slot) : [...prev, slot])} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${active ? "border-brand bg-brand-light text-charcoal" : "border-light-gray bg-white text-warm-gray hover:border-sage"}`}>{label}</button>);
                      })}
                    </div>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!accentStyle) return;
                    setInsideImagePosition(accentStyle);
                    const prompt = buildAccentPrompt(accentStyle);
                    setInsideSceneDescription(prompt);
                    generateDesignImage(prompt, { isInside: true, isAccent: true });
                  }}
                  disabled={!accentStyle || (accentStyle !== "frame" && accentPositions.length === 0)}
                  className="btn-primary disabled:opacity-40 w-full"
                >Generate accent</button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("design_preview")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <button onClick={() => loadFrontTextSuggestions()} className="btn-secondary ml-auto">Skip — no decoration</button>
            </div>
          </div>
        )}

        {step === "inside_design_pick" && insideConcepts.length > 0 && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Choose an inside decoration</h2>
            <p className="text-sm text-warm-gray mb-2">Each option uses elements from your front cover. You can request changes after.</p>
            <p className="text-xs text-warm-gray mb-4">Position: <strong>{INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label || (insideImagePosition === "corner_flourish" ? "Corner flourish" : insideImagePosition === "top_edge_accent" ? "Top edge motif" : insideImagePosition === "frame" ? "Full frame" : insideImagePosition)}</strong></p>
            <div className="space-y-4">
              {insideConcepts.map((concept, i) => {
                const cropPositions = ["top left", "center", "bottom right", "top right", "bottom left"];
                const cropPos = cropPositions[i % cropPositions.length];
                const isHorizontal = ["top", "middle", "bottom"].includes(insideImagePosition);
                const isVertical = ["left", "right"].includes(insideImagePosition);
                const stripWidth = isHorizontal ? 260 : isVertical ? 56 : 160;
                const stripHeight = isHorizontal ? 52 : isVertical ? 180 : 120;
                return (
                  <button key={i} onClick={() => { setSelectedInsideConcept(concept); setInsideSceneDescription(concept.image_prompt); generateDesignImage(concept.image_prompt, { isInside: true }); }} className="w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-sm" style={{ borderColor: "var(--color-sage-light)", background: "var(--color-white)" }}>
                    <div className="flex gap-4 items-start">
                      {generatedImageUrl && (
                        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                          <div className="rounded-lg overflow-hidden border border-light-gray shadow-sm" style={{ width: stripWidth, height: stripHeight }}>
                            {insideImagePosition === "behind" ? (
                              <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: cropPos, opacity: 0.15 }} />
                            ) : (
                              <img src={generatedImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: cropPos }} />
                            )}
                          </div>
                          <span className="text-[10px] text-warm-gray">{INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label || insideImagePosition} preview</span>
                        </div>
                      )}
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
              <button onClick={() => setStep("inside_design_ask")} className="text-sm px-4 py-2 rounded-full text-warm-gray hover:text-charcoal" style={{ border: "1.5px solid var(--color-sage)" }}>&larr; Change position</button>
              <button onClick={() => loadFrontTextSuggestions()} className="text-sm px-4 py-2 rounded-full text-warm-gray hover:text-charcoal ml-auto" style={{ border: "1.5px solid var(--color-sage)" }}>Skip inside illustration</button>
            </div>
          </div>
        )}

        {step === "inside_confirm_refinement" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Generate from updated description</h2>
            <p className="text-sm text-warm-gray mb-4">Your addition is merged into the scene below. We&apos;ll generate a new illustration from this full description. You can revert if you prefer the previous version.</p>
            {pendingChangeType === "refine" && pendingEditInstruction && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
                <label className="text-xs text-brand uppercase tracking-wide mb-2 block font-medium">What will change</label>
                <textarea value={pendingEditInstruction} onChange={(e) => setPendingEditInstruction(e.target.value)} rows={2} className="input-field resize-y" style={{ borderColor: "var(--color-brand)" }} />
              </div>
            )}
            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <label className="text-xs text-warm-gray uppercase tracking-wide mb-2 block">Full scene description</label>
              <textarea value={pendingInsideScene} onChange={(e) => setPendingInsideScene(e.target.value)} rows={4} className="input-field resize-y" />
            </div>
            {error && <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setPendingInsideScene(""); setStep("inside_design_preview"); }} className="text-sm text-warm-gray hover:text-charcoal px-4 py-2">&larr; Cancel</button>
              <button
                onClick={() => { setPreviousInsideImageUrl(insideImageUrl); setInsideSceneDescription(pendingInsideScene); generateDesignImage(pendingInsideScene, { isInside: true, editExisting: false }); }}
                disabled={!pendingInsideScene.trim()} className="flex-1 btn-primary"
              >Generate new illustration</button>
            </div>
          </div>
        )}

        {step === "inside_design_preview" && insideImageUrl && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">{decorationType === "accent" ? "Decorative accent" : "Inside illustration"}</h2>
            <p className="text-sm text-warm-gray mb-4">Style: <strong>{insideImagePosition === "corner_flourish" ? "Corner flourish" : insideImagePosition === "top_edge_accent" ? "Top edge motif" : insideImagePosition === "frame" ? "Full frame" : INSIDE_POSITIONS.find((p) => p.id === insideImagePosition)?.label}</strong></p>
            <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <p className="text-sm text-warm-gray uppercase tracking-wide mb-3 text-center">Preview — how it will look on the card</p>
              <div className="flex justify-center">
                <div className="bg-white rounded-lg shadow-md overflow-hidden relative" style={{ width: 300, height: cardSize === "4x6" ? 400 : 420, border: "1px solid var(--color-light-gray)" }}>
                  {insideImagePosition === "top" && (<><img src={insideImageUrl} alt="" className="w-full object-cover" style={{ height: "20%" }} /><div className="flex flex-col items-center justify-center px-4" style={{ height: "80%" }}><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div></>)}
                  {insideImagePosition === "bottom" && (<><div className="flex flex-col items-center justify-center px-4" style={{ height: "80%" }}><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div><img src={insideImageUrl} alt="" className="w-full object-cover" style={{ height: "20%" }} /></>)}
                  {insideImagePosition === "middle" && (<><div className="flex flex-col items-center justify-center px-4" style={{ height: "35%" }}><div className="w-3/4 space-y-1.5">{[1,2].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 2 ? "60%" : "100%" }} />)}</div></div><img src={insideImageUrl} alt="" className="w-full object-cover" style={{ height: "18%" }} /><div className="flex flex-col items-center justify-center px-4" style={{ height: "47%" }}><div className="w-3/4 space-y-1.5">{[1,2,3].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 3 ? "40%" : "100%" }} />)}</div></div></>)}
                  {insideImagePosition === "left" && (<div className="flex h-full"><img src={insideImageUrl} alt="" className="h-full object-cover" style={{ width: "22%" }} /><div className="flex-1 flex flex-col items-center justify-center px-4"><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div></div>)}
                  {insideImagePosition === "right" && (<div className="flex h-full"><div className="flex-1 flex flex-col items-center justify-center px-4"><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div><img src={insideImageUrl} alt="" className="h-full object-cover" style={{ width: "22%" }} /></div>)}
                  {insideImagePosition === "behind" && (<div className="relative h-full"><img src={insideImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" /><div className="relative flex flex-col items-center justify-center h-full px-4"><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%", backgroundColor: "var(--color-warm-gray)" }} />)}</div></div></div>)}
                  {insideImagePosition === "corner_flourish" && (<div className="relative h-full">{accentPositions.map((slot) => (<div key={slot} style={cornerStyle(slot)}><img src={insideImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.85 }} /></div>))}<div className="relative flex flex-col items-center justify-center h-full px-4" style={{ padding: accentPositions.length > 2 ? "2.5rem 1.5rem" : "1rem" }}><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div></div>)}
                  {insideImagePosition === "frame" && (<div className="relative h-full"><img src={insideImageUrl} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "fill", opacity: 0.35, pointerEvents: "none" }} /><div className="relative flex flex-col items-center justify-center h-full" style={{ padding: "15% 12%" }}><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div></div>)}
                  {insideImagePosition === "top_edge_accent" && (<div className="flex flex-col h-full">{accentPositions.includes(1) && (<div style={edgeStyle(1)}><img src={insideImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} /></div>)}<div className="flex-1 flex flex-col items-center justify-center px-4"><div className="w-3/4 space-y-1.5">{[1,2,3,4].map(l => <div key={l} className="h-1.5 rounded bg-light-gray" style={{ width: l === 4 ? "50%" : "100%" }} />)}</div></div>{accentPositions.includes(2) && (<div style={edgeStyle(2)}><img src={insideImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} /></div>)}</div>)}
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <p className="text-base text-charcoal mb-2">Want to change something?</p>
              <p className="text-sm text-warm-gray mb-2">Describe what to add or change. The illustration will be re-created with your edit — small tweaks work best.</p>
              <div className="flex gap-2">
                <input value={insideDesignFeedback} onChange={(e) => setInsideDesignFeedback(e.target.value)} placeholder="e.g. Warmer flower colors, add a small butterfly..." className="input-field flex-1" />
                <button onClick={() => requestInsideRefinement(insideDesignFeedback)} disabled={!insideDesignFeedback.trim() || insideMerging} className="btn-secondary text-sm disabled:opacity-50">
                  {insideMerging ? "Merging..." : "Request change"}
                </button>
              </div>
              {previousInsideImageUrl && (
                <button type="button" onClick={() => { setInsideImageUrl(previousInsideImageUrl); setPreviousInsideImageUrl(null); setInsideDesignFeedback(""); }} className="mt-3 text-sm text-warm-gray hover:text-charcoal underline">&larr; Revert to previous image</button>
              )}
            </div>
            {error && <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { if (decorationType === "accent") { setStep("inside_design_ask"); } else { setStep("inside_design_pick"); } }} className="text-sm text-warm-gray hover:text-charcoal px-4 py-2 rounded-full" style={{ border: "1.5px solid var(--color-sage)" }}>&larr; {decorationType === "accent" ? "Change style" : "Pick different"}</button>
              <button onClick={() => loadFrontTextSuggestions()} className="btn-primary">Next: Front text</button>
            </div>
          </div>
        )}

        {step === "front_text" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Front text &amp; font style</h2>
            <p className="text-sm text-warm-gray mb-6">Pick a suggestion, edit your own, or skip. Choose a font for the card.</p>
            {frontTextSuggestions.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Suggestions</label>
                <div className="grid gap-2">
                  {frontTextSuggestions.map((s, idx) => (
                    <button key={idx} onClick={() => { setFrontText(s.wording); setFrontTextPosition(s.position); }}
                      className={`text-left rounded-lg border p-3 transition-colors ${frontText === s.wording ? "border-brand bg-brand-light" : "border-light-gray hover:border-warm-gray"}`}
                    >
                      <span className="text-base font-medium text-charcoal">&ldquo;{s.wording}&rdquo;</span>
                      <span className="block text-xs text-warm-gray mt-0.5">{s.position.replace(/-/g, " ")}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => loadFrontTextSuggestions()} className="mt-2 text-sm text-brand hover:underline">Suggest new options</button>
              </div>
            )}
            <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Wording</label>
              <p className="text-xs text-warm-gray mb-1">Edit or type your own. Use Enter for line breaks.</p>
              <textarea value={frontText} onChange={(e) => setFrontText(e.target.value)} placeholder="e.g. Happy Birthday!" rows={3} className="input-field resize-y" />
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mt-3 mb-2">Position</label>
              <select value={frontTextPosition} onChange={(e) => setFrontTextPosition(e.target.value)} className="input-field">
                <option value="center">Center</option>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-center">Bottom center</option>
                <option value="top-center">Top center</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mt-3 mb-2">Text style</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "plain_black" as const, label: "Plain black" },
                  { value: "plain_white" as const, label: "Plain white" },
                  { value: "black_white_border" as const, label: "Black / white outline" },
                  { value: "white_black_border" as const, label: "White / black outline" },
                ] as const).map((opt) => (
                  <button key={opt.value} onClick={() => setFrontTextStyle(opt.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${frontTextStyle === opt.value ? "border-brand bg-brand-light text-brand" : "border-light-gray text-warm-gray hover:border-light-gray"}`}
                  >{opt.label}</button>
                ))}
              </div>
              {frontText.trim() && (
                <div className="mt-3 rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-sage) 100%)", padding: "1.5rem", position: "relative" }}>
                  <div style={{ ...fontCSS(font as FontChoice), fontSize: "1.1rem", display: "inline-block", ...textStyleCSS(frontTextStyle), whiteSpace: "pre-line" }}>{frontText}</div>
                </div>
              )}
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-3">Front cover font</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_FONT_OPTIONS.map((opt) => (
                  <button key={opt.id} onClick={() => setFont(opt.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${font === opt.id ? "border-brand bg-brand-light" : "border-light-gray hover:border-light-gray"}`}
                  >
                    <span className="text-[0.65rem] font-medium text-warm-gray uppercase">{opt.label}</span>
                    <p className="text-base text-charcoal mt-1" style={fontCSS(opt.id)}>{frontText || "Happy Birthday!"}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-3">Inside message font</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_FONT_OPTIONS.map((opt) => (
                  <button key={opt.id} onClick={() => setInsideFont(opt.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${insideFont === opt.id ? "border-brand bg-brand-light" : "border-light-gray hover:border-light-gray"}`}
                  >
                    <span className="text-[0.65rem] font-medium text-warm-gray uppercase">{opt.label}</span>
                    <p className="text-sm text-charcoal mt-1 leading-snug" style={fontCSS(opt.id)}>Wishing you all the best</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setFrontText(""); setStep("letter"); }} className="text-sm text-warm-gray hover:text-charcoal px-4 py-2 rounded-full" style={{ border: "1.5px solid var(--color-sage)" }}>Skip</button>
              <button onClick={() => setStep("letter")} className="btn-primary">Next</button>
            </div>
          </div>
        )}

        {step === "letter" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Include a personal letter?</h2>
            <p className="text-sm text-warm-gray mb-6">A handwritten-style note tucked inside the card — more personal than the printed message. You can also add or edit this later.</p>
            {letterText.trim() ? (
              <div className="rounded-xl p-5 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Your letter</label>
                    <p className="text-xs text-warm-gray mb-1">Use blank lines to separate greeting, body, and closing — just like writing a real letter.</p>
                    <textarea
                      value={letterText}
                      onChange={(e) => setLetterText(e.target.value)}
                      rows={8}
                      placeholder={`Dear friend,\n\nI wanted to write you a personal note...\n\nWith love,\n${(profile?.first_name as string) || (profile?.display_name as string) || "Me"}`}
                      style={fontCSS(letterFont as FontChoice)}
                      className="w-full input-field rounded-lg px-3 py-2 text-sm resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Font</label>
                    <select value={letterFont} onChange={(e) => setLetterFont(e.target.value)} className="input-field rounded-lg px-2 py-1.5 text-sm" style={{ maxWidth: 200 }}>
                      {CARD_FONT_OPTIONS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-5 mb-4" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
                <textarea
                  value={letterText}
                  onChange={(e) => setLetterText(e.target.value)}
                  rows={8}
                  placeholder={`Dear friend,\n\nI wanted to write you a personal note...\n\nWith love,\n${(profile?.first_name as string) || (profile?.display_name as string) || "Me"}`}
                  style={fontCSS(letterFont as FontChoice)}
                  className="w-full input-field rounded-lg px-3 py-2 text-sm resize-y"
                />
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
                onClick={() => { setLetterText(""); setStep("delivery"); }}
                className="text-sm text-warm-gray hover:text-charcoal px-4 py-2 rounded-full"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                Skip
              </button>
              <button onClick={() => setStep("delivery")} className="btn-primary ml-auto">
                {letterText.trim() ? "Next: Choose delivery" : "Next"}
              </button>
            </div>
          </div>
        )}

        {step === "delivery" && !showResumePrompt && (
          <div>
            <h2 className="text-xl font-bold text-charcoal mb-2">How should this card be delivered?</h2>
            <p className="text-sm text-warm-gray mb-6">{categoryLabel} — Share a moment</p>

            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}>
              <p className="text-base font-medium text-charcoal mb-2">Envelope</p>
              <p className="text-xs text-warm-gray mb-3">Since this card doesn&apos;t have a specific recipient, add a label for the envelope front.</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-charcoal shrink-0" style={{ minWidth: 80 }}>Label</span>
                  <input
                    type="text"
                    value={envelopeLabel}
                    onChange={(e) => setEnvelopeLabel(e.target.value)}
                    placeholder="e.g. Friends, In Memory, Save the Date"
                    className="flex-1 input-field rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <p className="text-xs text-warm-gray -mt-1">Signed from</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-charcoal shrink-0" style={{ minWidth: 80 }}>You</span>
                  <input
                    type="text"
                    value={signerDisplayOverrides[USER_KEY] ?? getDefaultUserDisplayName(profile)}
                    onChange={(e) => setSignerDisplayOverrides((prev) => ({ ...prev, [USER_KEY]: e.target.value }))}
                    placeholder={getDefaultUserDisplayName(profile) || "Your name"}
                    className="flex-1 input-field rounded-lg px-3 py-1.5 text-sm max-w-[180px]"
                  />
                </div>
                {allRecipients.length > 0 && (
                  <>
                    <p className="text-xs text-warm-gray">Co-sign with people from your circle:</p>
                    {allRecipients.map((r) => {
                      const checked = signerRecipientIds.includes(r.id);
                      const totalSigners = signerRecipientIds.length + customSignerNames.length;
                      const atLimit = !checked && totalSigners >= MAX_SIGNERS - 1;
                      const defaultName = getDefaultDisplayName(r);
                      return (
                        <div key={r.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={atLimit}
                            onChange={() => {
                              setSignerRecipientIds((prev) => checked ? prev.filter((id) => id !== r.id) : [...prev, r.id]);
                              if (checked) setUseGroupSignature(false);
                            }}
                            className="rounded shrink-0"
                            style={{ accentColor: "var(--color-brand)" }}
                          />
                          <span className="text-sm text-charcoal shrink-0" style={{ minWidth: 80 }}>{defaultName}</span>
                          <input
                            type="text"
                            value={checked ? (signerDisplayOverrides[r.id] ?? defaultName) : ""}
                            onChange={(e) => setSignerDisplayOverrides((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder={defaultName}
                            disabled={!checked}
                            className="flex-1 input-field rounded-lg px-3 py-1.5 text-sm max-w-[180px] disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      );
                    })}
                  </>
                )}
                {customSignerNames.map((name, idx) => (
                  <div key={`custom-${idx}`} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSignerNames((prev) => prev.filter((_, i) => i !== idx));
                        setSignerDisplayOverrides((prev) => { const next = { ...prev }; delete next[`__custom_${idx}__`]; return next; });
                      }}
                      className="text-warm-gray hover:text-charcoal text-sm shrink-0"
                      title="Remove"
                    >&times;</button>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const updated = [...customSignerNames];
                        updated[idx] = e.target.value;
                        setCustomSignerNames(updated);
                        setSignerDisplayOverrides((prev) => ({ ...prev, [`__custom_${idx}__`]: e.target.value }));
                      }}
                      placeholder="Name"
                      className="flex-1 input-field rounded-lg px-3 py-1.5 text-sm max-w-[180px]"
                    />
                  </div>
                ))}
                {(signerRecipientIds.length + customSignerNames.length) < MAX_SIGNERS - 1 && (
                  <button
                    type="button"
                    onClick={() => setCustomSignerNames((prev) => [...prev, ""])}
                    className="text-sm font-medium"
                    style={{ color: "var(--color-brand)" }}
                  >
                    + Add a name
                  </button>
                )}
                {(signerRecipientIds.length + customSignerNames.filter((n) => n.trim()).length) >= 2 && (
                  <div className="pt-2 border-t border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer mb-1">
                      <input
                        type="checkbox"
                        checked={useGroupSignature}
                        onChange={(e) => { setUseGroupSignature(e.target.checked); if (!e.target.checked) setSignerGroupName(""); }}
                        className="rounded"
                        style={{ accentColor: "var(--color-brand)" }}
                      />
                      <span className="text-sm text-charcoal">Use group name (e.g. The Johnson&apos;s)</span>
                    </label>
                    {useGroupSignature && (
                      <input
                        type="text"
                        value={signerGroupName}
                        onChange={(e) => setSignerGroupName(e.target.value)}
                        placeholder="The Johnson's"
                        className="mt-1 input-field rounded-lg px-3 py-1.5 text-sm w-full max-w-[200px]"
                      />
                    )}
                  </div>
                )}
                {(signerRecipientIds.length > 0 || customSignerNames.some((n) => n.trim())) && !useGroupSignature && (
                  <p className="text-xs text-warm-gray mt-2">
                    The message will use &ldquo;we&rdquo; and &ldquo;our&rdquo; and sign from all of you.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleSave({ deliveryMethodOverride: "digital" })}
                className="w-full rounded-xl p-5 text-left transition-all hover:shadow-sm"
                style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
              >
                <span className="text-sm font-semibold text-charcoal">Send digitally</span>
                <p className="text-sm text-warm-gray mt-1">Delivered via a link with an animated envelope opening experience</p>
              </button>
              <button
                onClick={() => handleSave({ deliveryMethodOverride: "print_at_home" })}
                className="w-full rounded-xl p-5 text-left transition-all hover:shadow-sm"
                style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
              >
                <span className="text-sm font-semibold text-charcoal">Print at home</span>
                <p className="text-sm text-warm-gray mt-1">Download a print-ready PDF to fold and give in person</p>
              </button>
              <button
                onClick={() => handleSave({ deliveryMethodOverride: "mail" })}
                className="w-full rounded-xl p-5 text-left transition-all hover:shadow-sm"
                style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
              >
                <span className="text-sm font-semibold text-charcoal">Mail it</span>
                <p className="text-sm text-warm-gray mt-1">Nuuge prints and mails a physical card (requires recipient address)</p>
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

        {step === "saved" && !showResumePrompt && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-2xl font-bold text-charcoal mb-3">Card saved!</h2>
            <p className="text-warm-gray mb-8">
              Your {categoryLabel.toLowerCase()} card is ready
              {deliveryMethod === "digital" && " to send"}
              {deliveryMethod === "print_at_home" && " to print"}
              {deliveryMethod === "mail" && " — mailing coming soon"}.
            </p>

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
                <p className="text-sm text-amber-800 font-medium mb-1">Physical mailing is coming soon</p>
                <p className="text-sm text-amber-700">In the meantime, you can print this card at home and mail it yourself.</p>
                {savedCardId && (
                  <button onClick={() => router.push(`/cards/print/${savedCardId}`)} className="btn-link text-sm mt-3">
                    Print at home instead &rarr;
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => {
                  clearShareDraft();
                  handleStartFreshShare();
                }}
                className="btn-secondary"
              >
                Create another card
              </button>
              <button onClick={() => router.push("/")} className="btn-secondary">
                Back to Home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

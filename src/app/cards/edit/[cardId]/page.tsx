"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCardById, updateCard, saveCard, getRecipients, getUserProfile, hydrateCardImages } from "@/lib/store";
import AppHeader from "@/components/AppHeader";
import type { Card, Recipient } from "@/types/database";
import { ALL_OCCASIONS, OTHER_OCCASION_VALUE, OTHER_OCCASION_LABEL, getDisplayOccasion } from "@/lib/occasions";
import { fontCSS, positionCSS, textStyleCSS, frontTextAlign, messageSizing, msgSizeOptions, FONT_OPTIONS, isAccentPosition, defaultAccentSlots, cornerStyle, cornerImgStyle, edgeStyle, edgeImgStyle, frameImgStyle } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";
import { STYLE_RECIPES } from "@/lib/card-recipes";
import { formatSignerNames, getSignerNameList } from "@/lib/signer-helpers";

const FRONT_TEXT_STYLES: { id: TextStyleChoice; label: string }[] = [
  { id: "plain_black", label: "Plain black" },
  { id: "plain_white", label: "Plain white" },
  { id: "black_white_border", label: "Black / white outline" },
  { id: "white_black_border", label: "White / black outline" },
];

const FRONT_TEXT_POSITIONS = [
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "center", label: "Center" },
  { id: "top-center", label: "Top center" },
  { id: "top-left", label: "Top left" },
];

const ALL_DECORATION_OPTIONS = [
  { id: "none", label: "None (remove)", group: "remove", orientation: "horizontal" as const },
  { id: "top", label: "Top banner", group: "banner", orientation: "horizontal" },
  { id: "middle", label: "Middle band", group: "banner", orientation: "horizontal" },
  { id: "bottom", label: "Bottom banner", group: "banner", orientation: "horizontal" },
  { id: "left", label: "Left edge", group: "banner", orientation: "vertical" },
  { id: "right", label: "Right edge", group: "banner", orientation: "vertical" },
  { id: "behind", label: "Watermark (behind text)", group: "banner", orientation: "square" },
  { id: "corner_flourish", label: "Corner flourish", group: "accent", orientation: "square" },
  { id: "top_edge_accent", label: "Edge motif", group: "accent", orientation: "horizontal" },
  { id: "frame", label: "Full frame", group: "accent", orientation: "vertical" },
] as const;

type DecorationOrientation = "horizontal" | "vertical" | "square";

function getDecorationOrientation(posId: string): DecorationOrientation {
  return ALL_DECORATION_OPTIONS.find((o) => o.id === posId)?.orientation ?? "horizontal";
}

function getDecorationGroup(posId: string): string {
  return ALL_DECORATION_OPTIONS.find((o) => o.id === posId)?.group ?? "banner";
}

function needsRegeneration(oldPos: string, newPos: string): boolean {
  if (oldPos === newPos) return false;
  if (newPos === "none") return false;
  if (oldPos === "none") return true;
  const oldGroup = getDecorationGroup(oldPos);
  const newGroup = getDecorationGroup(newPos);
  if (oldGroup !== newGroup) return true;
  if (oldGroup === "accent") return true;
  const oldOrientation = getDecorationOrientation(oldPos);
  const newOrientation = getDecorationOrientation(newPos);
  return oldOrientation !== newOrientation;
}

function imageSizeForPosition(pos: string): "1536x1024" | "1024x1536" | "1024x1024" {
  const o = getDecorationOrientation(pos);
  if (o === "horizontal") return "1536x1024";
  if (o === "vertical") return "1024x1536";
  return "1024x1024";
}

function buildAccentPrompt(accent: string, styleLabel: string): string {
  const base = `${styleLabel}-style decorative element for a greeting card interior. Delicate, subtle, refined ornamental design. PURE WHITE (#FFFFFF) background — absolutely no cream, ivory, beige, or off-white tones. The background must be perfectly white. No text, no words, no letters.`;
  switch (accent) {
    case "corner_flourish":
      return `Create a single corner flourish ornament in ${base} The design should be a decorative scroll or floral motif for one corner only, occupying roughly the bottom-right quarter of the image. The rest of the image must be pure white/empty. The flourish should be elegant and minimal — thin delicate lines.`;
    case "top_edge_accent":
      return `Create a horizontal decorative ornamental strip in ${base} A wide, short decorative motif or garland suitable for the top edge of a card. Centered composition, symmetrical, with ornamental scrollwork or subtle botanical flourishes. The strip should span the full width but be short in height.`;
    case "frame":
      return `Create a subtle ornamental border frame in ${base} A delicate decorative frame around the edges of the image with a completely white/empty center (at least 70% of the area must be empty white space). Light decorative flourish corners, thin ornamental lines along the edges. The frame should be refined and minimal — not heavy or ornate.`;
    default:
      return "";
  }
}

function buildBannerPrompt(pos: string, styleLabel: string, frontImageBase64?: string | null): string | null {
  if (frontImageBase64) return null;
  const orientationWord = getDecorationOrientation(pos) === "vertical" ? "vertical" : "horizontal";
  return `Create a ${orientationWord} decorative illustration in ${styleLabel} style suitable for a greeting card interior. Soft, complementary colors. No text, no words, no letters.`;
}

const TONES = [
  "Heartfelt and sincere", "Supportive and comforting",
  "Romantic and affectionate", "Joyful and celebratory",
  "Warm with a touch of humor", "Funny and playful",
  "Sarcastic and edgy", "Simple and understated",
];

const ART_STYLES = [
  { id: "watercolor", label: "Watercolor" },
  { id: "whimsical", label: "Cute / Whimsical" },
  { id: "minimalist", label: "Minimalist" },
  { id: "vintage", label: "Vintage" },
  { id: "painterly", label: "Painterly" },
  { id: "abstract_style", label: "Abstract" },
];

const IMAGE_SUBJECTS = [
  { id: "flowers", label: "Flowers / Botanicals" },
  { id: "animals", label: "Animals" },
  { id: "nature", label: "Nature / Landscape" },
  { id: "people", label: "People / Relationships" },
  { id: "characters", label: "Characters / Cute Illustrations" },
  { id: "objects", label: "Objects / Symbols" },
  { id: "holiday", label: "Holiday / Seasonal" },
  { id: "abstract", label: "Abstract / Patterns" },
];

export default function EditCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAsNew, setSavedAsNew] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Editable fields
  const [greeting, setGreeting] = useState("");
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState("");
  const [frontText, setFrontText] = useState("");
  const [frontTextPosition, setFrontTextPosition] = useState("bottom-right");
  const [frontTextStyle, setFrontTextStyle] = useState<TextStyleChoice>("plain_black");
  const [frontTextFont, setFrontTextFont] = useState<string>("sans");
  const [insideFont, setInsideFont] = useState<string>("sans");
  const [toneUsed, setToneUsed] = useState("");
  const [occasion, setOccasion] = useState("");
  const [insideImagePosition, setInsideImagePosition] = useState("top");
  const [accentPositions, setAccentPositions] = useState<number[]>([3]);
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");
  const [letterText, setLetterText] = useState("");
  const [letterFont, setLetterFont] = useState<string>("handwritten");
  const [msgSizeScale, setMsgSizeScale] = useState<number>(0);
  const [ftSizeScale, setFtSizeScale] = useState<number>(1);
  const [letterSizeScale, setLetterSizeScale] = useState<number>(1);
  const [artStyle, setArtStyle] = useState("");
  const [imageSubject, setImageSubject] = useState("");
  const [signerRecipientIds, setSignerRecipientIds] = useState<string[]>([]);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  // Cache the original inside image so switching back is free
  const [originalInsideImageUrl, setOriginalInsideImageUrl] = useState<string | null>(null);
  const [originalInsidePosition, setOriginalInsidePosition] = useState<string>("none");
  const [originalAccentPositions, setOriginalAccentPositions] = useState<number[]>([]);

  // Track original content-affecting values for change detection
  const [originalTone, setOriginalTone] = useState("");
  const [originalOccasion, setOriginalOccasion] = useState("");
  const [originalArtStyle, setOriginalArtStyle] = useState("");
  const [originalSubject, setOriginalSubject] = useState("");

  useEffect(() => {
    setMounted(true);
    const c = getCardById(cardId);
    if (c) {
      hydrateCardImages(c).then((hydrated) => {
        setCard(hydrated);
        const parts = hydrated.message_text.split("\n\n");
        setGreeting(parts[0] || "");
        setBody(parts.slice(1, -1).join("\n\n") || parts[1] || "");
        setClosing(parts[parts.length - 1] || "");
        setFrontText(hydrated.front_text ?? "");
        setFrontTextPosition(hydrated.front_text_position ?? "bottom-right");
        setFrontTextStyle((hydrated.front_text_style as TextStyleChoice) ?? "plain_black");
        setFrontTextFont(hydrated.front_text_font ?? "sans");
        setInsideFont(hydrated.font ?? "sans");
        const t = hydrated.tone_used ?? "";
        const o = getDisplayOccasion(hydrated);
        const s = hydrated.art_style ?? "";
        const sub = hydrated.image_subject ?? "";
        setToneUsed(t);
        setOccasion(o);
        setArtStyle(s);
        setImageSubject(sub);
        setOriginalTone(t);
        setOriginalOccasion(o);
        setOriginalArtStyle(s);
        setOriginalSubject(sub);
        const loadedPos = hydrated.inside_image_url ? (hydrated.inside_image_position ?? "top") : "none";
        setInsideImagePosition(loadedPos);
        setOriginalInsidePosition(loadedPos);
        setOriginalInsideImageUrl(hydrated.inside_image_url ?? null);
        const pos = hydrated.inside_image_position;
        if (isAccentPosition(pos)) {
          const ap = (hydrated as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots(pos);
          setAccentPositions(ap);
          setOriginalAccentPositions(ap);
        }
        setCardSize(hydrated.card_size ?? "5x7");
        setLetterText(hydrated.letter_text ?? "");
        setLetterFont(hydrated.letter_font ?? "handwritten");
        if (hydrated.msg_font_scale != null) setMsgSizeScale(hydrated.msg_font_scale);
        if (hydrated.ft_font_scale != null) setFtSizeScale(hydrated.ft_font_scale);
        if (hydrated.letter_font_scale != null) setLetterSizeScale(hydrated.letter_font_scale);
        const signerIds = (hydrated as { signer_recipient_ids?: string[] }).signer_recipient_ids;
        if (signerIds?.length) {
          setSignerRecipientIds(signerIds);
        } else if (hydrated.co_signed_with?.trim()) {
          const recipients = getRecipients();
          const r = recipients.find((rec) => rec.id === c.recipient_id);
          const coName = hydrated.co_signed_with.trim().toLowerCase();
          const match = r?.links?.find((link) => {
            const linked = recipients.find((rec) => rec.id === link.recipient_id);
            const fn = (linked?.first_name || linked?.display_name || linked?.name || "").toLowerCase();
            return fn && (fn === coName || fn.startsWith(coName) || coName.startsWith(fn));
          });
          if (match) setSignerRecipientIds([match.recipient_id]);
        }
        loadedRef.current = true;
      });
      const recipients = getRecipients();
      setAllRecipients(recipients);
      const r = recipients.find((rec) => rec.id === c.recipient_id);
      if (r) setRecipient(r);
    }
  }, [cardId]);

  useEffect(() => {
    if (!card || !loadedRef.current) return;
    updateCard(cardId, {
      message_text: [greeting, body, closing].filter(Boolean).join("\n\n"),
      front_text: frontText.trim() || null,
      front_text_position: frontText.trim() ? frontTextPosition : null,
      front_text_style: frontTextStyle,
      front_text_font: frontTextFont,
      font: insideFont,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      card_size: cardSize,
      letter_text: letterText.trim() || null,
      letter_font: letterText.trim() ? letterFont : null,
      letter_font_scale: letterSizeScale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting, body, closing, frontText, frontTextPosition, frontTextStyle, frontTextFont, insideFont, msgSizeScale, ftSizeScale, cardSize, letterText, letterFont, letterSizeScale]);

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray mb-4">Card not found.</p>
        <button onClick={() => router.push("/")} className="font-medium" style={{ color: "var(--color-brand)" }}>
          Back to Circle of People
        </button>
      </div>
    );
  }

  const messageText = [greeting, body, closing].filter(Boolean).join("\n\n");
  const toneChanged = toneUsed !== originalTone;
  const occasionChanged = occasion !== originalOccasion;
  const styleChanged = artStyle !== originalArtStyle;
  const subjectChanged = imageSubject !== originalSubject;
  const messageAffected = toneChanged || occasionChanged;
  const imageAffected = styleChanged || subjectChanged || toneChanged;
  const contentChanged = messageAffected || imageAffected;

  const ftPos = positionCSS(frontTextPosition);
  const ftFont = fontCSS(frontTextFont);
  const ftStyle = textStyleCSS(frontTextStyle);
  const msgFont = fontCSS(insideFont);
  const sizeOpts = msgSizeOptions(messageText.length);
  const autoValue = sizeOpts.find((o) => o.label === "Auto")!.value;
  const effectiveMsgScale = msgSizeScale === 0 ? autoValue : msgSizeScale;
  const baseSizing = messageSizing(messageText.length);
  const remToCqw = (rem: string, scale: number) => `${(parseFloat(rem) * scale * 3.81).toFixed(2)}cqw`;
  const sizingCqw = {
    greetingSize: remToCqw(baseSizing.greetingSize, effectiveMsgScale),
    bodySize: remToCqw(baseSizing.bodySize, effectiveMsgScale),
    closingSize: remToCqw(baseSizing.closingSize, effectiveMsgScale),
    gap: remToCqw(baseSizing.gap, effectiveMsgScale),
  };
  const ftSizeCqw = remToCqw("1.5rem", ftSizeScale);

  function getUpdates(): Partial<Card> {
    return {
      message_text: messageText,
      front_text: frontText.trim() || null,
      front_text_position: frontText.trim() ? frontTextPosition : null,
      front_text_style: frontTextStyle,
      front_text_font: frontTextFont,
      font: insideFont,
      tone_used: toneUsed || null,
      occasion: (() => {
        const trimmed = (occasion || getDisplayOccasion(card!)).trim();
        const matched = ALL_OCCASIONS.find((x) => x.toLowerCase() === trimmed.toLowerCase());
        if (matched) return matched === OTHER_OCCASION_LABEL ? OTHER_OCCASION_VALUE : matched;
        return trimmed ? OTHER_OCCASION_VALUE : card!.occasion;
      })(),
      occasion_custom: (() => {
        const trimmed = (occasion || getDisplayOccasion(card!)).trim();
        const matched = ALL_OCCASIONS.find((x) => x.toLowerCase() === trimmed.toLowerCase());
        if (matched) return null;
        return trimmed || null;
      })(),
      art_style: artStyle || null,
      image_subject: imageSubject || null,
      inside_image_position: (insideImagePosition === "none" ? undefined : (card!.inside_image_url ? insideImagePosition : card!.inside_image_position)) as Card["inside_image_position"],
      ...(insideImagePosition === "none" ? { inside_image_url: null } : {}),
      accent_positions: isAccentPosition(insideImagePosition) ? accentPositions : undefined,
      card_size: cardSize,
      letter_text: letterText.trim() || null,
      letter_font: letterText.trim() ? letterFont : null,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      letter_font_scale: letterSizeScale,
      signer_recipient_ids: signerRecipientIds.length ? signerRecipientIds : undefined,
      ...(signerRecipientIds.length ? { co_signed_with: null } : {}),
    };
  }

  function handleSave() {
    updateCard(cardId, getUpdates());
    setOriginalTone(toneUsed);
    setOriginalOccasion(occasion);
    setOriginalArtStyle(artStyle);
    setOriginalSubject(imageSubject);
    setSaved(true);
    setSavedAsNew(null);
  }

  function handleSaveAsNew() {
    const updates = getUpdates();
    const newCard = saveCard({
      ...card!,
      ...updates,
      id: undefined as unknown as string,
      created_at: undefined as unknown as string,
    });
    if (newCard && typeof newCard === "object" && "id" in newCard) {
      setSavedAsNew((newCard as { id: string }).id);
      setSaved(false);
    }
  }

  function navigateToWizard(startStep: string) {
    if (!recipient) return;
    handleSave();
    router.push(`/cards/create/${recipient.id}?editCardId=${cardId}&startStep=${startStep}`);
  }

  function restoreOriginalDecoration() {
    if (!card || !originalInsideImageUrl) return;
    updateCard(cardId, {
      inside_image_url: originalInsideImageUrl,
      inside_image_position: originalInsidePosition as Card["inside_image_position"],
      accent_positions: isAccentPosition(originalInsidePosition) ? originalAccentPositions : undefined,
    });
    const updated = getCardById(cardId);
    if (updated) hydrateCardImages(updated).then(setCard);
    setInsideImagePosition(originalInsidePosition);
    if (isAccentPosition(originalInsidePosition)) setAccentPositions(originalAccentPositions);
    setSaved(true);
  }

  async function regenerateDecoration(newPos: string) {
    if (!card) return;

    // If switching back to original position, restore cached image for free
    if (newPos === originalInsidePosition && originalInsideImageUrl) {
      restoreOriginalDecoration();
      return;
    }

    setRegenerating(true);
    setRegenError(null);
    const styleLabel = STYLE_RECIPES.find((s) => s.id === artStyle)?.label
      ?? ART_STYLES.find((s) => s.id === artStyle)?.label
      ?? "elegant";
    const isAccent = isAccentPosition(newPos);

    const prompt = isAccent
      ? buildAccentPrompt(newPos, styleLabel)
      : buildBannerPrompt(newPos, styleLabel, card.image_url);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: prompt || `Create a decorative illustration in ${styleLabel} style for a greeting card interior. Soft, complementary colors. No text.`,
          userId: "local",
          isInsideIllustration: true,
          insideImageSize: imageSizeForPosition(newPos),
          frontImageBase64: (!isAccent && card.image_url && !card.image_url.startsWith("idb:")) ? card.image_url : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate decoration");
      }
      const data = await res.json();
      updateCard(cardId, {
        inside_image_url: data.imageUrl,
        inside_image_position: newPos as Card["inside_image_position"],
        accent_positions: isAccent ? defaultAccentSlots(newPos as "corner_flourish" | "top_edge_accent" | "frame") : undefined,
      });
      const updated = getCardById(cardId);
      if (updated) {
        const hydrated = await hydrateCardImages(updated);
        setCard(hydrated);
        if (isAccent) setAccentPositions(defaultAccentSlots(newPos as "corner_flourish" | "top_edge_accent" | "frame"));
      }
      setInsideImagePosition(newPos);
      setSaved(true);
    } catch (err: unknown) {
      setRegenError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  }

  const changeLabel = [
    toneChanged ? `Tone → "${toneUsed || "Not specified"}"` : "",
    occasionChanged ? `Occasion → "${occasion}"` : "",
    styleChanged ? `Style → "${ART_STYLES.find((s) => s.id === artStyle)?.label || "Not specified"}"` : "",
    subjectChanged ? `Subject → "${IMAGE_SUBJECTS.find((s) => s.id === imageSubject)?.label || "Not specified"}"` : "",
  ].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader
        title={`${occasion} card${recipient ? ` for ${recipient.name}` : ""}`}
      >
        <button
          onClick={() => { handleSave(); recipient ? router.push(`/recipients/${recipient.id}`) : router.push("/"); }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          {recipient?.name ?? "Circle of People"}
        </button>
      </AppHeader>

      <main className="max-w-2xl mx-auto px-6 py-8">

        {/* ─── Actions (top) ─── */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <button
            onClick={handleSaveAsNew}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
            style={{ border: "1.5px solid var(--color-sage)" }}
          >
            Save as new card
          </button>
          <button
            onClick={() => { handleSave(); window.location.href = `/cards/view/${card.id}`; }}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
            style={{ border: "1.5px solid var(--color-sage)" }}
          >
            View e-card
          </button>
          <button
            onClick={() => { handleSave(); window.location.href = `/cards/print/${card.id}`; }}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
            style={{ border: "1.5px solid var(--color-sage)" }}
          >
            Print preview
          </button>
          <span className="flex-1" />
          <button
            onClick={() => { handleSave(); recipient && router.push(`/cards/create/${recipient.id}`); }}
            className="btn-primary px-5 py-2.5 rounded-full text-sm font-medium"
          >
            Create card
          </button>
        </div>

        {saved && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", color: "var(--color-brand)" }}>
            Changes saved.
          </div>
        )}
        {savedAsNew && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", color: "var(--color-brand)" }}>
            Saved as a new card.{" "}
            <button onClick={() => router.push(`/cards/edit/${savedAsNew}`)} className="underline font-medium" style={{ color: "var(--color-brand)" }}>
              Edit the new card
            </button>{" "}
            or{" "}
            <button onClick={() => { window.location.href = `/cards/view/${savedAsNew}`; }} className="underline font-medium" style={{ color: "var(--color-brand)" }}>
              view it
            </button>.
          </div>
        )}

        {/* ─── Card Preview ─── */}
        <div className="mb-8">
          <p className="section-label mb-3">Preview</p>
          <div className="flex gap-4 justify-center">
            {/* Front panel — container-type for cqw font sizing (matches print/view) */}
            <div
              className="relative card-surface rounded-xl shadow-lg overflow-hidden"
              style={{ width: "45%", maxWidth: 240, aspectRatio: "5 / 7", containerType: "inline-size" }}
            >
              {card.image_url ? (
                <>
                  <img src={card.image_url} alt="Card front" className="w-full h-full object-cover" />
                  {frontText && (
                    <div
                      style={{
                        position: "absolute",
                        ...ftPos,
                        ...ftFont,
                        ...ftStyle,
                        maxWidth: "84%",
                        padding: "0.5rem",
                        boxSizing: "border-box",
                        fontSize: ftSizeCqw,
                        lineHeight: 1.25,
                        textAlign: frontTextAlign(frontTextPosition),
                        whiteSpace: "pre-line",
                      }}
                    >
                      {frontText}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)" }}>
                  <p className="text-3xl" style={{ color: "var(--color-sage)" }}>&#127912;</p>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[0.55rem] text-center py-0.5">
                Front
              </div>
            </div>

            {/* Inside panel — container-type for cqw font sizing (matches print/view) */}
            <div
              className="relative card-surface rounded-xl shadow-lg overflow-hidden flex"
              style={{
                width: "45%",
                maxWidth: 240,
                aspectRatio: "5 / 7",
                containerType: "inline-size",
                ...msgFont,
                flexDirection: (!isAccentPosition(insideImagePosition) && (insideImagePosition === "left" || insideImagePosition === "right")) ? "row" : "column",
                position: "relative",
              }}
            >
              {/* Loading overlay */}
              {regenerating && (
                <div style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                  background: "rgba(255,255,255,0.85)", zIndex: 10,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                }}>
                  <div style={{
                    width: 28, height: 28, border: "3px solid var(--color-sage-light)",
                    borderTop: "3px solid var(--color-brand)", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <p className="text-xs text-warm-gray font-medium">Generating...</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Watermark */}
              {insideImagePosition === "behind" && card.inside_image_url && (
                <img
                  src={card.inside_image_url} alt=""
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.12, pointerEvents: "none" }}
                />
              )}

              {insideImagePosition === "left" && card.inside_image_url && (
                <div style={{ width: "20%", flexShrink: 0, height: "100%" }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              {insideImagePosition === "top" && card.inside_image_url && (
                <div style={{ width: "100%", height: "15%", flexShrink: 0 }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              {/* Top edge accent (slot 1) */}
              {insideImagePosition === "top_edge_accent" && card.inside_image_url && accentPositions.includes(1) && (
                <div style={edgeStyle(1)}>
                  <img src={card.inside_image_url} alt="" style={edgeImgStyle()} />
                </div>
              )}

              <div
                className="flex flex-col justify-center items-center text-center"
                style={{
                  flex: 1,
                  padding: (!isAccentPosition(insideImagePosition) && (insideImagePosition === "left" || insideImagePosition === "right")) ? "6% 4%"
                    : insideImagePosition === "corner_flourish" ? (accentPositions.length > 2 ? "2rem 1.2rem" : "0.75rem")
                    : insideImagePosition === "frame" ? "15% 12%"
                    : "8% 10%",
                  overflow: "hidden",
                  position: "relative",
                  zIndex: 1,
                  gap: sizingCqw.gap,
                }}
              >
                {insideImagePosition === "middle" && card.inside_image_url && (
                  <div style={{ width: "100%", height: "14%", flexShrink: 0 }}>
                    <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.15rem" }} />
                  </div>
                )}

                <p className="text-charcoal" style={{ fontSize: sizingCqw.greetingSize, fontWeight: 600 }}>
                  {greeting}
                </p>
                {body && (
                  <p className="text-charcoal leading-relaxed whitespace-pre-wrap" style={{ fontSize: sizingCqw.bodySize }}>
                    {body}
                  </p>
                )}
                {closing && (
                  <p className="text-warm-gray whitespace-pre-line" style={{ fontSize: sizingCqw.closingSize, fontStyle: "italic" }}>
                    {closing}
                  </p>
                )}
              </div>

              {insideImagePosition === "bottom" && card.inside_image_url && (
                <div style={{ width: "100%", height: "15%", flexShrink: 0 }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              {insideImagePosition === "right" && card.inside_image_url && (
                <div style={{ width: "20%", flexShrink: 0, height: "100%" }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              {/* Bottom edge accent (slot 2) */}
              {insideImagePosition === "top_edge_accent" && card.inside_image_url && accentPositions.includes(2) && (
                <div style={edgeStyle(2)}>
                  <img src={card.inside_image_url} alt="" style={edgeImgStyle()} />
                </div>
              )}

              {/* Corner flourish — per selected corner */}
              {insideImagePosition === "corner_flourish" && card.inside_image_url && accentPositions.map((slot) => (
                <div key={slot} style={cornerStyle(slot)}>
                  <img src={card.inside_image_url!} alt="" style={cornerImgStyle()} />
                </div>
              ))}

              {/* Frame — portrait fill */}
              {insideImagePosition === "frame" && card.inside_image_url && (
                <img src={card.inside_image_url!} alt="" style={frameImgStyle()} />
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[0.55rem] text-center py-0.5" style={{ zIndex: 2 }}>
                Inside
              </div>
            </div>
          </div>
        </div>

        {/* ─── Message ─── */}
        <div className="card-surface p-5 mb-4">
          <p className="section-label mb-3">Message</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Greeting</label>
              <input
                value={greeting}
                onChange={(e) => { setGreeting(e.target.value); setSaved(false); }}
                style={fontCSS(insideFont)}
                className="w-full input-field rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setSaved(false); }}
                rows={5}
                style={fontCSS(insideFont)}
                className="w-full input-field rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Closing</label>
              <textarea
                value={closing}
                onChange={(e) => { setClosing(e.target.value); setSaved(false); }}
                rows={2}
                placeholder="e.g. Love,&#10;Jane"
                style={fontCSS(insideFont)}
                className="w-full input-field rounded-lg px-3 py-2 text-sm resize-none"
              />
              <p className="text-xs text-warm-gray mt-0.5">Put the sender name(s) on a new line below the phrase.</p>
            </div>

            {/* Who's signing — affects e-card envelope and can pre-fill closing */}
            {recipient && (recipient.links?.length ?? 0) > 0 && (
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Signed from</label>
                <p className="text-xs text-warm-gray mb-2">
                  Include linked people on the e-card envelope? You can also add their names to the closing above.
                </p>
                <div className="flex flex-wrap gap-3">
                  {recipient.links!.map((link) => {
                    const linked = allRecipients.find((r) => r.id === link.recipient_id);
                    if (!linked) return null;
                    const checked = signerRecipientIds.includes(link.recipient_id);
                    const displayName = linked.nickname || linked.first_name || linked.display_name || linked.name || "?";
                    return (
                      <label key={link.recipient_id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSaved(false);
                            setSignerRecipientIds((prev) =>
                              checked ? prev.filter((id) => id !== link.recipient_id) : [...prev, link.recipient_id]
                            );
                          }}
                          className="rounded border-warm-gray"
                        />
                        <span className="text-sm text-charcoal">
                          {displayName}
                          <span className="text-warm-gray font-normal capitalize"> ({link.label})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {signerRecipientIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const profile = getUserProfile();
                      const virtualCard = { ...card!, signer_recipient_ids: signerRecipientIds } as Card;
                      const names = getSignerNameList(virtualCard, recipient, allRecipients, profile);
                      const formatted = formatSignerNames(names);
                      if (formatted && !closing.includes(formatted)) {
                        setClosing(closing.trim() ? `${closing.trim()}\n\n${formatted}` : formatted);
                        setSaved(false);
                      }
                    }}
                    className="mt-2 text-xs font-medium"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Insert these names into closing
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-3 grid-cols-3">
              <div>
                <label className="block text-xs text-warm-gray mb-1">Font</label>
                <select
                  value={insideFont}
                  onChange={(e) => { setInsideFont(e.target.value); setSaved(false); }}
                  className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Text size</label>
                <select
                  value={msgSizeScale}
                  onChange={(e) => { setMsgSizeScale(parseFloat(e.target.value)); setSaved(false); }}
                  className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                >
                  {sizeOpts.map((o) => (
                    <option key={o.label} value={o.label === "Auto" ? 0 : o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const currentGroup = getDecorationGroup(insideImagePosition);
                const filteredOptions = ALL_DECORATION_OPTIONS.filter(
                  (o) => o.group === "remove" || o.group === currentGroup
                );
                const isOriginalAvailable = originalInsideImageUrl && insideImagePosition !== originalInsidePosition;
                return (
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Decoration</label>
                    <select
                      value={insideImagePosition}
                      disabled={regenerating}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        const oldVal = insideImagePosition;
                        if (newVal === oldVal) return;

                        if (newVal === "none") {
                          setInsideImagePosition("none");
                          updateCard(cardId, { inside_image_url: null, inside_image_position: undefined, accent_positions: undefined } as Partial<Card>);
                          const updated = getCardById(cardId);
                          if (updated) hydrateCardImages(updated).then(setCard);
                          setSaved(true);
                          return;
                        }

                        if (needsRegeneration(oldVal, newVal)) {
                          regenerateDecoration(newVal);
                        } else {
                          setInsideImagePosition(newVal);
                          if (newVal === "corner_flourish") setAccentPositions((p) => p.length ? p : [3]);
                          else if (newVal === "top_edge_accent") setAccentPositions((p) => p.length ? p : [1]);
                          else if (newVal === "frame") setAccentPositions([]);
                          setSaved(false);
                        }
                      }}
                      className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                    >
                      {filteredOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    {isOriginalAvailable && !regenerating && (
                      <button
                        onClick={restoreOriginalDecoration}
                        className="text-xs mt-1 hover:underline"
                        style={{ color: "var(--color-brand)" }}
                      >
                        Restore original
                      </button>
                    )}
                  </div>
                );
              })()}
              {regenError && (
                <div className="col-span-full">
                  <p className="text-xs text-red-600">{regenError}</p>
                </div>
              )}
              {/* Corner position picker */}
              {card.inside_image_url && insideImagePosition === "corner_flourish" && !regenerating && (
                <div className="col-span-full">
                  <label className="block text-xs text-warm-gray mb-1">Active corners</label>
                  <div className="flex gap-2">
                    {[{ s: 1, l: "TL" }, { s: 2, l: "TR" }, { s: 4, l: "BL" }, { s: 3, l: "BR" }].map(({ s, l }) => (
                      <button key={s} onClick={() => { setAccentPositions((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); setSaved(false); }}
                        className={`px-2 py-1 rounded text-xs font-medium border ${accentPositions.includes(s) ? "border-brand bg-brand-light text-charcoal" : "border-light-gray text-warm-gray"}`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* Edge position picker */}
              {card.inside_image_url && insideImagePosition === "top_edge_accent" && !regenerating && (
                <div className="col-span-full">
                  <label className="block text-xs text-warm-gray mb-1">Active edges</label>
                  <div className="flex gap-2">
                    {[{ s: 1, l: "Top" }, { s: 2, l: "Bottom" }].map(({ s, l }) => (
                      <button key={s} onClick={() => { setAccentPositions((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); setSaved(false); }}
                        className={`px-3 py-1 rounded text-xs font-medium border ${accentPositions.includes(s) ? "border-brand bg-brand-light text-charcoal" : "border-light-gray text-warm-gray"}`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Letter Insert ─── */}
        <div className="card-surface p-5 mb-4">
          <p className="section-label mb-3">Letter insert</p>
          {letterText.trim() ? (
            <div className="space-y-3">
              <p className="text-xs text-warm-gray">A personal note tucked inside the card. Use blank lines to separate greeting, body, and closing.</p>
              <textarea
                value={letterText}
                onChange={(e) => { setLetterText(e.target.value); setSaved(false); }}
                rows={6}
                style={fontCSS(letterFont)}
                className="w-full input-field rounded-lg px-3 py-2 text-sm resize-y"
              />
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs text-warm-gray mb-1">Font</label>
                  <select
                    value={letterFont}
                    onChange={(e) => { setLetterFont(e.target.value); setSaved(false); }}
                    className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-warm-gray mb-1">Text size</label>
                  <select
                    value={letterSizeScale}
                    onChange={(e) => { setLetterSizeScale(parseFloat(e.target.value)); setSaved(false); }}
                    className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value={0.8}>Small</option>
                    <option value={0.9}>Medium</option>
                    <option value={1}>Auto</option>
                    <option value={1.15}>Large</option>
                    <option value={1.3}>Extra Large</option>
                  </select>
                </div>
                <button
                  onClick={() => { setLetterText(""); setSaved(false); }}
                  className="text-xs text-warm-gray hover:text-charcoal py-1.5"
                >
                  Remove letter
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-warm-gray mb-3">No letter yet. Add a handwritten-style note tucked inside the card.</p>
              <button
                onClick={() => setLetterText("Dear " + (recipient?.first_name || recipient?.name || "friend") + ",\n\n\n\nWith love,")}
                className="text-sm font-medium"
                style={{ color: "var(--color-brand)" }}
              >
                + Add a personal letter
              </button>
            </div>
          )}
        </div>

        {/* ─── Occasion, Tone & Design ─── */}
        <div className="card-surface p-5 mb-4">
          <p className="section-label mb-3">Occasion, tone &amp; design</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Occasion</label>
              <input
                value={occasion}
                onChange={(e) => { setOccasion(e.target.value); setSaved(false); }}
                className="w-full input-field rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Tone</label>
              <select
                value={toneUsed}
                onChange={(e) => { setToneUsed(e.target.value); setSaved(false); }}
                className="w-full input-field rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Not specified</option>
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Art style</label>
              <select
                value={artStyle}
                onChange={(e) => { setArtStyle(e.target.value); setSaved(false); }}
                className="w-full input-field rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Not specified</option>
                {ART_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Image subject</label>
              <select
                value={imageSubject}
                onChange={(e) => { setImageSubject(e.target.value); setSaved(false); }}
                className="w-full input-field rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Not specified</option>
                {IMAGE_SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ─── Front Text ─── */}
        <div className="card-surface p-5 mb-4">
          <p className="section-label mb-3">Front text</p>
          <div className="space-y-3">
            <p className="text-xs text-warm-gray">Add line breaks (Enter) to control how longer text wraps.</p>
            <textarea
              value={frontText}
              onChange={(e) => { setFrontText(e.target.value); setSaved(false); }}
              placeholder="e.g. Happy Birthday!"
              rows={3}
              className="w-full input-field rounded-lg px-3 py-2 text-sm resize-y"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-warm-gray mb-1">Position</label>
                <select
                  value={frontTextPosition}
                  onChange={(e) => { setFrontTextPosition(e.target.value); setSaved(false); }}
                  className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                >
                  {FRONT_TEXT_POSITIONS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Style</label>
                <select
                  value={frontTextStyle}
                  onChange={(e) => { setFrontTextStyle(e.target.value as TextStyleChoice); setSaved(false); }}
                  className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                >
                  {FRONT_TEXT_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Font</label>
                <select
                  value={frontTextFont}
                  onChange={(e) => { setFrontTextFont(e.target.value); setSaved(false); }}
                  className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Text size</label>
                <select
                  value={ftSizeScale}
                  onChange={(e) => { setFtSizeScale(parseFloat(e.target.value)); setSaved(false); }}
                  className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value={0.7}>Small</option>
                  <option value={0.85}>Medium</option>
                  <option value={1}>Auto</option>
                  <option value={1.2}>Large</option>
                  <option value={1.4}>Extra Large</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Print Settings ─── */}
        <div className="card-surface p-5 mb-6">
          <p className="section-label mb-3">Print settings</p>
          <div>
            <label className="block text-xs text-warm-gray mb-1">Card size</label>
            <select
              value={cardSize}
              onChange={(e) => { setCardSize(e.target.value as "4x6" | "5x7"); setSaved(false); }}
              className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
              style={{ maxWidth: 200 }}
            >
              <option value="4x6">4&quot; × 6&quot;</option>
              <option value="5x7">5&quot; × 7&quot;</option>
            </select>
          </div>
        </div>

        {/* ─── Regeneration prompt (when content-affecting fields changed) ─── */}
        {contentChanged && (
          <div className="mb-6 p-5 rounded-xl" style={{ background: "var(--color-amber-light)", border: "1px solid var(--color-light-gray)" }}>
            <p className="text-sm font-medium text-charcoal mb-1">
              Content change detected
            </p>
            <p className="text-sm text-warm-gray mb-4">
              {changeLabel}. Would you like to regenerate?
            </p>
            <div className="flex flex-wrap gap-3">
              {messageAffected && (
                <button
                  onClick={() => navigateToWizard("tone")}
                  className="btn-primary px-5 py-2.5 rounded-lg text-sm"
                >
                  Regenerate message
                </button>
              )}
              {imageAffected && (
                <button
                  onClick={() => navigateToWizard("design_subject")}
                  className="btn-primary px-5 py-2.5 rounded-lg text-sm"
                >
                  Regenerate image
                </button>
              )}
              {messageAffected && imageAffected && (
                <button
                  onClick={() => navigateToWizard("tone")}
                  className="btn-primary px-5 py-2.5 rounded-lg text-sm"
                >
                  Regenerate both
                </button>
              )}
              <button
                onClick={handleSave}
                className="btn-secondary px-5 py-2.5 rounded-lg text-sm"
              >
                Just save the labels
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

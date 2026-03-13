"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCardById, updateCard, saveCard, getRecipients, hydrateCardImages } from "@/lib/store";
import AppHeader from "@/components/AppHeader";
import type { Card, Recipient } from "@/types/database";
import { ALL_OCCASIONS, OTHER_OCCASION_VALUE, OTHER_OCCASION_LABEL, getDisplayOccasion } from "@/lib/occasions";
import { fontCSS, positionCSS, textStyleCSS, frontTextAlign, messageSizing, FONT_OPTIONS } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";

const FRONT_TEXT_STYLES: { id: TextStyleChoice; label: string }[] = [
  { id: "white_box", label: "Plain black text" },
  { id: "plain", label: "Black on white box" },
  { id: "plain_white", label: "Plain white text" },
  { id: "dark_box", label: "White on dark box" },
];

const FRONT_TEXT_POSITIONS = [
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "center", label: "Center" },
  { id: "top-center", label: "Top center" },
  { id: "top-left", label: "Top left" },
];

const INSIDE_POSITIONS = [
  { id: "top", label: "Top banner" },
  { id: "middle", label: "Middle band" },
  { id: "bottom", label: "Bottom banner" },
  { id: "left", label: "Left edge" },
  { id: "right", label: "Right edge" },
  { id: "behind", label: "Watermark (behind text)" },
];

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

  // Editable fields
  const [greeting, setGreeting] = useState("");
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState("");
  const [frontText, setFrontText] = useState("");
  const [frontTextPosition, setFrontTextPosition] = useState("bottom-right");
  const [frontTextStyle, setFrontTextStyle] = useState<TextStyleChoice>("dark_box");
  const [frontTextFont, setFrontTextFont] = useState<string>("sans");
  const [insideFont, setInsideFont] = useState<string>("sans");
  const [toneUsed, setToneUsed] = useState("");
  const [occasion, setOccasion] = useState("");
  const [insideImagePosition, setInsideImagePosition] = useState("top");
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");
  const [letterText, setLetterText] = useState("");
  const [letterFont, setLetterFont] = useState<string>("handwritten");
  const [msgSizeScale, setMsgSizeScale] = useState<number>(1.5);
  const [ftSizeScale, setFtSizeScale] = useState<number>(1);
  const [letterSizeScale, setLetterSizeScale] = useState<number>(1);
  const [artStyle, setArtStyle] = useState("");
  const [imageSubject, setImageSubject] = useState("");

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
        setFrontTextStyle((hydrated.front_text_style as TextStyleChoice) ?? "dark_box");
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
        setInsideImagePosition(hydrated.inside_image_position ?? "top");
        setCardSize(hydrated.card_size ?? "5x7");
        setLetterText(hydrated.letter_text ?? "");
        setLetterFont(hydrated.letter_font ?? "handwritten");
        if (hydrated.msg_font_scale != null) setMsgSizeScale(hydrated.msg_font_scale);
        if (hydrated.ft_font_scale != null) setFtSizeScale(hydrated.ft_font_scale);
        if (hydrated.letter_font_scale != null) setLetterSizeScale(hydrated.letter_font_scale);
      });
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === c.recipient_id);
      if (r) setRecipient(r);
    }
  }, [cardId]);

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

  const insidePos = (card.inside_image_position ?? insideImagePosition) as string;
  const ftPos = positionCSS(frontTextPosition);
  const ftFont = fontCSS(frontTextFont);
  const ftStyle = textStyleCSS(frontTextStyle);
  const msgFont = fontCSS(insideFont);
  const sizing = messageSizing(messageText.length);

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
      inside_image_position: (card!.inside_image_url ? insideImagePosition : card!.inside_image_position) as Card["inside_image_position"],
      card_size: cardSize,
      letter_text: letterText.trim() || null,
      letter_font: letterText.trim() ? letterFont : null,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      letter_font_scale: letterSizeScale,
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
          onClick={() => recipient ? router.push(`/recipients/${recipient.id}`) : router.push("/")}
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
            onClick={() => { handleSave(); router.push(`/cards/view/${card.id}`); }}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
            style={{ border: "1.5px solid var(--color-sage)" }}
          >
            View e-card
          </button>
          <button
            onClick={() => { handleSave(); router.push(`/cards/print/${card.id}`); }}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
            style={{ border: "1.5px solid var(--color-sage)" }}
          >
            Print preview
          </button>
          <span className="flex-1" />
          <button
            onClick={() => recipient && router.push(`/cards/create/${recipient.id}`)}
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
            <button onClick={() => router.push(`/cards/view/${savedAsNew}`)} className="underline font-medium" style={{ color: "var(--color-brand)" }}>
              view it
            </button>.
          </div>
        )}

        {/* ─── Card Preview ─── */}
        <div className="mb-8">
          <p className="section-label mb-3">Preview</p>
          <div className="flex gap-4 justify-center">
            {/* Front panel */}
            <div
              className="relative card-surface rounded-xl shadow-lg overflow-hidden"
              style={{ width: "45%", maxWidth: 240, aspectRatio: "5 / 7" }}
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
                        fontSize: "clamp(0.65rem, 3vw, 1.1rem)",
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

            {/* Inside panel */}
            <div
              className="relative card-surface rounded-xl shadow-lg overflow-hidden flex"
              style={{
                width: "45%",
                maxWidth: 240,
                aspectRatio: "5 / 7",
                ...msgFont,
                flexDirection: insideImagePosition === "left" || insideImagePosition === "right" ? "row" : "column",
                position: "relative",
              }}
            >
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

              <div
                className="flex flex-col justify-center items-center text-center"
                style={{
                  flex: 1,
                  padding: insideImagePosition === "left" || insideImagePosition === "right" ? "0.6rem 0.4rem" : "0.75rem",
                  overflow: "hidden",
                  position: "relative",
                  zIndex: 1,
                  gap: sizing.gap,
                }}
              >
                {insideImagePosition === "middle" && card.inside_image_url && (
                  <div style={{ width: "100%", height: "14%", flexShrink: 0 }}>
                    <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.15rem" }} />
                  </div>
                )}

                <p className="text-charcoal" style={{ fontSize: "clamp(0.55rem, 2.5vw, 0.85rem)", fontWeight: 600 }}>
                  {greeting}
                </p>
                {body && (
                  <p className="text-charcoal leading-relaxed whitespace-pre-wrap" style={{ fontSize: "clamp(0.45rem, 2vw, 0.7rem)" }}>
                    {body}
                  </p>
                )}
                {closing && (
                  <p className="text-warm-gray whitespace-pre-line" style={{ fontSize: "clamp(0.45rem, 2vw, 0.7rem)", fontStyle: "italic" }}>
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

            <div className={`grid gap-3 ${card.inside_image_url ? "grid-cols-3" : "grid-cols-2"}`}>
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
                  <option value={1}>Small</option>
                  <option value={1.25}>Medium</option>
                  <option value={1.5}>Auto</option>
                  <option value={1.75}>Large</option>
                  <option value={2}>Extra Large</option>
                </select>
              </div>
              {card.inside_image_url && (
                <div>
                  <label className="block text-xs text-warm-gray mb-1">Decoration position</label>
                  <select
                    value={insideImagePosition}
                    onChange={(e) => { setInsideImagePosition(e.target.value); setSaved(false); }}
                    className="w-full input-field rounded-lg px-2 py-1.5 text-sm"
                  >
                    {INSIDE_POSITIONS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
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

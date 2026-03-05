"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCardById, updateCard, saveCard, getRecipients, hydrateCardImages } from "@/lib/store";
import type { Card, Recipient } from "@/types/database";
import { fontCSS, positionCSS, textStyleCSS, messageSizing } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";

const FONT_OPTIONS: { id: FontChoice; label: string }[] = [
  { id: "sans", label: "Clean (Sans)" },
  { id: "script", label: "Elegant (Script)" },
  { id: "block", label: "Bold (Block)" },
];

const FRONT_TEXT_STYLES: { id: TextStyleChoice; label: string }[] = [
  { id: "plain", label: "Plain black text" },
  { id: "white_box", label: "Black on white box" },
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
  const [frontTextFont, setFrontTextFont] = useState<FontChoice>("sans");
  const [insideFont, setInsideFont] = useState<FontChoice>("sans");
  const [toneUsed, setToneUsed] = useState("");
  const [occasion, setOccasion] = useState("");
  const [insideImagePosition, setInsideImagePosition] = useState("top");
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");
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
        const o = hydrated.occasion ?? "";
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
      });
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === c.recipient_id);
      if (r) setRecipient(r);
    }
  }, [cardId]);

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <p className="text-gray-500 mb-4">Card not found.</p>
        <button onClick={() => router.push("/")} className="text-indigo-600 font-medium">
          Back to dashboard
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
      occasion: occasion || card!.occasion,
      art_style: artStyle || null,
      image_subject: imageSubject || null,
      inside_image_position: (card!.inside_image_url ? insideImagePosition : card!.inside_image_position) as Card["inside_image_position"],
      card_size: cardSize,
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => recipient ? router.push(`/recipients/${recipient.id}`) : router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to {recipient?.name ?? "dashboard"}
          </button>
          <span className="text-sm text-gray-500">Edit card</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            Changes saved.
          </div>
        )}
        {savedAsNew && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            Saved as a new card.{" "}
            <button onClick={() => router.push(`/cards/edit/${savedAsNew}`)} className="underline font-medium">
              Edit the new card
            </button>{" "}
            or{" "}
            <button onClick={() => router.push(`/cards/view/${savedAsNew}`)} className="underline font-medium">
              view it
            </button>.
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {occasion} card{recipient ? ` for ${recipient.name}` : ""}
        </h1>

        {/* ─── Card Preview ─── */}
        <div className="mb-8">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Preview</p>
          <div className="flex gap-4 justify-center">
            {/* Front panel */}
            <div
              className="relative bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
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
                        maxWidth: "88%",
                        fontSize: "clamp(0.65rem, 3vw, 1.1rem)",
                        lineHeight: 1.25,
                        textAlign: "center",
                      }}
                    >
                      {frontText}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <p className="text-3xl text-indigo-300">&#127912;</p>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[0.55rem] text-center py-0.5">
                Front
              </div>
            </div>

            {/* Inside panel */}
            <div
              className="relative bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 flex"
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

                <p className="text-gray-800" style={{ fontSize: "clamp(0.55rem, 2.5vw, 0.85rem)", fontWeight: 600 }}>
                  {greeting}
                </p>
                {body && (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ fontSize: "clamp(0.45rem, 2vw, 0.7rem)" }}>
                    {body}
                  </p>
                )}
                {closing && (
                  <p className="text-gray-600" style={{ fontSize: "clamp(0.45rem, 2vw, 0.7rem)", fontStyle: "italic" }}>
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
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Message</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Greeting</label>
              <input
                value={greeting}
                onChange={(e) => { setGreeting(e.target.value); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setSaved(false); }}
                rows={5}
                style={fontCSS(insideFont)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing</label>
              <input
                value={closing}
                onChange={(e) => { setClosing(e.target.value); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* ─── Occasion, Tone & Design ─── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Occasion, tone &amp; design</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occasion</label>
              <input
                value={occasion}
                onChange={(e) => { setOccasion(e.target.value); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select
                value={toneUsed}
                onChange={(e) => { setToneUsed(e.target.value); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">Not specified</option>
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Art style</label>
              <select
                value={artStyle}
                onChange={(e) => { setArtStyle(e.target.value); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">Not specified</option>
                {ART_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image subject</label>
              <select
                value={imageSubject}
                onChange={(e) => { setImageSubject(e.target.value); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
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
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Front text</p>
          <div className="space-y-3">
            <input
              value={frontText}
              onChange={(e) => { setFrontText(e.target.value); setSaved(false); }}
              placeholder="e.g. Happy Birthday!"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Position</label>
                <select
                  value={frontTextPosition}
                  onChange={(e) => { setFrontTextPosition(e.target.value); setSaved(false); }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                >
                  {FRONT_TEXT_POSITIONS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Style</label>
                <select
                  value={frontTextStyle}
                  onChange={(e) => { setFrontTextStyle(e.target.value as TextStyleChoice); setSaved(false); }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                >
                  {FRONT_TEXT_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Font</label>
                <select
                  value={frontTextFont}
                  onChange={(e) => { setFrontTextFont(e.target.value as FontChoice); setSaved(false); }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Inside & Print ─── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Inside &amp; print settings</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Inside font</label>
              <select
                value={insideFont}
                onChange={(e) => { setInsideFont(e.target.value as FontChoice); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            {card.inside_image_url && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Decoration position</label>
                <select
                  value={insideImagePosition}
                  onChange={(e) => { setInsideImagePosition(e.target.value); setSaved(false); }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                >
                  {INSIDE_POSITIONS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Card size</label>
              <select
                value={cardSize}
                onChange={(e) => { setCardSize(e.target.value as "4x6" | "5x7"); setSaved(false); }}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="4x6">4&quot; × 6&quot;</option>
                <option value="5x7">5&quot; × 7&quot;</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── Regeneration prompt (when content-affecting fields changed) ─── */}
        {contentChanged && (
          <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-medium text-amber-900 mb-1">
              Content change detected
            </p>
            <p className="text-sm text-amber-700 mb-4">
              {changeLabel}. Would you like to regenerate?
            </p>
            <div className="flex flex-wrap gap-3">
              {messageAffected && (
                <button
                  onClick={() => navigateToWizard("tone")}
                  className="bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Regenerate message
                </button>
              )}
              {imageAffected && (
                <button
                  onClick={() => navigateToWizard("design_subject")}
                  className="bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Regenerate image
                </button>
              )}
              {messageAffected && imageAffected && (
                <button
                  onClick={() => navigateToWizard("tone")}
                  className="bg-amber-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-900 transition-colors"
                >
                  Regenerate both
                </button>
              )}
              <button
                onClick={handleSave}
                className="bg-white border border-amber-300 text-amber-800 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
              >
                Just save the labels
              </button>
            </div>
          </div>
        )}

        {/* ─── Actions ─── */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Save changes
          </button>
          <button
            onClick={handleSaveAsNew}
            className="bg-white border border-indigo-200 text-indigo-600 px-6 py-3 rounded-xl font-medium hover:bg-indigo-50 transition-colors"
          >
            Save as new card
          </button>
          <button
            onClick={() => recipient && router.push(`/cards/create/${recipient.id}`)}
            className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Redesign from scratch
          </button>
          <button
            onClick={() => router.push(`/cards/view/${card.id}`)}
            className="bg-white border border-gray-200 text-gray-700 px-5 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            View
          </button>
          <button
            onClick={() => router.push(`/cards/print/${card.id}`)}
            className="bg-white border border-gray-200 text-gray-700 px-5 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Print
          </button>
        </div>
      </main>
    </div>
  );
}

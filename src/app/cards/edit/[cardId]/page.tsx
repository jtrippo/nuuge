"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCardById, updateCard, saveCard, getRecipients, hydrateCardImages } from "@/lib/store";
import type { Card, Recipient } from "@/types/database";

const FONT_OPTIONS = [
  { id: "sans" as const, label: "Clean (Sans)" },
  { id: "script" as const, label: "Elegant (Script)" },
  { id: "block" as const, label: "Bold (Block)" },
];

const FRONT_TEXT_STYLES = [
  { id: "plain" as const, label: "Plain black text" },
  { id: "white_box" as const, label: "Black on white box" },
  { id: "dark_box" as const, label: "White on dark box" },
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
  const [frontTextStyle, setFrontTextStyle] = useState<"dark_box" | "white_box" | "plain">("dark_box");
  const [frontTextFont, setFrontTextFont] = useState<"sans" | "script" | "block">("sans");
  const [insideFont, setInsideFont] = useState<"sans" | "script" | "block">("sans");
  const [toneUsed, setToneUsed] = useState("");
  const [occasion, setOccasion] = useState("");
  const [insideImagePosition, setInsideImagePosition] = useState("top");
  const [cardSize, setCardSize] = useState<"4x6" | "5x7">("5x7");

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
        setFrontTextStyle((hydrated.front_text_style as "dark_box" | "white_box" | "plain") ?? "dark_box");
        setFrontTextFont(hydrated.front_text_font ?? "sans");
        setInsideFont(hydrated.font ?? "sans");
        setToneUsed(hydrated.tone_used ?? "");
        setOccasion(hydrated.occasion ?? "");
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
      inside_image_position: (card!.inside_image_url ? insideImagePosition : card!.inside_image_position) as Card["inside_image_position"],
      card_size: cardSize,
    };
  }

  function handleSave() {
    updateCard(cardId, getUpdates());
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

  function handleRedesign() {
    if (recipient) {
      router.push(`/cards/create/${recipient.id}`);
    }
  }

  const FONT_STYLES: Record<"sans" | "script" | "block", React.CSSProperties> = {
    sans: { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" },
    script: { fontFamily: "'Georgia', 'Palatino', serif", fontStyle: "italic" },
    block: { fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  };

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
            <button
              onClick={() => router.push(`/cards/edit/${savedAsNew}`)}
              className="underline font-medium"
            >
              Edit the new card
            </button>{" "}
            or{" "}
            <button
              onClick={() => router.push(`/cards/view/${savedAsNew}`)}
              className="underline font-medium"
            >
              view it
            </button>.
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {occasion} card{recipient ? ` for ${recipient.name}` : ""}
        </h1>

        {/* ─── Card Images ─── */}
        <div className="flex gap-4 mb-6">
          {card.image_url && (
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Front</p>
              <img src={card.image_url} alt="Card front" className="w-full rounded-xl border border-gray-200" />
            </div>
          )}
          {card.inside_image_url && (
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Inside decoration</p>
              <img src={card.inside_image_url} alt="Inside decoration" className="w-full rounded-xl border border-gray-200" />
            </div>
          )}
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
                style={FONT_STYLES[insideFont]}
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

        {/* ─── Occasion & Tone ─── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Occasion &amp; tone</p>
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
                  onChange={(e) => { setFrontTextStyle(e.target.value as "dark_box" | "white_box" | "plain"); setSaved(false); }}
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
                  onChange={(e) => { setFrontTextFont(e.target.value as "sans" | "script" | "block"); setSaved(false); }}
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
                onChange={(e) => { setInsideFont(e.target.value as "sans" | "script" | "block"); setSaved(false); }}
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
            onClick={handleRedesign}
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

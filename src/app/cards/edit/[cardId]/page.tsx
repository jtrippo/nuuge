"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCardById, updateCard, getRecipients } from "@/lib/store";
import type { Card, Recipient } from "@/types/database";

export default function EditCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [greeting, setGreeting] = useState("");
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState("");
  const [frontText, setFrontText] = useState("");
  const [frontTextPosition, setFrontTextPosition] = useState("bottom-right");
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const c = getCardById(cardId);
    if (c) {
      setCard(c);
      const parts = c.message_text.split("\n\n");
      setGreeting(parts[0] || "");
      setBody(parts.slice(1, -1).join("\n\n") || parts[1] || "");
      setClosing(parts[parts.length - 1] || "");
      setFrontText(c.front_text ?? "");
      setFrontTextPosition(c.front_text_position ?? "bottom-right");
    }
    if (c) {
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
        <button
          onClick={() => router.push("/")}
          className="text-indigo-600 font-medium"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const messageText = [greeting, body, closing].filter(Boolean).join("\n\n");

  function handleSave() {
    updateCard(cardId, {
      message_text: messageText,
      front_text: frontText.trim() || null,
      front_text_position: frontText.trim() ? frontTextPosition : null,
    });
    setSaved(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => recipient && router.push(`/recipients/${recipient.id}`)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to {recipient?.name ?? "recipient"}
          </button>
          <span className="text-sm text-gray-500">Edit card</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            Changes saved. You can reprint or view from card history.
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {card.occasion} card{recipient ? ` for ${recipient.name}` : ""}
        </h1>

        {card.image_url && (
          <div className="mb-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Card front</p>
            <img
              src={card.image_url}
              alt="Card front"
              className="w-full max-w-sm rounded-xl border border-gray-200"
            />
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Greeting</label>
            <input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closing</label>
            <input
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-2">Text on front (optional)</p>
          <input
            value={frontText}
            onChange={(e) => setFrontText(e.target.value)}
            placeholder="e.g. Happy Birthday!"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:border-indigo-500"
          />
          <select
            value={frontTextPosition}
            onChange={(e) => setFrontTextPosition(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-center">Bottom center</option>
            <option value="top-center">Top center</option>
            <option value="top-left">Top left</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700"
          >
            Save changes
          </button>
          <button
            onClick={() => router.push(`/cards/view/${card.id}`)}
            className="bg-white border border-indigo-200 text-indigo-600 px-6 py-3 rounded-xl font-medium hover:bg-indigo-50"
          >
            View
          </button>
          <button
            onClick={() => router.push(`/cards/print/${card.id}`)}
            className="bg-white border border-indigo-200 text-indigo-600 px-6 py-3 rounded-xl font-medium hover:bg-indigo-50"
          >
            Reprint
          </button>
          {recipient && (
            <button
              onClick={() => router.push(`/recipients/${recipient.id}`)}
              className="text-gray-500 hover:text-gray-700 px-4 py-3"
            >
              Back to {recipient.name}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

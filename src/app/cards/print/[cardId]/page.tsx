"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCards, getRecipients } from "@/lib/store";
import type { Card, Recipient } from "@/types/database";

export default function PrintCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) {
      setCard(found);
      const recipients = getRecipients();
      const r = recipients.find((r) => r.id === found.recipient_id);
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

  const messageParts = card.message_text.split("\n\n");
  const greeting = messageParts[0] || "";
  const body = messageParts.slice(1, -1).join("\n\n") || messageParts[1] || "";
  const closing = messageParts[messageParts.length - 1] || "";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
          body { margin: 0; padding: 0; }
        }
      `}</style>

      {/* On-screen controls */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Dashboard
          </button>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              Print preview{recipient ? ` — card for ${recipient.name}` : ""}
            </p>
            <button
              onClick={() => window.print()}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium
                         hover:bg-indigo-700 transition-colors"
            >
              Print card
            </button>
          </div>
        </div>
      </div>

      <div className="no-print px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">Printing tips</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Use landscape orientation for best results</li>
              <li>Print on cardstock for a more professional feel</li>
              <li>The front image prints first, the inside message prints second</li>
              <li>Fold in half after printing to create your card</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Page 1: Card front */}
      <div className="print-page flex items-center justify-center min-h-[90vh] bg-white px-8 py-12">
        <div className="w-full max-w-lg">
          {card.image_url ? (
            <img
              src={card.image_url}
              alt="Card front"
              className="w-full rounded-xl shadow-lg"
            />
          ) : (
            <div className="w-full aspect-[4/3] bg-gradient-to-br from-indigo-100 to-purple-100
                            rounded-xl shadow-lg flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl mb-3">&#127912;</p>
                <p className="text-indigo-400 text-lg font-medium">{card.occasion}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page 2: Card inside */}
      <div className="print-page flex items-center justify-center min-h-[90vh] bg-white px-8 py-12">
        <div className="w-full max-w-md text-center">
          <p className="text-2xl font-medium text-gray-800 mb-6">
            {greeting}
          </p>
          <p className="text-base text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap">
            {body}
          </p>
          <p className="text-base text-gray-600 italic">
            {closing}
          </p>
          {card.co_signed_with && (
            <p className="text-sm text-gray-400 mt-3">
              &amp; {card.co_signed_with}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

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
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [printSize, setPrintSize] = useState<"4x6" | "5x7">("5x7");

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) {
      setCard(found);
      setPrintSize(found.card_size === "4x6" ? "4x6" : "5x7");
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === found.recipient_id);
      if (r) setRecipient(r);
    }
  }, [cardId]);

  const imageUrls: string[] = card
    ? [card.image_url, card.inside_image_url].filter((u): u is string => Boolean(u))
    : [];
  useEffect(() => {
    if (imageUrls.length === 0) {
      setImagesLoaded(true);
      return;
    }
    let done = 0;
    const check = () => {
      done++;
      if (done >= imageUrls.length) setImagesLoaded(true);
    };
    imageUrls.forEach((src) => {
      const img = new Image();
      img.onload = check;
      img.onerror = check;
      img.src = src;
    });
  }, [card?.id]);

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

  const pos = card.front_text_position ?? "bottom-right";
  const frontTextClass =
    pos === "top-left"
      ? "left-2 top-2"
      : pos === "top-center"
        ? "left-1/2 top-2 -translate-x-1/2"
        : pos === "bottom-left"
          ? "bottom-2 left-2"
          : pos === "bottom-center"
            ? "bottom-2 left-1/2 -translate-x-1/2"
            : "bottom-2 right-2";

  return (
    <>
      <style>{`
        .print-sheet {
          display: flex;
          flex-direction: row;
          width: 100%;
          min-height: 320px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1rem;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .print-half {
          width: 50%;
          box-sizing: border-box;
          padding: 1rem;
          border-right: 1px solid #e5e7eb;
          overflow: hidden;
        }
        .print-half:last-child { border-right: none; }
        .print-half img { display: block; }
        .print-front-half { aspect-ratio: 4 / 6; }
        .print-front-half.size-5x7 { aspect-ratio: 5 / 7; }
        .print-front-half img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .print-half:not(.print-front-half) img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        @page { size: landscape; margin: 0.4in; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-sheet {
            page-break-after: always;
            width: 100%;
            height: 100vh;
            min-height: 7in;
            border: none;
            margin: 0;
            border-radius: 0;
          }
          .print-sheet:last-of-type { page-break-after: auto; }
          .print-half {
            height: 100%;
            padding: 0.25in;
            border-right: 1px solid #ccc;
          }
          .print-front-half img { width: 100%; height: 100%; object-fit: cover; object-position: center; }
        }
      `}</style>

      {/* On-screen controls */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Dashboard
            </button>
            {recipient && (
              <button
                onClick={() => router.push(`/recipients/${recipient.id}`)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Done — back to {recipient.name}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Size:</span>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="printSize"
                  checked={printSize === "4x6"}
                  onChange={() => setPrintSize("4x6")}
                  className="text-indigo-600"
                />
                4×6
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="printSize"
                  checked={printSize === "5x7"}
                  onChange={() => setPrintSize("5x7")}
                  className="text-indigo-600"
                />
                5×7
              </label>
            </div>
            <p className="text-sm text-gray-500">
              {recipient ? `Card for ${recipient.name}` : "Print preview"}
            </p>
            {!imagesLoaded && imageUrls.length > 0 && (
              <span className="text-amber-600 text-sm">Loading images…</span>
            )}
            <button
              onClick={() => window.print()}
              disabled={!imagesLoaded && imageUrls.length > 0}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium
                         hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Print card
            </button>
          </div>
        </div>
      </div>

      <div className="no-print px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">How to print (landscape, two-sided)</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Card size: <strong>{printSize === "4x6" ? "4×6" : "5×7"}</strong> (use matching paper if you have it).</li>
              <li><strong>Page 1:</strong> Left = back of card · Right = front cover (image fills panel)</li>
              <li><strong>Page 2:</strong> Left = inside left (blank/art) · Right = message</li>
              <li>Set printer to <strong>landscape</strong>. Print both pages. Two-sided: print page 1, then feed and print page 2 on the back.</li>
              <li>Fold right over left so the front is on the outside.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sheet 1: Back (left) + Front (right) — one landscape page */}
      <div className="print-sheet bg-white">
        <div className="print-half flex flex-col justify-end border-r border-gray-200 print:border-gray-300">
          <p className="text-xs text-gray-400 print:text-black mt-auto pb-4">Created by Nuuge</p>
        </div>
        <div className={`print-half print-front-half relative flex items-center justify-center bg-white overflow-hidden ${printSize === "5x7" ? "size-5x7" : ""}`}>
          {card.image_url ? (
            <>
              <img
                src={card.image_url}
                alt="Card front"
              />
              {card.front_text && (
                <div className={`absolute text-lg font-medium text-gray-800 print:text-black ${frontTextClass}`}>
                  {card.front_text}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full min-h-[200px] bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <p className="text-indigo-400 text-lg font-medium">{card.occasion}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sheet 2: Inside left (blank/art) + Inside right (message) — one landscape page */}
      <div className="print-sheet bg-white">
        <div className="print-half flex flex-col items-center justify-center border-r border-gray-200 print:border-gray-300">
          {card.inside_image_url && (
            <img
              src={card.inside_image_url}
              alt=""
              className="max-h-32 w-auto object-contain"
            />
          )}
        </div>
        <div className="print-half flex flex-col justify-center text-center p-4">
          <p className="text-xl font-medium text-gray-800 mb-4">{greeting}</p>
          <p className="text-base text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">{body}</p>
          <p className="text-base text-gray-600 italic">{closing}</p>
        </div>
      </div>
    </>
  );
}

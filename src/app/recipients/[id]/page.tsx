"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getRecipients, saveRecipient, deleteRecipient, getCards, getCardsForRecipient, saveCard, getCardExpandedState, setCardExpanded, linkRecipients, unlinkRecipients, hydrateCardImages } from "@/lib/store";
import ProfileEditor from "@/components/ProfileEditor";
import type { Recipient, ImportantDate, Card, PersonProfile } from "@/types/database";

interface RecipientFields {
  relationship_type: string;
  humor_tolerance: string;
  tone_preference: string;
  important_dates: ImportantDate[];
  milestones: string;
}

export default function RecipientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState<Partial<PersonProfile>>({});
  const [recipientFields, setRecipientFields] = useState<RecipientFields | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkLabel, setLinkLabel] = useState("spouse");
  const [linkReverseLabel, setLinkReverseLabel] = useState("spouse");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [reuseCardId, setReuseCardId] = useState<string | null>(null);
  const [reuseTargetRecipientId, setReuseTargetRecipientId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [hydratedImages, setHydratedImages] = useState<Record<string, string>>({});

  const refreshCards = () => setCards(getCardsForRecipient(id));

  const isCardExpanded = (cardId: string) =>
    expandedCards[cardId] !== undefined ? expandedCards[cardId] : true;

  const toggleCardExpanded = (cardId: string) => {
    const next = !isCardExpanded(cardId);
    setCardExpanded(id, cardId, next);
    setExpandedCards((prev) => ({ ...prev, [cardId]: next }));
  };

  useEffect(() => {
    setMounted(true);
    const all = getRecipients();
    setAllRecipients(all);
    const found = all.find((r) => r.id === id);
    if (found) {
      setRecipient(found);
      setProfileData(initProfileData(found));
      setRecipientFields(initRecipientFields(found));
    }
  }, [id]);

  useEffect(() => {
    const rawCards = getCardsForRecipient(id);
    setCards(rawCards);
    setExpandedCards(getCardExpandedState(id));

    rawCards.forEach((c) => {
      if (c.image_url) {
        hydrateCardImages(c).then((h) => {
          if (h.image_url && !h.image_url.startsWith("idb:")) {
            setHydratedImages((prev) => ({ ...prev, [c.id]: h.image_url! }));
          }
        });
      }
    });
  }, [id]);

  if (!mounted) return null;

  if (!recipient || !recipientFields) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white">
        <p className="text-gray-500 mb-4">Person not found.</p>
        <button
          onClick={() => router.push("/")}
          className="text-indigo-600 font-medium hover:text-indigo-800"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  function toTags(val: unknown): string[] {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function initProfileData(r: Recipient): Partial<PersonProfile> {
    return {
      display_name: r.name,
      birthday: r.birthday || null,
      personality: r.personality_notes,
      humor_style: r.humor_style || null,
      interests: r.interests || [],
      values: r.values || [],
      occupation: r.occupation || null,
      location: r.location || null,
      lifestyle: r.lifestyle || null,
      pets: r.pets || null,
      children: r.children || null,
      favorite_foods: r.favorite_foods || null,
      favorite_music: r.favorite_music || null,
      favorite_movies_tv: r.favorite_movies_tv || null,
      favorite_books: r.favorite_books || null,
      dislikes: r.dislikes || null,
      communication_style: r.communication_style || null,
      notes: r.notes || null,
    };
  }

  function initRecipientFields(r: Recipient): RecipientFields {
    return {
      relationship_type: r.relationship_type,
      humor_tolerance: r.humor_tolerance || "",
      tone_preference: r.tone_preference || "",
      important_dates: r.important_dates || [],
      milestones: (r.milestones || []).join(", "),
    };
  }

  function handleCancel() {
    if (recipient) {
      setProfileData(initProfileData(recipient));
      setRecipientFields(initRecipientFields(recipient));
    }
    setEditing(false);
  }

  function handleSave() {
    if (!recipientFields || !recipient) return;
    const updated: Partial<Recipient> = {
      id: recipient.id,
      name: (profileData.display_name as string) || recipient.name,
      relationship_type: recipientFields.relationship_type,
      personality_notes: (profileData.personality as string) || null,
      interests: toTags(profileData.interests),
      values: toTags(profileData.values),
      humor_style: profileData.humor_style || null,
      humor_tolerance: recipientFields.humor_tolerance,
      tone_preference: recipientFields.tone_preference,
      important_dates: recipientFields.important_dates,
      milestones: recipientFields.milestones.split(",").map((s) => s.trim()).filter(Boolean),
      birthday: profileData.birthday || null,
      occupation: profileData.occupation || null,
      location: profileData.location || null,
      lifestyle: profileData.lifestyle || null,
      pets: profileData.pets || null,
      children: profileData.children || null,
      favorite_foods: profileData.favorite_foods || null,
      favorite_music: profileData.favorite_music || null,
      favorite_movies_tv: profileData.favorite_movies_tv || null,
      favorite_books: profileData.favorite_books || null,
      dislikes: profileData.dislikes || null,
      communication_style: profileData.communication_style || null,
      notes: profileData.notes || null,
    };
    saveRecipient(updated);
    const all = getRecipients();
    setAllRecipients(all);
    const refreshed = all.find((r) => r.id === recipient.id);
    if (refreshed) {
      setRecipient(refreshed);
      setProfileData(initProfileData(refreshed));
      setRecipientFields(initRecipientFields(refreshed));
    }
    setEditing(false);
  }

  function handleDelete() {
    if (confirm(`Remove ${recipient!.name}? This can't be undone.`)) {
      deleteRecipient(recipient!.id);
      router.push("/");
    }
  }

  function updateDate(index: number, field: keyof ImportantDate, value: string | boolean) {
    const updated = [...recipientFields!.important_dates];
    updated[index] = { ...updated[index], [field]: value };
    setRecipientFields({ ...recipientFields!, important_dates: updated });
  }

  function addDate() {
    setRecipientFields({
      ...recipientFields!,
      important_dates: [
        ...recipientFields!.important_dates,
        { label: "", date: "", recurring: true },
      ],
    });
  }

  function removeDate(index: number) {
    const updated = recipientFields!.important_dates.filter((_, i) => i !== index);
    setRecipientFields({ ...recipientFields!, important_dates: updated });
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
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg
                             hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push(`/cards/create/${recipient.id}`)}
                  className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg
                             hover:bg-indigo-700 transition-colors"
                >
                  Create card
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-indigo-600 font-medium hover:text-indigo-800 px-3 py-1.5"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {!editing && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{recipient.name}</h1>
              <p className="text-gray-500 capitalize">{recipient.relationship_type}</p>
            </div>
          )}

          {/* Recipient-specific fields */}
          {editing ? (
            <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
              <Field label="Relationship">
                <input
                  value={recipientFields.relationship_type}
                  onChange={(e) => setRecipientFields({ ...recipientFields, relationship_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
              </Field>
              <Field label="Humor tolerance">
                <input
                  value={recipientFields.humor_tolerance}
                  onChange={(e) => setRecipientFields({ ...recipientFields, humor_tolerance: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
              </Field>
              <Field label="Tone preference">
                <input
                  value={recipientFields.tone_preference}
                  onChange={(e) => setRecipientFields({ ...recipientFields, tone_preference: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
              </Field>
              <Field label="Important dates">
                <div className="space-y-2">
                  {recipientFields.important_dates.map((d, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={d.label}
                        onChange={(e) => updateDate(i, "label", e.target.value)}
                        placeholder="Label (e.g. Birthday)"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                      />
                      <input
                        value={d.date}
                        onChange={(e) => updateDate(i, "date", e.target.value)}
                        placeholder="MM-DD"
                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                      />
                      <button
                        onClick={() => removeDate(i)}
                        className="text-red-400 hover:text-red-600 text-sm px-1"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addDate}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Add date
                  </button>
                </div>
              </Field>
              <Field label="Milestones" hint="Comma-separated">
                <input
                  value={recipientFields.milestones}
                  onChange={(e) => setRecipientFields({ ...recipientFields, milestones: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
              <DetailRow label="Humor tolerance" value={recipient.humor_tolerance} />
              <DetailRow label="Tone preference" value={recipient.tone_preference} />
              <DetailRow
                label="Important dates"
                value={
                  recipient.important_dates && recipient.important_dates.length > 0 ? (
                    <div className="space-y-1">
                      {recipient.important_dates.map((d, i) => (
                        <p key={i} className="text-sm text-gray-700">
                          {d.label}: {d.date}
                          {d.recurring && (
                            <span className="text-gray-400 ml-1">(yearly)</span>
                          )}
                        </p>
                      ))}
                    </div>
                  ) : null
                }
              />
              <DetailRow
                label="Milestones"
                value={
                  recipient.milestones && recipient.milestones.length > 0
                    ? recipient.milestones.join(", ")
                    : null
                }
              />
            </div>
          )}

          {/* Shared profile fields */}
          <ProfileEditor
            profile={profileData}
            editing={editing}
            onChange={setProfileData}
            excludeFields={["display_name"]}
          />
        </div>

        {/* Linked People */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Linked people</h2>
            <button
              onClick={() => setShowLinkModal(true)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Link someone
            </button>
          </div>

          {(!recipient.links || recipient.links.length === 0) ? (
            <p className="text-sm text-gray-400 mb-2">
              No linked relationships yet. Link {recipient.name} to a spouse, child, parent, etc.
            </p>
          ) : (
            <div className="space-y-2 mb-2">
              {recipient.links.map((link) => {
                const linked = allRecipients.find((r) => r.id === link.recipient_id);
                if (!linked) return null;
                return (
                  <div
                    key={link.recipient_id}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm font-medium text-indigo-600 cursor-pointer hover:text-indigo-800"
                        onClick={() => router.push(`/recipients/${linked.id}`)}
                      >
                        {linked.name}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{link.label}</span>
                    </div>
                    <button
                      onClick={() => {
                        unlinkRecipients(recipient.id, linked.id);
                        const refreshed = getRecipients();
                        setAllRecipients(refreshed);
                        const updated = refreshed.find((r) => r.id === id);
                        if (updated) setRecipient(updated);
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Unlink
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Link Modal */}
        {showLinkModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Link {recipient.name} to someone
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Person
                  </label>
                  <select
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                               outline-none focus:border-indigo-500"
                  >
                    <option value="">Select a person...</option>
                    {allRecipients
                      .filter(
                        (r) =>
                          r.id !== id &&
                          !(recipient.links || []).some(
                            (l) => l.recipient_id === r.id
                          )
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.relationship_type})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {recipient.name}&apos;s relationship to them
                  </label>
                  <select
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                               outline-none focus:border-indigo-500"
                  >
                    <option value="spouse">Spouse</option>
                    <option value="partner">Partner</option>
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Their relationship to {recipient.name}
                  </label>
                  <select
                    value={linkReverseLabel}
                    onChange={(e) => setLinkReverseLabel(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                               outline-none focus:border-indigo-500"
                  >
                    <option value="spouse">Spouse</option>
                    <option value="partner">Partner</option>
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setLinkTarget("");
                  }}
                  className="flex-1 text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!linkTarget) return;
                    linkRecipients(id, linkLabel, linkTarget, linkReverseLabel);
                    const refreshed = getRecipients();
                    setAllRecipients(refreshed);
                    const updated = refreshed.find((r) => r.id === id);
                    if (updated) setRecipient(updated);
                    setShowLinkModal(false);
                    setLinkTarget("");
                  }}
                  disabled={!linkTarget}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium
                             hover:bg-indigo-700 transition-colors disabled:bg-gray-300"
                >
                  Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Card History */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Card history</h2>
            <button
              onClick={() => router.push(`/cards/create/${recipient.id}`)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Create card
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-10 bg-white border border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-500 mb-4">
                No cards created for {recipient.name} yet.
              </p>
              <button
                onClick={() => router.push(`/cards/create/${recipient.id}`)}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium
                           hover:bg-indigo-700 transition-colors"
              >
                Create first card
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {cards
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((card) => {
                  const expanded = isCardExpanded(card.id);
                  const msgParts = card.message_text.split("\n\n");
                  const preview = msgParts[0] + (msgParts.length > 1 ? "…" : "");
                  return (
                    <div
                      key={card.id}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCardExpanded(card.id)}
                        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {card.occasion}
                          {card.tone_used && (
                            <span className="text-gray-400 font-normal ml-1">· {card.tone_used}</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(card.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-gray-400 text-sm flex-shrink-0">
                          {expanded ? "▲ Show less" : "▼ Show more"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="flex flex-col sm:flex-row sm:items-stretch border-t border-gray-100">
                          {(hydratedImages[card.id] || (card.image_url && !card.image_url.startsWith("idb:"))) && (
                            <div className="sm:w-36 flex-shrink-0 bg-gray-100">
                              <img
                                src={hydratedImages[card.id] || card.image_url!}
                                alt=""
                                className="w-full h-32 sm:h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 p-4">
                            <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                              {preview}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/cards/view/${card.id}`); }}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/cards/print/${card.id}`); }}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Reprint
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/cards/edit/${card.id}`); }}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setReuseCardId(card.id); setReuseTargetRecipientId(""); }}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Reuse for someone else
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Reuse card modal */}
        {reuseCardId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reuse this card</h3>
              <p className="text-sm text-gray-500 mb-4">
                Save a copy for another recipient. Same design and message.
              </p>
              <select
                value={reuseTargetRecipientId}
                onChange={(e) => setReuseTargetRecipientId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
              >
                <option value="">Choose recipient…</option>
                {allRecipients
                  .filter((r) => r.id !== recipient.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.relationship_type})</option>
                  ))}
              </select>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setReuseCardId(null); setReuseTargetRecipientId(""); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const card = getCards().find((c) => c.id === reuseCardId);
                    if (card && reuseTargetRecipientId) {
                      saveCard({
                        user_id: card.user_id,
                        recipient_id: reuseTargetRecipientId,
                        recipient_ids: [reuseTargetRecipientId],
                        occasion: card.occasion,
                        message_text: card.message_text,
                        image_url: card.image_url,
                        image_prompt: card.image_prompt,
                        inside_image_url: card.inside_image_url,
                        inside_image_prompt: card.inside_image_prompt,
                        front_text: card.front_text,
                        front_text_position: card.front_text_position,
                        tone_used: card.tone_used,
                        style: card.style,
                        delivery_method: card.delivery_method,
                        sent: false,
                        co_signed_with: card.co_signed_with,
                      });
                      setReuseCardId(null);
                      setReuseTargetRecipientId("");
                      refreshCards();
                    }
                  }}
                  disabled={!reuseTargetRecipientId}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save copy
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      {typeof value === "string" ? (
        <p className="text-sm text-gray-700">{value}</p>
      ) : (
        value
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getRecipients, saveRecipient, deleteRecipient, getCards, getCardsForRecipient, saveCard, deleteCard, getCardExpandedState, setCardExpanded, linkRecipients, unlinkRecipients, hydrateCardImages } from "@/lib/store";
import { getDisplayOccasion } from "@/lib/occasions";
import AppHeader from "@/components/AppHeader";
import ProfileEditor from "@/components/ProfileEditor";
import { getBirthdayForAge } from "@/lib/card-recipes";
import type { Recipient, ImportantDate, Card, PersonProfile } from "@/types/database";

interface RecipientFields {
  relationship_type: string;
  relationship_closeness: string;
  humor_tolerance: string;
  important_dates: ImportantDate[];
}

export default function RecipientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
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
  const [profileExpanded, setProfileExpanded] = useState(false);

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
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray mb-4">Person not found.</p>
        <button
          onClick={() => router.push("/")}
          className="font-medium" style={{ color: "var(--color-brand)" }}
        >
          Back to Home
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
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
      nickname: r.nickname ?? null,
      mailing_address: r.mailing_address ?? null,
      email: r.email ?? null,
      birthday: getBirthdayForAge(r.birthday, r.important_dates) || null,
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
      emotional_energy: (r as PersonProfile).emotional_energy ?? null,
      notes: r.notes || null,
    };
  }

  function initRecipientFields(r: Recipient): RecipientFields {
    return {
      relationship_type: r.relationship_type,
      relationship_closeness: r.relationship_closeness || "",
      humor_tolerance: r.humor_tolerance || "",
      important_dates: r.important_dates || [],
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
    if (hasDuplicateLabels) return;
    const nameForSave =
      (profileData.nickname as string)?.trim() ||
      [profileData.first_name, profileData.last_name].filter(Boolean).map(String).join(" ").trim() ||
      (profileData.display_name as string) ||
      recipient.name;
    const updated: Partial<Recipient> = {
      id: recipient.id,
      name: nameForSave || recipient.name,
      display_name: nameForSave || recipient.name,
      first_name: (profileData.first_name as string)?.trim() || null,
      last_name: (profileData.last_name as string)?.trim() || null,
      nickname: (profileData.nickname as string)?.trim() || null,
      mailing_address: (profileData.mailing_address as string)?.trim() || null,
      email: (profileData.email as string)?.trim() || null,
      relationship_type: recipientFields.relationship_type,
      relationship_closeness: recipientFields.relationship_closeness || null,
      personality_notes: (profileData.personality as string) || null,
      interests: toTags(profileData.interests),
      values: toTags(profileData.values),
      humor_style: profileData.humor_style || null,
      humor_tolerance: recipientFields.humor_tolerance,
      important_dates: recipientFields.important_dates,
      occupation: profileData.occupation || null,
      lifestyle: profileData.lifestyle || null,
      pets: profileData.pets || null,
      children: profileData.children || null,
      dislikes: profileData.dislikes || null,
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

  function isDuplicateLabel(dates: ImportantDate[], index: number): boolean {
    const label = (dates[index]?.label ?? "").trim().toLowerCase();
    if (!label || label === "other") return false;
    return dates.some(
      (d, j) => j !== index && (d.label ?? "").trim().toLowerCase() === label
    );
  }

  const hasDuplicateLabels =
    recipientFields?.important_dates?.some((_, i) => isDuplicateLabel(recipientFields.important_dates, i)) ?? false;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Home
        </button>
        <span className="font-medium text-charcoal text-sm">{recipient.name}</span>
        {editing ? (
          <>
            <span className="flex-1" />
            <button
              onClick={handleCancel}
              className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
              style={{ border: "1.5px solid var(--color-sage)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasDuplicateLabels}
              title={hasDuplicateLabels ? "Fix duplicate labels in Important dates" : undefined}
              className="btn-primary px-5 py-1.5 rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </>
        ) : (
          <>
            <span className="flex-1" />
            <button
              onClick={() => router.push(`/cards/create/${recipient.id}`)}
              className="btn-primary px-5 py-1.5 rounded-full text-sm"
            >
              Create card
            </button>
          </>
        )}
      </AppHeader>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="card-surface p-6">
          {!editing && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-charcoal">{recipient.name}</h1>
                <p className="text-warm-gray capitalize">
                  {recipient.relationship_type}
                  {recipient.relationship_closeness && (
                    <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-faint-gray text-warm-gray">
                      {recipient.relationship_closeness.replace(/_/g, " ")}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing(true); setProfileExpanded(true); }}
                  className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                  style={{ border: "1.5px solid var(--color-sage)" }}
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80"
                  style={{ color: "var(--color-error)", border: "1.5px solid var(--color-error)" }}
                >
                  Remove
                </button>
                <button
                  onClick={() => setProfileExpanded(!profileExpanded)}
                  className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                  style={{ border: "1.5px solid var(--color-sage)" }}
                >
                  {profileExpanded ? "Hide details" : "Show details"}
                </button>
              </div>
            </div>
          )}

          {/* Recipient-specific fields */}
          {editing ? (
            <div className="space-y-4 mb-6 pb-6 border-b" style={{ borderColor: "var(--color-light-gray)" }}>
              <Field label="Relationship">
                <input
                  value={recipientFields.relationship_type}
                  onChange={(e) => setRecipientFields({ ...recipientFields, relationship_type: e.target.value })}
                  className="w-full input-field rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Closeness">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "very_close", label: "Very close" },
                    { id: "close", label: "Close" },
                    { id: "friendly", label: "Friendly" },
                    { id: "acquaintance", label: "Acquaintance" },
                    { id: "distant", label: "Distant" },
                    { id: "complicated", label: "It's complicated" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRecipientFields({ ...recipientFields!, relationship_closeness: recipientFields!.relationship_closeness === opt.id ? "" : opt.id })}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        recipientFields!.relationship_closeness === opt.id
                          ? "bg-brand text-white"
                          : "bg-faint-gray text-charcoal hover:bg-light-gray"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Humor tolerance">
                <input
                  value={recipientFields.humor_tolerance}
                  onChange={(e) => setRecipientFields({ ...recipientFields, humor_tolerance: e.target.value })}
                  placeholder="e.g., Loves puns, Prefers heartfelt, Enjoys sarcasm"
                  className="w-full input-field rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Important dates" hint="Recurring = every year (e.g. birthday); one-time = single occurrence (e.g. graduation). Each label can only be used once except &quot;Other&quot;.">
                {hasDuplicateLabels && (
                  <p className="text-sm mb-2" style={{ color: "var(--color-error)" }}>
                    Each label can only be used once (except &quot;Other&quot;). Change or remove the duplicate.
                  </p>
                )}
                <div className="space-y-2">
                  {recipientFields.important_dates.map((d, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-start">
                      <div className="flex-1 min-w-[120px]">
                        <input
                          value={d.label}
                          onChange={(e) => updateDate(i, "label", e.target.value)}
                          placeholder="Label (e.g. Birthday)"
                          className={`w-full input-field rounded-lg px-3 py-2 ${isDuplicateLabel(recipientFields.important_dates, i) ? "border-red-400" : ""}`}
                          aria-invalid={isDuplicateLabel(recipientFields.important_dates, i)}
                        />
                        {isDuplicateLabel(recipientFields.important_dates, i) && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-error)" }}>
                            This label is already used
                          </p>
                        )}
                      </div>
                      <input
                        value={d.date}
                        onChange={(e) => updateDate(i, "date", e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-36 input-field rounded-lg px-3 py-2"
                      />
                      <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={d.recurring}
                          onChange={() => updateDate(i, "recurring", !d.recurring)}
                          className="rounded border-light-gray"
                        />
                        <span className="text-sm text-charcoal">Yearly</span>
                      </label>
                      <button
                        onClick={() => removeDate(i)}
                        className="text-sm px-1 hover:opacity-80"
                        style={{ color: "var(--color-error)" }}
                        aria-label="Remove date"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addDate}
                    className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors hover:opacity-80"
                    style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                  >
                    + Add date
                  </button>
                </div>
              </Field>
            </div>
          ) : profileExpanded ? (
            <div className="space-y-4 mb-6 pb-6 border-b" style={{ borderColor: "var(--color-light-gray)" }}>
              <DetailRow label="Closeness" value={recipient.relationship_closeness ? recipient.relationship_closeness.replace(/_/g, " ") : null} />
              <DetailRow label="Humor tolerance" value={recipient.humor_tolerance} />
              <DetailRow
                label="Important dates"
                value={
                  recipient.important_dates && recipient.important_dates.length > 0 ? (
                    <div className="space-y-1">
                      {recipient.important_dates.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <p className="text-sm text-charcoal">
                            {d.label}: {d.date}
                            {d.recurring && (
                              <span className="text-warm-gray ml-1">(yearly)</span>
                            )}
                          </p>
                          <button
                            onClick={() => router.push(`/cards/create/${recipient.id}?occasion=${encodeURIComponent(d.label)}`)}
                            className="text-xs whitespace-nowrap px-3 py-1 rounded-full transition-colors"
                            style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                          >
                            Create card
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null
                }
              />
            </div>
          ) : null}

          {/* Shared profile fields */}
          {(editing || profileExpanded) && (
            <ProfileEditor
              profile={profileData}
              editing={editing}
              onChange={setProfileData}
              excludeFields={["display_name", "humor_style", "communication_style", "emotional_energy"]}
            />
          )}
        </div>

        {/* Linked People */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-charcoal">Linked people</h2>
            <button
              onClick={() => setShowLinkModal(true)}
              className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors hover:opacity-80"
              style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
            >
              + Link someone
            </button>
          </div>

          {(!recipient.links || recipient.links.length === 0) ? (
            <p className="text-sm text-warm-gray mb-2">
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
                    className="flex items-center justify-between card-surface px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm font-medium cursor-pointer" style={{ color: "var(--color-brand)" }}
                        onClick={() => router.push(`/recipients/${linked.id}`)}
                      >
                        {linked.name}
                      </span>
                      <span className="text-xs text-warm-gray capitalize">{link.label}</span>
                    </div>
                    <button
                      onClick={() => {
                        unlinkRecipients(recipient.id, linked.id);
                        const refreshed = getRecipients();
                        setAllRecipients(refreshed);
                        const updated = refreshed.find((r) => r.id === id);
                        if (updated) setRecipient(updated);
                      }}
                      className="text-xs px-3 py-1 rounded-full transition-colors hover:opacity-80"
                      style={{ color: "var(--color-error)", border: "1.5px solid var(--color-error)" }}
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
            <div className="card-surface rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-charcoal mb-4">
                Link {recipient.name} to someone
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Person
                  </label>
                  <select
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                    className="w-full input-field rounded-lg px-3 py-2 text-sm"
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
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    {recipient.name}&apos;s relationship to them
                  </label>
                  <select
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full input-field rounded-lg px-3 py-2 text-sm"
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
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Their relationship to {recipient.name}
                  </label>
                  <select
                    value={linkReverseLabel}
                    onChange={(e) => setLinkReverseLabel(e.target.value)}
                    className="w-full input-field rounded-lg px-3 py-2 text-sm"
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
                  className="flex-1 text-sm text-warm-gray hover:text-charcoal py-2"
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
                  className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50"
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
            <h2 className="text-lg font-semibold text-charcoal">Card history</h2>
            <button
              onClick={() => router.push(`/cards/create/${recipient.id}`)}
              className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors hover:opacity-80"
              style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
            >
              + Create card
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ background: "var(--color-faint-gray)", border: "1px dashed var(--color-light-gray)" }}>
              <p className="text-warm-gray mb-4">
                No cards created for {recipient.name} yet.
              </p>
              <button
                onClick={() => router.push(`/cards/create/${recipient.id}`)}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium"
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
                      className="card-surface overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCardExpanded(card.id)}
                        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-faint-gray transition-colors"
                      >
                        <span className="text-sm font-medium text-charcoal">
                          {getDisplayOccasion(card)}
                          {card.tone_used && (
                            <span className="text-warm-gray font-normal ml-1">· {card.tone_used}</span>
                          )}
                        </span>
                        <span className="text-xs text-warm-gray">
                          {new Date(card.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-warm-gray text-sm flex-shrink-0">
                          {expanded ? "▲ Show less" : "▼ Show more"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="flex flex-col sm:flex-row sm:items-stretch border-t">
                          {(hydratedImages[card.id] || (card.image_url && !card.image_url.startsWith("idb:"))) && (
                            <div className="sm:w-36 flex-shrink-0 bg-faint-gray">
                              <img
                                src={hydratedImages[card.id] || card.image_url!}
                                alt=""
                                className="w-full h-32 sm:h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 p-4">
                            <p className="text-sm text-charcoal line-clamp-2 mb-3">
                              {preview}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/cards/view/${card.id}`); }}
                                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                              >
                                E-card
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/cards/print/${card.id}`); }}
                                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                              >
                                Preview
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/cards/edit/${card.id}`); }}
                                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setReuseCardId(card.id); setReuseTargetRecipientId(""); }}
                                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                              >
                                Use Again
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Delete this card? This can't be undone.")) {
                                    deleteCard(card.id);
                                    setCards((prev) => prev.filter((c) => c.id !== card.id));
                                  }
                                }}
                                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                                style={{ color: "var(--color-error)", border: "1.5px solid var(--color-error)" }}
                              >
                                Delete
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

        {/* Use Again modal */}
        {reuseCardId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="card-surface rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-charcoal mb-2">Use this image again</h3>
              <p className="text-sm text-warm-gray mb-4">
                Same artwork, fresh message for a new recipient.
              </p>
              <select
                value={reuseTargetRecipientId}
                onChange={(e) => setReuseTargetRecipientId(e.target.value)}
                className="w-full input-field rounded-lg px-3 py-2 text-sm mb-4"
              >
                <option value="">Choose recipient…</option>
                {allRecipients
                  .filter((r) => r.id !== recipient.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.relationship_type})</option>
                  ))}
                <option value="__quick__">Someone not in my circle</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setReuseCardId(null); setReuseTargetRecipientId(""); }}
                  className="px-4 py-2 text-sm text-warm-gray hover:text-charcoal"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (reuseTargetRecipientId === "__quick__") {
                      router.push(`/cards/create/quick?reuseCardId=${reuseCardId}`);
                    } else {
                      router.push(`/cards/create/${reuseTargetRecipientId}?reuseCardId=${reuseCardId}`);
                    }
                  }}
                  disabled={!reuseTargetRecipientId}
                  className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Continue
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
      <label className="block text-sm font-medium text-charcoal mb-1">
        {label}
        {hint && <span className="text-warm-gray font-normal ml-1">({hint})</span>}
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
      <p className="section-label mb-1">
        {label}
      </p>
      {typeof value === "string" ? (
        <p className="text-sm text-charcoal">{value}</p>
      ) : (
        value
      )}
    </div>
  );
}

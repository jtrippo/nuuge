import type { UserProfile, Recipient, Card, ConversationMessage } from "@/types/database";

/**
 * Local storage-based state management for MVP.
 * Will migrate to Supabase once auth is wired up.
 */
const KEYS = {
  USER_PROFILE: "nuuge_user_profile",
  RECIPIENTS: "nuuge_recipients",
  ONBOARDING_HISTORY: "nuuge_onboarding_history",
  CARDS: "nuuge_cards",
  CARD_EXPANDED_PREFIX: "nuuge_card_expanded_",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getUserProfile(): Partial<UserProfile> | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(KEYS.USER_PROFILE);
  return raw ? JSON.parse(raw) : null;
}

export function saveUserProfile(profile: Partial<UserProfile>) {
  if (!isBrowser()) return;
  const existing = getUserProfile() || {};
  const merged = { ...existing, ...profile, updated_at: new Date().toISOString() };
  localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(merged));
}

export function getRecipients(): Recipient[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(KEYS.RECIPIENTS);
  return raw ? JSON.parse(raw) : [];
}

export function saveRecipient(recipient: Partial<Recipient>) {
  if (!isBrowser()) return;
  const existing = getRecipients();
  const withId = {
    ...recipient,
    id: recipient.id || crypto.randomUUID(),
    created_at: recipient.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const idx = existing.findIndex((r) => r.id === withId.id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...withId } as Recipient;
  } else {
    existing.push(withId as Recipient);
  }
  localStorage.setItem(KEYS.RECIPIENTS, JSON.stringify(existing));
  return withId;
}

export function deleteRecipient(id: string) {
  if (!isBrowser()) return;
  const existing = getRecipients();
  const filtered = existing.filter((r) => r.id !== id);
  localStorage.setItem(KEYS.RECIPIENTS, JSON.stringify(filtered));
}

export function getCards(): Card[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(KEYS.CARDS);
  return raw ? JSON.parse(raw) : [];
}

export function getCardsForRecipient(recipientId: string): Card[] {
  return getCards().filter(
    (c) =>
      c.recipient_id === recipientId ||
      (c.recipient_ids && c.recipient_ids.includes(recipientId))
  );
}

/** Per-recipient: which cards are expanded in the profile. Persisted so it survives navigation. */
export function getCardExpandedState(recipientId: string): Record<string, boolean> {
  if (!isBrowser()) return {};
  const raw = localStorage.getItem(KEYS.CARD_EXPANDED_PREFIX + recipientId);
  return raw ? JSON.parse(raw) : {};
}

export function setCardExpanded(
  recipientId: string,
  cardId: string,
  expanded: boolean
): void {
  if (!isBrowser()) return;
  const state = getCardExpandedState(recipientId);
  state[cardId] = expanded;
  localStorage.setItem(
    KEYS.CARD_EXPANDED_PREFIX + recipientId,
    JSON.stringify(state)
  );
}

export function saveCard(card: Partial<Card>) {
  if (!isBrowser()) return;
  const existing = getCards();
  const id = card.id || crypto.randomUUID();
  const full = {
    ...card,
    id,
    recipient_ids: card.recipient_ids || [card.recipient_id || ""],
    created_at: card.created_at || new Date().toISOString(),
  };
  const idx = existing.findIndex((c) => c.id === id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...full } as Card;
  } else {
    existing.push(full as Card);
  }
  localStorage.setItem(KEYS.CARDS, JSON.stringify(existing));
  return full as Card;
}

export function updateCard(cardId: string, updates: Partial<Card>) {
  if (!isBrowser()) return null;
  const existing = getCards();
  const idx = existing.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  const updated = { ...existing[idx], ...updates } as Card;
  existing[idx] = updated;
  localStorage.setItem(KEYS.CARDS, JSON.stringify(existing));
  return updated;
}

export function getCardById(cardId: string): Card | null {
  return getCards().find((c) => c.id === cardId) ?? null;
}

export function linkRecipients(
  id1: string,
  label1: string,
  id2: string,
  label2: string
) {
  if (!isBrowser()) return;
  const all = getRecipients();
  const r1 = all.find((r) => r.id === id1);
  const r2 = all.find((r) => r.id === id2);
  if (!r1 || !r2) return;

  const links1 = r1.links || [];
  if (!links1.some((l) => l.recipient_id === id2)) {
    links1.push({ recipient_id: id2, label: label1 });
  }
  saveRecipient({ ...r1, links: links1 });

  const links2 = r2.links || [];
  if (!links2.some((l) => l.recipient_id === id1)) {
    links2.push({ recipient_id: id1, label: label2 });
  }
  saveRecipient({ ...r2, links: links2 });
}

export function unlinkRecipients(id1: string, id2: string) {
  if (!isBrowser()) return;
  const all = getRecipients();
  const r1 = all.find((r) => r.id === id1);
  const r2 = all.find((r) => r.id === id2);

  if (r1) {
    saveRecipient({
      ...r1,
      links: (r1.links || []).filter((l) => l.recipient_id !== id2),
    });
  }
  if (r2) {
    saveRecipient({
      ...r2,
      links: (r2.links || []).filter((l) => l.recipient_id !== id1),
    });
  }
}

export function getOnboardingHistory(): ConversationMessage[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(KEYS.ONBOARDING_HISTORY);
  return raw ? JSON.parse(raw) : [];
}

export function saveOnboardingHistory(messages: ConversationMessage[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.ONBOARDING_HISTORY, JSON.stringify(messages));
}

export function clearOnboardingHistory() {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.ONBOARDING_HISTORY);
}

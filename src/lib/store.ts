import type { UserProfile, Recipient, Card, ConversationMessage } from "@/types/database";
import { NEWS_RECIPIENT_ID } from "@/types/database";
import { saveImage, getImage, getAllImages, isLargeDataUrl } from "./image-store";
import { getAllUsage, putUsageEvent, type UsageEvent } from "./usage-store";

/**
 * Local storage-based state management for MVP.
 * Will migrate to Supabase once auth is wired up.
 * Large images are stored in IndexedDB to avoid localStorage quota limits.
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
  if (!raw) return null;
  const profile = JSON.parse(raw) as Partial<UserProfile>;
  if (profile.partner_recipient_id && (!profile.household_links || profile.household_links.length === 0)) {
    profile.household_links = [{ recipient_id: profile.partner_recipient_id, label: "Spouse" }];
    localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify({ ...profile, updated_at: new Date().toISOString() }));
  }
  return profile;
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
  if (!raw) return [];
  const list: Recipient[] = JSON.parse(raw);
  let migrated = false;
  for (const r of list) {
    if (r.birthday?.trim()) {
      const dates = r.important_dates || [];
      const hasEntry = dates.some((d) => (d.label ?? "").toLowerCase().trim() === "birthday");
      if (!hasEntry) {
        dates.push({ label: "Birthday", date: r.birthday.trim(), recurring: true });
        r.important_dates = dates;
      }
      r.birthday = null;
      migrated = true;
    }
  }
  if (migrated) {
    localStorage.setItem(KEYS.RECIPIENTS, JSON.stringify(list));
  }
  return list;
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

/** Cards created via "Share a moment" (sender-centric, no specific recipient). */
export function getSharedMomentCards(): Card[] {
  return getCards().filter((c) => (c as Card & { card_type?: string }).card_type === "news");
}

/** Cards created for people beyond the circle (quick profile, no persistent Recipient). */
export function getBeyondCircleCards(): Card[] {
  return getCards().filter((c) => (c as Card & { card_type?: string }).card_type === "beyond");
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

export async function saveCard(card: Partial<Card>) {
  if (!isBrowser()) return;
  const existing = getCards();
  const id = card.id || crypto.randomUUID();
  const isNews = (card as Card & { card_type?: string }).card_type === "news";
  const isBeyond = (card as Card & { card_type?: string }).card_type === "beyond";
  const recipientId = isNews ? NEWS_RECIPIENT_ID : (card.recipient_id || "");
  const recipientIds = (isNews || isBeyond) ? [] : (card.recipient_ids || [recipientId].filter(Boolean));
  const full = {
    ...card,
    id,
    recipient_id: recipientId,
    recipient_ids: recipientIds,
    created_at: card.created_at || new Date().toISOString(),
  };

  const imageFields: (keyof Pick<Card, "image_url" | "inside_image_url">)[] = [
    "image_url",
    "inside_image_url",
  ];
  const toStore = { ...full } as Record<string, unknown>;
  const imageSaves: Promise<void>[] = [];

  for (const field of imageFields) {
    const val = toStore[field] as string | null | undefined;
    if (isLargeDataUrl(val)) {
      const imgKey = `card_${id}_${field}`;
      imageSaves.push(
        saveImage(imgKey, val!).catch((err) =>
          console.error(`Failed to save ${field} to IndexedDB:`, err)
        )
      );
      toStore[field] = `idb:${imgKey}`;
    }
  }

  await Promise.all(imageSaves);

  const idx = existing.findIndex((c) => c.id === id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...toStore } as Card;
  } else {
    existing.push(toStore as unknown as Card);
  }
  localStorage.setItem(KEYS.CARDS, JSON.stringify(existing));
  return full as Card;
}

export function updateCard(cardId: string, updates: Partial<Card>) {
  if (!isBrowser()) return null;
  const existing = getCards();
  const idx = existing.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;

  const toStore = { ...updates } as Record<string, unknown>;
  const imageFields: (keyof Pick<Card, "image_url" | "inside_image_url">)[] = [
    "image_url",
    "inside_image_url",
  ];
  for (const field of imageFields) {
    const val = toStore[field] as string | null | undefined;
    if (isLargeDataUrl(val)) {
      const imgKey = `card_${cardId}_${field}`;
      saveImage(imgKey, val!).catch((err) =>
        console.error(`Failed to save ${field} to IndexedDB:`, err)
      );
      toStore[field] = `idb:${imgKey}`;
    }
  }

  const updated = { ...existing[idx], ...toStore } as Card;
  existing[idx] = updated;
  localStorage.setItem(KEYS.CARDS, JSON.stringify(existing));
  return updated;
}

export function deleteCard(cardId: string): boolean {
  if (!isBrowser()) return false;
  const existing = getCards();
  const filtered = existing.filter((c) => c.id !== cardId);
  if (filtered.length === existing.length) return false;
  localStorage.setItem(KEYS.CARDS, JSON.stringify(filtered));
  return true;
}

export function getCardById(cardId: string): Card | null {
  return getCards().find((c) => c.id === cardId) ?? null;
}

/** Load any IndexedDB-stored images back into a card object. */
export async function hydrateCardImages(card: Card): Promise<Card> {
  const hydrated = { ...card };
  const fields: (keyof Pick<Card, "image_url" | "inside_image_url">)[] = [
    "image_url",
    "inside_image_url",
  ];
  for (const field of fields) {
    const val = hydrated[field];
    if (typeof val === "string" && val.startsWith("idb:")) {
      const imgKey = val.slice(4);
      const data = await getImage(imgKey);
      if (data) {
        (hydrated as Record<string, unknown>)[field] = data;
      }
    }
  }
  return hydrated;
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

export function addHouseholdLink(recipientId: string, label: string) {
  if (!isBrowser()) return;
  const profile = getUserProfile() || {};
  const links = profile.household_links || [];
  if (links.some((l) => l.recipient_id === recipientId)) return;
  links.push({ recipient_id: recipientId, label });
  saveUserProfile({ household_links: links });
}

export function removeHouseholdLink(recipientId: string) {
  if (!isBrowser()) return;
  const profile = getUserProfile() || {};
  const links = (profile.household_links || []).filter((l) => l.recipient_id !== recipientId);
  saveUserProfile({ household_links: links });
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

// ─── Export / Import ────────────────────────────────────────────────

const DRAFT_KEY_PREFIX = "nuuge_card_draft_";

export interface NuugeBackup {
  version: 1;
  exportedAt: string;
  profile: Partial<UserProfile> | null;
  recipients: Recipient[];
  cards: Card[];
  onboardingHistory: ConversationMessage[];
  images: Record<string, string>;
  usageEvents?: UsageEvent[];
  drafts?: Record<string, string>;
}

export async function exportAllData(): Promise<NuugeBackup> {
  const images = await getAllImages();
  const usageEvents = await getAllUsage();

  const drafts: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_KEY_PREFIX)) {
      const val = localStorage.getItem(key);
      if (val) drafts[key] = val;
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: getUserProfile(),
    recipients: getRecipients(),
    cards: getCards(),
    onboardingHistory: getOnboardingHistory(),
    images,
    usageEvents,
    drafts,
  };
}

export async function importAllData(backup: NuugeBackup): Promise<void> {
  if (backup.profile) {
    localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(backup.profile));
  }
  if (backup.recipients) {
    localStorage.setItem(KEYS.RECIPIENTS, JSON.stringify(backup.recipients));
  }
  if (backup.cards) {
    localStorage.setItem(KEYS.CARDS, JSON.stringify(backup.cards));
  }
  if (backup.onboardingHistory) {
    localStorage.setItem(
      KEYS.ONBOARDING_HISTORY,
      JSON.stringify(backup.onboardingHistory)
    );
  }
  if (backup.images) {
    for (const [key, value] of Object.entries(backup.images)) {
      await saveImage(key, value);
    }
  }
  if (backup.usageEvents) {
    for (const event of backup.usageEvents) {
      await putUsageEvent(event);
    }
  }
  if (backup.drafts) {
    for (const [key, value] of Object.entries(backup.drafts)) {
      localStorage.setItem(key, value);
    }
  }
}

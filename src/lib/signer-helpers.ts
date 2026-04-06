import type { Card, Recipient, UserProfile } from "@/types/database";
import { NEWS_RECIPIENT_ID } from "@/types/database";

export const USER_KEY = "__user__" as const;
export const MAX_SIGNERS = 6;

/**
 * Format a list of names for sign-off: "Jeff & Linda" or "Jeff, Linda, & Kelsey"
 * Oxford comma before the ampersand. Single line.
 */
export function formatSignerNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return `${rest}, & ${last}`;
}

/**
 * Format signer names with line breaks for envelope display.
 * Rules: 2=1 row, 3=2 rows, 4=2 rows, 5=3 rows, 6=3 rows.
 * Returns string with \n for line breaks.
 */
export function formatSignerNamesForEnvelope(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}\n& ${names[2]}`;
  if (names.length === 4) return `${names[0]}, ${names[1]}\n${names[2]}, & ${names[3]}`;
  if (names.length === 5) return `${names[0]}, ${names[1]}\n${names[2]}, ${names[3]}\n& ${names[4]}`;
  if (names.length === 6) return `${names[0]}, ${names[1]}\n${names[2]}, ${names[3]}\n${names[4]}, & ${names[5]}`;
  // Fallback for >6: single line with normal formatting
  return formatSignerNames(names);
}

/**
 * Default display name for a recipient (nickname → first_name → display_name → name).
 */
export function getDefaultDisplayName(r: Recipient | null): string {
  if (!r) return "";
  return r.nickname || r.first_name || r.display_name || r.name || "";
}

/**
 * Default display name for the user (nickname → first_name → display_name).
 */
export function getDefaultUserDisplayName(profile: Partial<UserProfile> | null): string {
  if (!profile) return "";
  return profile.nickname || profile.first_name || profile.display_name || "";
}

/**
 * Recipient display name for envelope center.
 * Uses recipient_display_name override if set; else nickname → first_name → display_name → name.
 * For news/shared-moment cards (no recipient), returns "To someone special".
 */
export function getRecipientDisplayName(card: Card, recipient: Recipient | null): string {
  const override = (card as { recipient_display_name?: string | null }).recipient_display_name?.trim();
  if (override) return override;
  const isNews = (card as { card_type?: string }).card_type === "news" || card.recipient_id === NEWS_RECIPIENT_ID;
  if (isNews || !recipient) return "To someone special";
  return getDefaultDisplayName(recipient);
}

/**
 * Get the formatted sender string for a card, for envelope and share.
 * Uses signer_group_name if set; else signer_display_overrides + signer_recipient_ids (or co_signed_with legacy).
 * Returns string with \n for envelope line breaks when 3+ names.
 * For news cards, recipient may be null (only user signs).
 */
export function getSenderNames(
  card: Card,
  recipient: Recipient | null,
  allRecipients: Recipient[],
  userProfile: Partial<UserProfile> | null
): string {
  const overrides = (card as { signer_display_overrides?: Record<string, string> }).signer_display_overrides;
  const groupName = (card as { signer_group_name?: string | null }).signer_group_name?.trim();

  if (groupName) return groupName;

  const defaultUser = getDefaultUserDisplayName(userProfile);
  const userName = overrides?.[USER_KEY]?.trim() || defaultUser;
  if (!userName) return "";

  const names: string[] = [userName];

  const signerIds = (card as { signer_recipient_ids?: string[] }).signer_recipient_ids;
  if (signerIds?.length) {
    for (const id of signerIds) {
      const r = allRecipients.find((rec) => rec.id === id);
      const defaultName = getDefaultDisplayName(r ?? null);
      const name = overrides?.[id]?.trim() || defaultName;
      if (name && !names.includes(name)) names.push(name);
    }
  }

  if (names.length === 1) {
    const coSigned = card.co_signed_with?.trim();
    if (coSigned) {
      let resolvedCoName = coSigned;
      if (overrides && userProfile) {
        const houseLinks = (userProfile as { household_links?: { recipient_id: string }[] }).household_links || [];
        for (const link of houseLinks) {
          const r = allRecipients.find((rec) => rec.id === link.recipient_id);
          const fn = (r?.first_name || r?.display_name || r?.name || "").toLowerCase();
          if (fn && (fn === coSigned.toLowerCase() || fn.startsWith(coSigned.toLowerCase()) || coSigned.toLowerCase().startsWith(fn))) {
            if (overrides[link.recipient_id]?.trim()) {
              resolvedCoName = overrides[link.recipient_id].trim();
            }
            break;
          }
        }
      }
      if (!names.includes(resolvedCoName)) names.push(resolvedCoName);
    }
  }

  if (overrides) {
    const customKeys = Object.keys(overrides).filter((k) => k.startsWith("__custom_")).sort();
    for (const key of customKeys) {
      const name = overrides[key]?.trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }

  if (names.length > 1) return formatSignerNamesForEnvelope(names);
  return userName;
}

/**
 * Get signer names as array for pre-filling the closing line.
 * Uses overrides when present. Does not apply group name (closing uses individual names).
 * For news cards, recipient may be null.
 */
export function getSignerNameList(
  card: Card,
  recipient: Recipient | null,
  allRecipients: Recipient[],
  userProfile: Partial<UserProfile> | null
): string[] {
  const groupName = (card as { signer_group_name?: string | null }).signer_group_name?.trim();
  if (groupName) return [groupName];

  const overrides = (card as { signer_display_overrides?: Record<string, string> }).signer_display_overrides;
  const defaultUser = getDefaultUserDisplayName(userProfile);
  const userName = overrides?.[USER_KEY]?.trim() || defaultUser;
  if (!userName) return [];

  const names: string[] = [userName];

  const signerIds = (card as { signer_recipient_ids?: string[] }).signer_recipient_ids;
  if (signerIds?.length) {
    for (const id of signerIds) {
      const r = allRecipients.find((rec) => rec.id === id);
      const defaultName = getDefaultDisplayName(r ?? null);
      const name = overrides?.[id]?.trim() || defaultName;
      if (name && !names.includes(name)) names.push(name);
    }
  }

  if (names.length === 1) {
    const coSigned = card.co_signed_with?.trim();
    if (coSigned && !names.includes(coSigned)) names.push(coSigned);
  }

  if (overrides) {
    const customKeys = Object.keys(overrides).filter((k) => k.startsWith("__custom_")).sort();
    for (const key of customKeys) {
      const name = overrides[key]?.trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }

  return names;
}

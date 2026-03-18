import type { Card, Recipient, UserProfile } from "@/types/database";

/**
 * Format a list of names for envelope/sign-off: "Jeff & Linda" or "Jeff, Linda, & Kelsey"
 * Oxford comma before the ampersand.
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
 * Get the formatted sender string for a card, for envelope and share.
 * Uses signer_recipient_ids (new) or co_signed_with (legacy).
 */
export function getSenderNames(
  card: Card,
  recipient: Recipient,
  allRecipients: Recipient[],
  userProfile: Partial<UserProfile> | null
): string {
  const userName = userProfile?.nickname || userProfile?.first_name || userProfile?.display_name || "";
  if (!userName) return "";

  const names: string[] = [userName];

  // New: signer_recipient_ids (linked people)
  const signerIds = (card as { signer_recipient_ids?: string[] }).signer_recipient_ids;
  if (signerIds?.length) {
    for (const id of signerIds) {
      const r = allRecipients.find((rec) => rec.id === id);
      const name = r?.nickname || r?.first_name || r?.display_name || r?.name || "";
      if (name && !names.includes(name)) names.push(name);
    }
    return formatSignerNames(names);
  }

  // Legacy: co_signed_with (single partner name)
  const coSigned = card.co_signed_with?.trim();
  if (coSigned && !names.includes(coSigned)) {
    names.push(coSigned);
    return formatSignerNames(names);
  }

  return userName;
}

/**
 * Get signer names for pre-filling the closing line.
 * Same logic as getSenderNames, returns array for flexibility.
 */
export function getSignerNameList(
  card: Card,
  recipient: Recipient,
  allRecipients: Recipient[],
  userProfile: Partial<UserProfile> | null
): string[] {
  const userName = userProfile?.nickname || userProfile?.first_name || userProfile?.display_name || "";
  if (!userName) return [];

  const names: string[] = [userName];

  const signerIds = (card as { signer_recipient_ids?: string[] }).signer_recipient_ids;
  if (signerIds?.length) {
    for (const id of signerIds) {
      const r = allRecipients.find((rec) => rec.id === id);
      const name = r?.nickname || r?.first_name || r?.display_name || r?.name || "";
      if (name && !names.includes(name)) names.push(name);
    }
    return names;
  }

  const coSigned = card.co_signed_with?.trim();
  if (coSigned && !names.includes(coSigned)) names.push(coSigned);

  return names;
}

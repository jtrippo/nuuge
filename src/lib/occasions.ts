/**
 * Categorized occasions for card creation.
 * Used by create flow, edit flow, and display (envelope, print, history).
 */

export const OCCASION_CATEGORIES: { label: string; occasions: string[] }[] = [
  {
    label: "Celebrations",
    occasions: ["Birthday", "Anniversary", "Wedding", "Graduation", "New Baby", "Retirement", "Congratulations"],
  },
  {
    label: "Support & Care",
    occasions: ["Sympathy", "Get Well", "Encouragement"],
  },
  {
    label: "Reconnect",
    occasions: ["Apology", "Thinking of You"],
  },
  {
    label: "Everyday",
    occasions: ["Thank You", "Just Because"],
  },
  {
    label: "Seasonal",
    occasions: ["Holiday"],
  },
  {
    label: "Custom",
    occasions: ["Other Occasion"],
  },
];

/** Flat list of all preset labels (including "Other Occasion" for UI). Used for matching URL presets and validation. */
export const ALL_OCCASIONS: string[] = OCCASION_CATEGORIES.flatMap((c) => c.occasions);

/** Canonical value stored when user picks "Other Occasion" and enters custom text. */
export const OTHER_OCCASION_LABEL = "Other Occasion";

/** Stored occasion value when user selects "Other Occasion". */
export const OTHER_OCCASION_VALUE = "Other";

/** Occasions that can be saved to multiple linked recipients (e.g. both parents sign). */
export const SHARED_OCCASIONS = ["Anniversary", "Holiday", "Wedding"];

/** Display label for a card's occasion (custom text when set, otherwise preset label). */
export function getDisplayOccasion(card: { occasion: string; occasion_custom?: string | null }): string {
  if (card.occasion_custom?.trim()) return card.occasion_custom.trim();
  return card.occasion || "";
}

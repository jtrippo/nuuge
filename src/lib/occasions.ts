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

/** Default occasion tagline for baked-in front text (editable by user). */
export const OCCASION_TAGLINES: Record<string, string> = {
  Birthday: "Happy Birthday!",
  Anniversary: "Happy Anniversary!",
  Wedding: "Congratulations!",
  Graduation: "Congratulations, Graduate!",
  "New Baby": "Welcome to the World!",
  Retirement: "Happy Retirement!",
  Congratulations: "Congratulations!",
  "Thank You": "Thank You!",
  "Get Well": "Get Well Soon!",
  Sympathy: "With Deepest Sympathy",
  Encouragement: "You've Got This!",
  Apology: "I'm Sorry",
  "Thinking of You": "Thinking of You",
  "Just Because": "Just Because",
  Holiday: "Happy Holidays!",
  "Valentine's Day": "Happy Valentine's Day!",
  "Mother's Day": "Happy Mother's Day!",
  "Father's Day": "Happy Father's Day!",
};

/** Display label for a card's occasion (custom text when set, otherwise preset label). */
export function getDisplayOccasion(card: { occasion: string; occasion_custom?: string | null }): string {
  if (card.occasion_custom?.trim()) return card.occasion_custom.trim();
  return card.occasion || "";
}

// ── Age band inference ──

export type AgeBand = "child" | "teen" | "young_adult" | "adult" | "senior";

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  child: "Child (under 13)",
  teen: "Teen (13-18)",
  young_adult: "Young adult (19-30)",
  adult: "Adult (31-55)",
  senior: "Senior (55+)",
};

export const AGE_BAND_MIDPOINTS: Record<AgeBand, number> = {
  child: 8,
  teen: 15,
  young_adult: 24,
  adult: 43,
  senior: 67,
};

export function ageBandFromAge(age: number): AgeBand {
  if (age < 13) return "child";
  if (age < 19) return "teen";
  if (age < 31) return "young_adult";
  if (age < 56) return "adult";
  return "senior";
}

/**
 * Infer approximate age band from the sender's age and the relationship type.
 * Returns null when the relationship is ambiguous (friend, colleague, etc.).
 */
export function inferAgeBand(senderAge: number | null, relationship: string): AgeBand | null {
  if (!senderAge) return null;
  const rel = relationship.toLowerCase();

  if (/daughter|son(?!.*in-law)|child|kid/i.test(rel)) {
    const est = senderAge - 25;
    return est > 0 ? ageBandFromAge(est) : null;
  }
  if (/grandchild|granddaughter|grandson/i.test(rel)) {
    const est = senderAge - 50;
    return est > 0 ? ageBandFromAge(est) : null;
  }
  if (/parent|mother|father|mom(?!.*in)|dad(?!.*in)/i.test(rel)) {
    return ageBandFromAge(senderAge + 27);
  }
  if (/grandmother|grandfather|grandma|grandpa/i.test(rel)) {
    return ageBandFromAge(senderAge + 50);
  }
  if (/brother|sister|sibling|twin/i.test(rel)) {
    return ageBandFromAge(senderAge);
  }
  if (/niece|nephew/i.test(rel)) {
    const est = Math.max(1, senderAge - 18);
    return ageBandFromAge(est);
  }
  if (/aunt|uncle/i.test(rel)) {
    return ageBandFromAge(senderAge + 15);
  }
  if (/godchild|goddaughter|godson/i.test(rel)) {
    const est = Math.max(1, senderAge - 25);
    return ageBandFromAge(est);
  }
  if (/spouse|wife|husband|partner|boyfriend|girlfriend|fiancé|fiancée/i.test(rel)) {
    return ageBandFromAge(senderAge);
  }
  return null;
}

// ── Couple inference ──

export function inferIsCouple(
  recipient: { links?: { recipient_id: string; label: string }[]; interests?: string[] } | null
): boolean {
  if (!recipient) return false;
  const hasSpouseLink = (recipient.links || []).some(
    (l) => /spouse|wife|husband|partner/i.test(l.label)
  );
  if (hasSpouseLink) return true;
  const hasMarriedInterest = (recipient.interests || []).some(
    (i) => /married|engaged/i.test(i)
  );
  return hasMarriedInterest;
}

// ── Per-occasion minimum viable context ──

export type OccasionExtra = "anniversary_years" | "graduation_level" | "couple_names";

export const OCCASION_EXTRAS: Record<string, OccasionExtra[]> = {
  Anniversary: ["anniversary_years", "couple_names"],
  Wedding: ["couple_names"],
  "New Baby": ["couple_names"],
  Graduation: ["graduation_level"],
};

export const AGE_CRITICAL_OCCASIONS = ["Birthday", "Graduation", "Retirement"];

export const COUPLE_CRITICAL_OCCASIONS = ["Wedding", "Anniversary", "New Baby"];

export const GRADUATION_LEVELS = [
  "Preschool / Kindergarten",
  "Elementary school",
  "Middle school",
  "High school",
  "College / University",
  "Graduate school",
] as const;

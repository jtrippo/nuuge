/**
 * Categories for "Share a moment" (sender-centric) cards.
 * Used in the share creation flow instead of recipient occasions.
 */

export interface NewsCategory {
  id: string;
  label: string;
  group: string;
}

export interface NewsCategoryGroup {
  label: string;
  categories: NewsCategory[];
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  // Celebrations
  { id: "new_baby", label: "New baby / adoption", group: "celebrations" },
  { id: "engagement", label: "Engagement", group: "celebrations" },
  { id: "wedding", label: "Wedding (save the date / we got married)", group: "celebrations" },
  { id: "graduation", label: "Graduation (self or child)", group: "celebrations" },
  { id: "new_home", label: "New home / big move", group: "celebrations" },
  { id: "promotion", label: "Promotion / new job", group: "celebrations" },
  { id: "retirement", label: "Retirement", group: "celebrations" },
  // Life's harder moments
  { id: "loss_pet", label: "Loss of a pet", group: "harder_moments" },
  { id: "loss_loved_one", label: "Loss of a loved one", group: "harder_moments" },
  { id: "health_update", label: "Health update", group: "harder_moments" },
  { id: "difficult_transition", label: "Difficult transition", group: "harder_moments" },
  // Invitations
  { id: "party", label: "Party / gathering", group: "invitations" },
  { id: "holiday_event", label: "Holiday event", group: "invitations" },
  { id: "reunion", label: "Reunion", group: "invitations" },
  // General
  { id: "thank_you", label: "Thank you", group: "general" },
  { id: "life_update", label: "Life update / just sharing", group: "general" },
];

export const NEWS_CATEGORY_GROUPS: NewsCategoryGroup[] = [
  { label: "Celebrations", categories: NEWS_CATEGORIES.filter((c) => c.group === "celebrations") },
  { label: "Life\u2019s harder moments", categories: NEWS_CATEGORIES.filter((c) => c.group === "harder_moments") },
  { label: "Invitations", categories: NEWS_CATEGORIES.filter((c) => c.group === "invitations") },
  { label: "General", categories: NEWS_CATEGORIES.filter((c) => c.group === "general") },
];

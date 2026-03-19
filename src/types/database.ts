export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: Omit<UserProfile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UserProfile, "id">>;
      };
      recipients: {
        Row: Recipient;
        Insert: Omit<Recipient, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Recipient, "id">>;
      };
      cards: {
        Row: Card;
        Insert: Omit<Card, "id" | "created_at">;
        Update: Partial<Omit<Card, "id">>;
      };
    };
  };
}

/**
 * Shared profile fields used by both the user and recipients.
 * The interview only fills in basics — the rest can be added manually over time.
 */
export interface PersonProfile {
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  birthday: string | null;
  personality: string | null;
  humor_style: string | null;
  interests: string[];
  values: string[];
  occupation: string | null;
  location: string | null;
  lifestyle: string | null;
  pets: string | null;
  children: string | null;
  favorite_foods: string | null;
  favorite_music: string | null;
  favorite_movies_tv: string | null;
  favorite_books: string | null;
  dislikes: string | null;
  communication_style: string | null;
  emotional_energy: string | null;
  mailing_address: string | null;
  email: string | null;
  notes: string | null;
}

export const PERSON_PROFILE_FIELDS: {
  key: keyof PersonProfile;
  label: string;
  type: "text" | "textarea" | "tags";
}[] = [
  { key: "display_name", label: "Display name (for salutations)", type: "text" },
  { key: "first_name", label: "First name", type: "text" },
  { key: "last_name", label: "Last name", type: "text" },
  { key: "nickname", label: "Nickname", type: "text" },
  { key: "birthday", label: "Birthday", type: "text" },
  { key: "personality", label: "Personality", type: "textarea" },
  { key: "humor_style", label: "Humor style", type: "text" },
  { key: "interests", label: "Interests", type: "tags" },
  { key: "values", label: "Values", type: "tags" },
  { key: "occupation", label: "Occupation", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "lifestyle", label: "Lifestyle / stage of life", type: "textarea" },
  { key: "pets", label: "Pets", type: "text" },
  { key: "children", label: "Children", type: "text" },
  { key: "favorite_foods", label: "Favorite foods", type: "text" },
  { key: "favorite_music", label: "Favorite music", type: "text" },
  { key: "favorite_movies_tv", label: "Favorite movies / TV", type: "text" },
  { key: "favorite_books", label: "Favorite books", type: "text" },
  { key: "dislikes", label: "Dislikes / things to avoid", type: "text" },
  { key: "communication_style", label: "Communication style", type: "text" },
  { key: "emotional_energy", label: "Emotional energy", type: "text" },
  { key: "mailing_address", label: "Mailing address", type: "textarea" },
  { key: "email", label: "Email", type: "text" },
  { key: "notes", label: "Additional notes", type: "textarea" },
];

export interface UserProfile extends PersonProfile {
  id: string;
  created_at: string;
  updated_at: string;
  /** Email (required for user; also on PersonProfile for recipients) */
  email: string | null;
  partner_name: string | null;
  partner_recipient_id: string | null;
  context_raw: string | null;
  onboarding_complete: boolean;
}

export interface RecipientLink {
  recipient_id: string;
  label: string;
}

export interface Recipient extends PersonProfile {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  relationship_type: string;
  personality_notes: string | null;
  humor_tolerance: string | null;
  tone_preference: string;
  important_dates: ImportantDate[];
  milestones: string[];
  context_raw: string | null;
  linked_user_id: string | null;
  links: RecipientLink[];
  setup_complete?: boolean;
  setup_step?: string;
}

export interface ImportantDate {
  label: string;
  date: string;
  recurring: boolean;
}

/** Sentinel used when card has no recipient (e.g. "Share a moment" cards). */
export const NEWS_RECIPIENT_ID = "__news__";

export interface Card {
  id: string;
  user_id: string;
  recipient_id: string;
  recipient_ids: string[];
  /** "circle" (default) = for a specific recipient; "news" = share-a-moment / announcement; "beyond" = quick card for someone not in circle */
  card_type?: "circle" | "news" | "beyond";
  /** Category for news cards (e.g. "Loss of a pet", "Thank you") */
  news_category?: string | null;
  /** Free-text description of the sender's news/event */
  news_description?: string | null;
  created_at: string;
  occasion: string;
  /** When occasion is "Other", this holds the user-defined label (e.g. "Housewarming"). */
  occasion_custom?: string | null;
  message_text: string;
  image_url: string | null;
  image_prompt: string | null;
  /** Optional small inside illustration that carries the front theme (e.g. shooting star if front has stars) */
  inside_image_url?: string | null;
  inside_image_prompt?: string | null;
  /** Optional text on the card front (e.g. "Happy Birthday!") — overlay, not in image */
  front_text?: string | null;
  /** e.g. "bottom-right", "center", "top-left" */
  front_text_position?: string | null;
  style: string | null;
  tone_used: string | null;
  delivery_method: "digital" | "print_at_home" | "mail";
  sent: boolean;
  feedback_rating: number | null;
  co_signed_with: string | null;
  /** Override for recipient name on envelope center (e.g. "Scooter" for buddy Michael). */
  recipient_display_name?: string | null;
  /** For share/news cards: label shown on envelope front (e.g. "Friends", "In Memory", "Save the Date"). */
  envelope_label?: string | null;
  /** Recipient IDs of linked people co-signing (replaces co_signed_with when set). */
  signer_recipient_ids?: string[];
  /** Override display name per signer. Keys: "__user__" for primary, recipient_id for linked. */
  signer_display_overrides?: Record<string, string>;
  /** When set, replaces all signer names with this group label (e.g. "The Tripp's"). */
  signer_group_name?: string | null;
  /** For "beyond" cards: name of the person the card is for (no persistent Recipient record). */
  quick_recipient_name?: string | null;
  /** For "beyond" cards: short relationship descriptor (e.g. "our vet", "neighbor"). */
  quick_recipient_relationship?: string | null;
  /** For "beyond" cards: personality/character traits chosen during quick profile (e.g. ["compassionate", "thoughtful"]). */
  quick_recipient_traits?: string[] | null;
  /** When true, card is hidden from default history list (can show via "Show hidden") */
  hidden?: boolean;
  /** Print size: 4x6 or 5x7 inches (folded card). Used for image aspect ratio and print layout. */
  card_size?: "4x6" | "5x7";
  /** Where the inside illustration appears relative to the message text */
  inside_image_position?: "top" | "middle" | "bottom" | "left" | "right" | "behind" | "corner_flourish" | "top_edge_accent" | "frame";
  /** Which positions are active for accent decorations (corners: 1-4, edges: 1-2) */
  accent_positions?: number[];
  /** Font style for the front cover text overlay */
  front_text_font?: string;
  /** Visual style of the front text overlay */
  front_text_style?: "dark_box" | "white_box" | "plain" | "plain_white" | "plain_black" | "black_white_border" | "white_black_border";
  /** Font style for the inside message text */
  font?: string;
  /** Scale multiplier for message text size on print (default 1.5) */
  msg_font_scale?: number | null;
  /** Scale multiplier for front text size on print (default 1) */
  ft_font_scale?: number | null;
  /** Scale multiplier for letter insert text size (default 1) */
  letter_font_scale?: number | null;
  /** 4-step image builder selections */
  image_subject?: string | null;
  art_style?: string | null;
  image_mood?: string | null;
  /** Optional personal letter insert tucked inside the card */
  letter_text?: string | null;
  /** Font choice for the letter insert */
  letter_font?: string | null;
}

export type ConversationMessage = {
  role: "assistant" | "user";
  content: string;
};

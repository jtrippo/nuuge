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
  mailing_address: string | null;
  notes: string | null;
}

export const PERSON_PROFILE_FIELDS: {
  key: keyof PersonProfile;
  label: string;
  type: "text" | "textarea" | "tags";
}[] = [
  { key: "display_name", label: "Name", type: "text" },
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
  { key: "mailing_address", label: "Mailing address", type: "textarea" },
  { key: "notes", label: "Additional notes", type: "textarea" },
];

export interface UserProfile extends PersonProfile {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
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
}

export interface ImportantDate {
  label: string;
  date: string;
  recurring: boolean;
}

export interface Card {
  id: string;
  user_id: string;
  recipient_id: string;
  recipient_ids: string[];
  created_at: string;
  occasion: string;
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
  /** When true, card is hidden from default history list (can show via "Show hidden") */
  hidden?: boolean;
  /** Print size: 4x6 or 5x7 inches (folded card). Used for image aspect ratio and print layout. */
  card_size?: "4x6" | "5x7";
}

export type ConversationMessage = {
  role: "assistant" | "user";
  content: string;
};

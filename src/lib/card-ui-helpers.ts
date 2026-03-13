import type { CSSProperties } from "react";

export type FontChoice =
  | "sans"
  | "serif"
  | "handwritten"
  | "classic"
  | "block"
  | "brush"
  | "typewriter"
  | "script"; // legacy — maps to serif

export type TextStyleChoice = "dark_box" | "white_box" | "plain" | "plain_white";

export const FONT_OPTIONS: { id: FontChoice; label: string; description: string }[] = [
  { id: "sans",        label: "Clean",       description: "Friendly and modern" },
  { id: "serif",       label: "Elegant",     description: "Warm and refined" },
  { id: "handwritten", label: "Handwritten", description: "Casual and personal" },
  { id: "classic",     label: "Classic",     description: "Traditional and stately" },
  { id: "brush",       label: "Brush",       description: "Flowing and artistic" },
  { id: "block",       label: "Bold",        description: "Strong and impactful" },
  { id: "typewriter",  label: "Typewriter",  description: "Vintage and nostalgic" },
];

export function fontCSS(font: FontChoice | string | undefined): CSSProperties {
  switch (font) {
    case "serif":
    case "script":
      return { fontFamily: "var(--font-heading), Georgia, serif" };
    case "handwritten":
      return { fontFamily: "var(--font-handwritten), 'Comic Sans MS', cursive" };
    case "classic":
      return { fontFamily: "var(--font-classic), 'Times New Roman', serif" };
    case "brush":
      return { fontFamily: "var(--font-brush), cursive" };
    case "block":
      return { fontFamily: "var(--font-bold), 'Arial Black', sans-serif", textTransform: "uppercase" as const, letterSpacing: "0.04em" };
    case "typewriter":
      return { fontFamily: "'Courier New', 'Courier', monospace", letterSpacing: "0.02em" };
    default:
      return { fontFamily: "var(--font-body), 'Helvetica Neue', Arial, sans-serif" };
  }
}

/** Inset from edge so overlay stays inside image (avoids overflow on left/right) */
const FRONT_TEXT_INSET = "8%";

export function positionCSS(pos: string): CSSProperties {
  switch (pos) {
    case "top-left": return { top: FRONT_TEXT_INSET, left: FRONT_TEXT_INSET };
    case "top-center": return { top: FRONT_TEXT_INSET, left: "50%", transform: "translateX(-50%)" };
    case "top-right": return { top: FRONT_TEXT_INSET, right: FRONT_TEXT_INSET };
    case "center": return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "bottom-left": return { bottom: FRONT_TEXT_INSET, left: FRONT_TEXT_INSET };
    case "bottom-center": return { bottom: FRONT_TEXT_INSET, left: "50%", transform: "translateX(-50%)" };
    case "bottom-right": return { bottom: FRONT_TEXT_INSET, right: FRONT_TEXT_INSET };
    default: return { bottom: FRONT_TEXT_INSET, right: FRONT_TEXT_INSET };
  }
}

/** Text alignment for front overlay based on position (keeps left/right text inside bounds). */
export function frontTextAlign(position: string): "left" | "center" | "right" {
  if (position.includes("left")) return "left";
  if (position.includes("right")) return "right";
  return "center";
}

export function textStyleCSS(style: TextStyleChoice): CSSProperties {
  switch (style) {
    case "dark_box":
      return {
        color: "#fff",
        backgroundColor: "rgba(0,0,0,0.45)",
        borderRadius: "0.375rem",
        padding: "0.6rem 1.2rem",
      };
    case "white_box":
      // UI label "Plain black" = no box (this value)
      return {
        color: "#111",
        textShadow: "0 1px 4px rgba(255,255,255,0.6)",
        backgroundColor: "transparent",
      };
    case "plain":
      // UI label "Black on white" = white semi-transparent box (this value)
      return {
        color: "#111",
        backgroundColor: "rgba(255,255,255,0.75)",
        borderRadius: "0.5rem",
        padding: "0.6rem 1.2rem",
      };
    case "plain_white":
      // UI label "Plain white" = no box, white text
      return {
        color: "#fff",
        textShadow: "0 1px 4px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)",
        backgroundColor: "transparent",
      };
    default:
      return {
        color: "#111",
        textShadow: "0 1px 4px rgba(255,255,255,0.6)",
        backgroundColor: "transparent",
      };
  }
}

/**
 * Compute font sizes for the inside message based on total character count
 * so the text fills the space naturally — not too large, not too small.
 */
export function messageSizing(totalChars: number): {
  greetingSize: string;
  bodySize: string;
  closingSize: string;
  gap: string;
} {
  if (totalChars < 80) {
    return { greetingSize: "1.5rem", bodySize: "1.15rem", closingSize: "1.1rem", gap: "1.25rem" };
  }
  if (totalChars < 160) {
    return { greetingSize: "1.3rem", bodySize: "1.05rem", closingSize: "1rem", gap: "1rem" };
  }
  if (totalChars < 300) {
    return { greetingSize: "1.15rem", bodySize: "0.95rem", closingSize: "0.9rem", gap: "0.75rem" };
  }
  return { greetingSize: "1.05rem", bodySize: "0.85rem", closingSize: "0.85rem", gap: "0.6rem" };
}

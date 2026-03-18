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

export type TextStyleChoice = "dark_box" | "white_box" | "plain" | "plain_white" | "plain_black" | "black_white_border" | "white_black_border";

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
      return {
        color: "#111",
        textShadow: "0 1px 4px rgba(255,255,255,0.6)",
        backgroundColor: "transparent",
      };
    case "plain":
      return {
        color: "#111",
        backgroundColor: "rgba(255,255,255,0.75)",
        borderRadius: "0.5rem",
        padding: "0.6rem 1.2rem",
      };
    case "plain_black":
      return {
        color: "#111",
        backgroundColor: "transparent",
      };
    case "plain_white":
      return {
        color: "#fff",
        backgroundColor: "transparent",
      };
    case "black_white_border":
      return {
        color: "#000",
        WebkitTextStroke: "1.5px #fff",
        paintOrder: "stroke fill",
        textShadow: "0 1px 3px rgba(255,255,255,0.5)",
        backgroundColor: "transparent",
      } as CSSProperties;
    case "white_black_border":
      return {
        color: "#fff",
        WebkitTextStroke: "1.5px #000",
        paintOrder: "stroke fill",
        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        backgroundColor: "transparent",
      } as CSSProperties;
    default:
      return {
        color: "#111",
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

/**
 * Maximum scale multiplier that fits the card for a given message length.
 * Shorter messages have more room → higher max. Longer messages → lower max.
 */
export function maxMsgScale(totalChars: number): number {
  if (totalChars < 80)  return 2.0;
  if (totalChars < 160) return 1.8;
  if (totalChars < 300) return 1.5;
  return 1.3;
}

const MSG_STEP = 0.10;

/**
 * Build the 5-option sizing list for the message text dropdown.
 * Max is at the top, auto (max − 0.20) in the middle.
 */
export function msgSizeOptions(totalChars: number): { label: string; value: number }[] {
  const max = maxMsgScale(totalChars);
  return [
    { label: "XL",   value: round2(max) },
    { label: "L",    value: round2(max - MSG_STEP) },
    { label: "Auto", value: round2(max - 2 * MSG_STEP) },
    { label: "S",    value: round2(max - 3 * MSG_STEP) },
    { label: "XS",   value: round2(max - 4 * MSG_STEP) },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Accent rendering helpers ──────────────────────────────────────

export const ACCENT_POSITIONS = ["corner_flourish", "top_edge_accent", "frame"] as const;
export type AccentPosition = (typeof ACCENT_POSITIONS)[number];

export function isAccentPosition(pos: string | undefined | null): pos is AccentPosition {
  return ACCENT_POSITIONS.includes(pos as AccentPosition);
}

export function defaultAccentSlots(pos: AccentPosition): number[] {
  if (pos === "corner_flourish") return [3];
  if (pos === "top_edge_accent") return [1];
  return [];
}

const CORNER_TRANSFORMS: Record<number, CSSProperties> = {
  1: { top: 0, left: 0, transform: "scale(-1, -1)" },
  2: { top: 0, right: 0, transform: "scaleY(-1)" },
  3: { bottom: 0, right: 0 },
  4: { bottom: 0, left: 0, transform: "scaleX(-1)" },
};

export function cornerStyle(slot: number): CSSProperties {
  return {
    position: "absolute",
    width: "45%",
    height: "45%",
    ...(CORNER_TRANSFORMS[slot] || CORNER_TRANSFORMS[3]),
  };
}

export function cornerImgStyle(): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
    mixBlendMode: "multiply" as const,
    pointerEvents: "none" as const,
    filter: "contrast(1.4) brightness(1.08)",
  };
}

export function edgeStyle(slot: number): CSSProperties {
  if (slot === 2) {
    return { width: "100%", height: "12%", flexShrink: 0, transform: "scaleY(-1)" };
  }
  return { width: "100%", height: "12%", flexShrink: 0 };
}

export function edgeImgStyle(): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    mixBlendMode: "multiply" as const,
    filter: "contrast(1.4) brightness(1.08)",
  };
}

export function frameImgStyle(): CSSProperties {
  return {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "fill" as const,
    mixBlendMode: "multiply" as const,
    pointerEvents: "none" as const,
    filter: "contrast(1.4) brightness(1.08)",
  };
}

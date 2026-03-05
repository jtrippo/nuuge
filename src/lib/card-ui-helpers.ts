import type { CSSProperties } from "react";

export type FontChoice = "sans" | "script" | "block";
export type TextStyleChoice = "dark_box" | "white_box" | "plain";

export function fontCSS(font: FontChoice | undefined): CSSProperties {
  switch (font) {
    case "script":
      return { fontFamily: "'Georgia', 'Palatino', 'Times New Roman', serif", fontStyle: "italic" };
    case "block":
      return { fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" };
    default:
      return { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" };
  }
}

export function positionCSS(pos: string): CSSProperties {
  switch (pos) {
    case "top-left": return { top: "5%", left: "5%" };
    case "top-center": return { top: "5%", left: "50%", transform: "translateX(-50%)" };
    case "top-right": return { top: "5%", right: "5%" };
    case "center": return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "bottom-left": return { bottom: "5%", left: "5%" };
    case "bottom-center": return { bottom: "5%", left: "50%", transform: "translateX(-50%)" };
    default: return { bottom: "5%", right: "5%" };
  }
}

export function textStyleCSS(style: TextStyleChoice): CSSProperties {
  switch (style) {
    case "dark_box":
      return {
        color: "#fff",
        textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)",
        backgroundColor: "rgba(0,0,0,0.35)",
        borderRadius: "0.5rem",
        padding: "0.6rem 1.2rem",
      };
    case "white_box":
      return {
        color: "#111",
        backgroundColor: "rgba(255,255,255,0.75)",
        borderRadius: "0.5rem",
        padding: "0.6rem 1.2rem",
      };
    default:
      return {
        color: "#111",
        textShadow: "0 1px 4px rgba(255,255,255,0.6)",
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

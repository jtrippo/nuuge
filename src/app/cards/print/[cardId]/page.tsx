"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCards, getRecipients, getUserProfile, hydrateCardImages, updateCard, deleteCard } from "@/lib/store";
import AppHeader from "@/components/AppHeader";
import NuugeWaxSeal from "@/components/NuugeWaxSeal";
import type { Card, Recipient } from "@/types/database";
import { getDisplayOccasion } from "@/lib/occasions";
import { fontCSS, positionCSS, textStyleCSS, frontTextAlign, messageSizing, maxMsgScale, msgSizeOptions, FONT_OPTIONS, isAccentPosition, defaultAccentSlots, cornerStyle, cornerImgStyle, edgeStyle, edgeImgStyle, frameImgStyle, DEFAULT_ACCENT_OPACITY, DEFAULT_FRAME_OPACITY } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";
import { shareCard } from "@/lib/share-card";
import { copyToClipboard } from "@/lib/clipboard";
import { getSenderNames, getRecipientDisplayName } from "@/lib/signer-helpers";

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
];

const TEXT_STYLE_OPTIONS: { value: TextStyleChoice; label: string }[] = [
  { value: "plain_black", label: "Plain black" },
  { value: "plain_white", label: "Plain white" },
  { value: "black_white_border", label: "Black / white outline" },
  { value: "white_black_border", label: "White / black outline" },
];

export default function PrintCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [mounted, setMounted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [paperType, setPaperType] = useState<"letter" | "cardstock">("letter");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLetterEditor, setShowLetterEditor] = useState(false);
  const [showPrintInfo, setShowPrintInfo] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [letterFont, setLetterFont] = useState<string>("handwritten");
  const [letterSizeScale, setLetterSizeScale] = useState<number>(1);
  const [showUseAgain, setShowUseAgain] = useState(false);
  const [useAgainTarget, setUseAgainTarget] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const [printSize, setPrintSize] = useState<"4x6" | "5x7" | "8.5x11">("5x7");
  const [ftFont, setFtFont] = useState<string>("sans");
  const [ftPosition, setFtPosition] = useState("bottom-right");
  const [ftStyle, setFtStyle] = useState<TextStyleChoice>("plain_black");
  const [msgFont, setMsgFont] = useState<string>("sans");
  const [insidePos, setInsidePos] = useState<"top" | "middle" | "bottom" | "left" | "right" | "behind" | "corner_flourish" | "top_edge_accent" | "frame">("top");
  const [msgSizeScale, setMsgSizeScale] = useState<number>(0);
  const [ftSizeScale, setFtSizeScale] = useState<number>(1);
  const loadedRef = useRef(false);
  const sheet1Ref = useRef<HTMLDivElement>(null);
  const sheet2Ref = useRef<HTMLDivElement>(null);
  const sheet3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) {
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === found.recipient_id);
      if (r) setRecipient(r);

      setFtFont(found.front_text_font ?? "sans");
      setFtPosition(found.front_text_position ?? "bottom-right");
      setFtStyle(found.front_text_style ?? "plain_black");
      setMsgFont(found.font ?? "sans");
      setInsidePos((found.inside_image_position as typeof insidePos) ?? "top");
      if (found.card_size) setPrintSize(found.card_size as "4x6" | "5x7");
      if (found.msg_font_scale != null) setMsgSizeScale(found.msg_font_scale);
      if (found.ft_font_scale != null) setFtSizeScale(found.ft_font_scale);
      if (found.letter_text) setLetterText(found.letter_text);
      if (found.letter_font) setLetterFont(found.letter_font);
      if (found.letter_font_scale != null) setLetterSizeScale(found.letter_font_scale);

      hydrateCardImages(found).then((hydrated) => {
        setCard(hydrated);
        loadedRef.current = true;
      });
    }
  }, [cardId]);

  const imageUrls: string[] = card
    ? [card.image_url, card.inside_image_url].filter((u): u is string => Boolean(u))
    : [];

  useEffect(() => {
    if (imageUrls.length === 0) { setImagesLoaded(true); return; }
    let done = 0;
    const check = () => { done++; if (done >= imageUrls.length) setImagesLoaded(true); };
    imageUrls.forEach((src) => {
      const img = new Image();
      img.onload = check;
      img.onerror = check;
      img.src = src;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  useEffect(() => {
    if (!card || !loadedRef.current) return;
    updateCard(card.id, {
      front_text_font: ftFont,
      front_text_position: ftPosition,
      front_text_style: ftStyle,
      font: msgFont,
      inside_image_position: insidePos,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      letter_font: letterFont,
      letter_font_scale: letterSizeScale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftFont, ftPosition, ftStyle, msgFont, insidePos, msgSizeScale, ftSizeScale, letterFont, letterSizeScale]);

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray mb-4">Card not found.</p>
        <button onClick={() => router.push("/")} style={{ color: "var(--color-brand)" }} className="font-medium">
          Back to Home
        </button>
      </div>
    );
  }

  function saveSettings() {
    if (!card) return;
    updateCard(card.id, {
      front_text_font: ftFont,
      front_text_position: ftPosition,
      front_text_style: ftStyle,
      font: msgFont,
      inside_image_position: insidePos,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      letter_font: letterFont,
      letter_font_scale: letterSizeScale,
    });
  }

  const messageParts = card.message_text.split("\n\n");
  const greeting = messageParts[0] || "";
  const body = messageParts.length > 2 ? messageParts.slice(1, -1).join("\n\n") : "";
  const closing = messageParts.length > 1 ? messageParts[messageParts.length - 1] : "";
  const totalChars = card.message_text.length;
  const baseSizing = messageSizing(totalChars);

  const sizeOpts = msgSizeOptions(totalChars);
  const autoValue = sizeOpts.find((o) => o.label === "Auto")!.value;
  const effectiveMsgScale = msgSizeScale === 0 ? autoValue : msgSizeScale;
  const remToCqw = (rem: string) => `${(parseFloat(rem) * effectiveMsgScale * 3.81).toFixed(2)}cqw`;
  const sizing = {
    greetingSize: remToCqw(baseSizing.greetingSize),
    bodySize: remToCqw(baseSizing.bodySize),
    closingSize: remToCqw(baseSizing.closingSize),
    gap: remToCqw(baseSizing.gap),
  };

  const frontFontStyle = fontCSS(ftFont);
  const messageFontStyle = fontCSS(msgFont);
  const ftPosCSS = positionCSS(ftPosition);
  const ftStyleCSS = textStyleCSS(ftStyle);
  const ftSizeCqw = `${(8.5 * ftSizeScale).toFixed(2)}cqw`;
  // Print-safe inline styles: PDF renderers turn ANY text-shadow into visible
  // rectangles, so we strip text-shadow from every style for print output.
  // Only dark_box keeps its background/padding (the user explicitly chose a box).
  const ftStyleCSSForPrint: React.CSSProperties = (() => {
    switch (ftStyle) {
      case "dark_box":
        return {
          color: ftStyleCSS.color,
          backgroundColor: ftStyleCSS.backgroundColor,
          borderRadius: ftStyleCSS.borderRadius,
          padding: ftStyleCSS.padding,
        };
      case "black_white_border":
        return {
          color: "#000",
          WebkitTextStroke: "1.5px #fff",
          paintOrder: "stroke fill",
        };
      case "white_black_border":
        return {
          color: "#fff",
          WebkitTextStroke: "1.5px #000",
          paintOrder: "stroke fill",
        };
      case "plain_white":
        return { color: "#fff" };
      case "plain_black":
        return { color: "#111" };
      case "plain":
        return { color: "#111" };
      case "white_box":
      default:
        return { color: "#111" };
    }
  })();

  // On-screen preview aspect ratios (landscape sheet with 2 portrait panels)
  const sheetAspect = printSize === "4x6" ? "8 / 6"
    : printSize === "5x7" ? "10 / 7"
      : "11 / 8.5";

  // Unfolded dimensions in inches
  const pdfWidthIn = printSize === "4x6" ? 8 : printSize === "5x7" ? 10 : 11;
  const pdfHeightIn = printSize === "4x6" ? 6 : printSize === "5x7" ? 7 : 8.5;

  const showPaperFrame = printSize !== "8.5x11";
  const effectiveMode: "cardstock" | "letter" = printSize === "8.5x11" ? "cardstock" : paperType;
  const cardWpct = `${((pdfWidthIn / 11) * 100).toFixed(1)}%`;

  // Letter insert: same stock dimensions rotated to portrait
  const letterWidthIn = pdfHeightIn;
  const letterHeightIn = pdfWidthIn;
  const letterAspect = `${letterWidthIn} / ${letterHeightIn}`;
  const letterNeedsFrame = letterWidthIn < 8.5;
  const letterWpct = letterNeedsFrame ? `${((letterWidthIn / 8.5) * 100).toFixed(1)}%` : "100%";
  const letterMaxChars = Math.round(letterWidthIn * letterHeightIn * 26);

  const cropMarks = (
    <>
      <div style={{ position: "absolute", top: 0, left: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", top: -12, left: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", top: 0, right: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", top: -12, right: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", bottom: 0, left: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", bottom: -12, left: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", bottom: 0, right: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", bottom: -12, right: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", top: -8, left: "50%", width: 0, height: 6, borderLeft: "1px dashed #bbb", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -8, left: "50%", width: 0, height: 6, borderLeft: "1px dashed #bbb", pointerEvents: "none" }} />
    </>
  );

  const letterCropMarks = (
    <>
      <div style={{ position: "absolute", top: 0, left: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", top: -12, left: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", top: 0, right: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", top: -12, right: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", bottom: 0, left: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", bottom: -12, left: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", bottom: 0, right: -12, width: 10, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", bottom: -12, right: 0, width: 1, height: 10, background: "#999" }} />
      <div style={{ position: "absolute", left: -8, top: "50%", width: 6, height: 0, borderTop: "1px dashed #bbb", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: -8, top: "50%", width: 6, height: 0, borderTop: "1px dashed #bbb", pointerEvents: "none" }} />
    </>
  );

  function buildPdfFilename(suffix: "Card" | "Letter"): string {
    const now = new Date();
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const occasion = card ? getDisplayOccasion(card).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") : "Card";
    const ct = (card as Card & { card_type?: string })?.card_type;
    const qName = (card as Card & { quick_recipient_name?: string | null })?.quick_recipient_name;

    let namePart = "Moment";
    if (ct === "news") {
      namePart = "Moment";
    } else if (ct === "beyond" && qName) {
      namePart = qName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    } else if (recipient) {
      const parts = recipient.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join("_");
        namePart = `${last}_${first}`;
      } else {
        namePart = parts[0] || "Recipient";
      }
      namePart = namePart.replace(/[^a-zA-Z0-9_]+/g, "");
    }

    return `Nuuge_${date}_${namePart}_${occasion}_${suffix}.pdf`;
  }

  async function captureSheet(
    html2canvas: typeof import("html2canvas")["default"],
    sheetEl: HTMLDivElement,
    renderW: number,
    renderH: number,
    textScaleCap?: number,
  ): Promise<HTMLCanvasElement> {
    const clone = sheetEl.cloneNode(true) as HTMLDivElement;
    Object.assign(clone.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: `${renderW}px`,
      height: `${renderH}px`,
      maxWidth: "none",
      maxHeight: "none",
      aspectRatio: "auto",
      border: "none",
      borderRadius: "0",
      margin: "0",
      zIndex: "-9999",
      overflow: "hidden",
    });

    const scaleFactor = renderW / sheetEl.offsetWidth;
    const tScale = textScaleCap ? Math.min(scaleFactor, textScaleCap) : scaleFactor;

    // Scale front text font to print resolution
    clone.querySelectorAll<HTMLElement>(".front-text-overlay").forEach((el) => {
      const orig = sheetEl.querySelector(".front-text-overlay");
      if (!orig) return;
      const screenFontPx = parseFloat(window.getComputedStyle(orig).fontSize);
      el.style.fontSize = `${screenFontPx * scaleFactor}px`;
    });
    // Remove panel borders, scale only fixed padding (not percentage-based)
    const origPanels = sheetEl.querySelectorAll<HTMLElement>(".card-panel");
    clone.querySelectorAll<HTMLElement>(".card-panel").forEach((panel, idx) => {
      panel.style.borderLeft = "none";
      const orig = origPanels[idx];
      if (orig) {
        const cs = window.getComputedStyle(orig);
        const pt = parseFloat(cs.paddingTop);
        const pr = parseFloat(cs.paddingRight);
        const pb = parseFloat(cs.paddingBottom);
        const pl = parseFloat(cs.paddingLeft);
        if ((pt + pr + pb + pl) > 0 && !panel.style.padding?.includes("%")) {
          panel.style.padding = `${Math.round(pt * scaleFactor)}px ${Math.round(pr * scaleFactor)}px ${Math.round(pb * scaleFactor)}px ${Math.round(pl * scaleFactor)}px`;
        }
      }
    });
    // Scale SVGs
    clone.querySelectorAll<SVGSVGElement>("svg").forEach((svg) => {
      const w = svg.getAttribute("width");
      const h = svg.getAttribute("height");
      if (w && h) {
        svg.setAttribute("width", String(Math.round(parseFloat(w) * scaleFactor)));
        svg.setAttribute("height", String(Math.round(parseFloat(h) * scaleFactor)));
      }
    });
    // ── Unified pass: resolve fonts + scale text for ALL elements ──
    const origAllEls = sheetEl.querySelectorAll<HTMLElement>("*");
    const cloneAllEls = clone.querySelectorAll<HTMLElement>("*");
    cloneAllEls.forEach((el, idx) => {
      const origEl = origAllEls[idx];
      if (!origEl) return;
      // Font resolution: always resolve computed fontFamily (html2canvas can't resolve var())
      if (el.style.fontFamily) {
        el.style.fontFamily = window.getComputedStyle(origEl).fontFamily;
      }
      if (el.closest(".front-text-overlay")) return;
      // Text scaling: p/span always, div only when it has explicit inline fontSize
      const tag = el.tagName.toLowerCase();
      if (tag === "p" || tag === "span" || (tag === "div" && el.style.fontSize)) {
        const px = parseFloat(window.getComputedStyle(origEl).fontSize);
        if (px > 0 && px < 40) el.style.fontSize = `${Math.round(px * tScale)}px`;
      }
    });
    // Resolve root element font unconditionally
    clone.style.fontFamily = window.getComputedStyle(sheetEl).fontFamily;
    // Propagate CSS custom properties so html2canvas can resolve any remaining var() refs
    const cssVars = ["--font-handwritten", "--font-heading", "--font-body", "--font-classic", "--font-bold", "--font-brush"];
    const bodyCS = window.getComputedStyle(document.body);
    for (const v of cssVars) {
      const val = bodyCS.getPropertyValue(v);
      if (val) clone.style.setProperty(v, val);
    }

    // Convert object-fit images to background-image divs
    clone.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      const fit = img.style.objectFit || window.getComputedStyle(img).objectFit;
      if (fit === "cover" || fit === "fill") {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
          width:${img.style.width || "100%"};height:${img.style.height || "100%"};
          background-image:url("${img.src}");background-size:${fit};
          background-position:${img.style.objectPosition || "center"};
          background-repeat:no-repeat;opacity:${img.style.opacity || "1"};
          position:${img.style.position || "static"};top:${img.style.top || "auto"};
          left:${img.style.left || "auto"};pointer-events:none;display:block;
          flex-shrink:${img.style.flexShrink || "1"};
        `;
        if (img.style.transform) wrapper.style.transform = img.style.transform;
        img.replaceWith(wrapper);
      }
    });

    document.body.appendChild(clone);
    await document.fonts.ready;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const canvas = await html2canvas(clone, {
      width: renderW, height: renderH, scale: 1,
      useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false,
    });
    document.body.removeChild(clone);
    return canvas;
  }

  async function generateLetterPDF(
    html2canvas: typeof import("html2canvas")["default"],
    filename: string,
    mode: "cardstock" | "letter",
  ) {
    if (!sheet3Ref.current) return;
    const { jsPDF } = await import("jspdf");
    const DPI = 200;
    const renderLetterW = Math.round(letterWidthIn * DPI);
    const renderLetterH = Math.round(letterHeightIn * DPI);

    // ── Auto-fit: measure text at full scale, then calculate scale to fill ~90% of page ──
    const baseScale = renderLetterW / sheet3Ref.current.offsetWidth;
    const padV = renderLetterW * 0.08 * 2; // top+bottom (CSS % padding is relative to width)
    const availH = renderLetterH - padV;

    const mc = sheet3Ref.current.cloneNode(true) as HTMLDivElement;
    Object.assign(mc.style, {
      position: "fixed", left: "-9999px", top: "0",
      width: `${renderLetterW}px`, height: "auto",
      maxHeight: "none", overflow: "visible", zIndex: "-9999",
      border: "none", borderRadius: "0", margin: "0",
    });
    const firstChild = mc.children[0] as HTMLElement;
    if (firstChild) firstChild.style.height = "auto";

    const origEls = sheet3Ref.current.querySelectorAll<HTMLElement>("*");
    mc.querySelectorAll<HTMLElement>("*").forEach((el, i) => {
      const orig = origEls[i];
      if (!orig) return;
      if (el.style.fontFamily) el.style.fontFamily = window.getComputedStyle(orig).fontFamily;
      const tag = el.tagName.toLowerCase();
      if (tag === "p" || tag === "span" || (tag === "div" && el.style.fontSize)) {
        const px = parseFloat(window.getComputedStyle(orig).fontSize);
        if (px > 0 && px < 40) el.style.fontSize = `${Math.round(px * baseScale)}px`;
      }
    });

    document.body.appendChild(mc);
    await document.fonts.ready;
    const textH = mc.scrollHeight - padV;
    document.body.removeChild(mc);

    let letterScale = baseScale;
    if (textH > 0) {
      // sqrt accounts for text re-wrapping: larger font → fewer chars/line → more lines
      letterScale = baseScale * Math.sqrt((availH * 0.90) / textH);
    }
    const maxPx = 18 * DPI / 72; // cap at 18pt for very short notes
    const screenBodyPx = 0.75 * letterSizeScale * 16;
    letterScale = Math.min(letterScale, maxPx / screenBodyPx);

    const canvas = await captureSheet(html2canvas, sheet3Ref.current, renderLetterW, renderLetterH, letterScale);

    if (mode === "letter" && letterNeedsFrame) {
      // Letter paper: center on 8.5×11 with crop marks + fold line
      const lPageW = 8.5;
      const lPageH = 11;
      const letterPdf = new jsPDF({ orientation: "portrait", unit: "in", format: [lPageW, lPageH] });
      const lOffsetX = (lPageW - letterWidthIn) / 2;
      const lOffsetY = (lPageH - letterHeightIn) / 2;
      letterPdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", lOffsetX, lOffsetY, letterWidthIn, letterHeightIn);
      letterPdf.setDrawColor(0);
      letterPdf.setLineWidth(0.01);
      const cropLen = 0.25;
      const cx = [lOffsetX, lOffsetX + letterWidthIn];
      const cy = [lOffsetY, lOffsetY + letterHeightIn];
      for (const x of cx) {
        for (const y of cy) {
          letterPdf.line(x < lPageW / 2 ? x - cropLen : x + cropLen, y, x, y);
          letterPdf.line(x, y < lPageH / 2 ? y - cropLen : y + cropLen, x, y);
        }
      }
      const foldY = lOffsetY + letterHeightIn / 2;
      letterPdf.setDrawColor(180);
      letterPdf.setLineWidth(0.005);
      letterPdf.setLineDashPattern([0.08, 0.08], 0);
      letterPdf.line(lOffsetX - 0.15, foldY, lOffsetX, foldY);
      letterPdf.line(lOffsetX + letterWidthIn, foldY, lOffsetX + letterWidthIn + 0.15, foldY);
      letterPdf.setLineDashPattern([], 0);
      letterPdf.save(filename);
    } else {
      // Card stock: exact letter dimensions, no guidelines (user scales via PDF app)
      const letterPdf = new jsPDF({ orientation: "portrait", unit: "in", format: [letterWidthIn, letterHeightIn] });
      letterPdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, letterWidthIn, letterHeightIn);
      letterPdf.save(filename);
    }
  }

  async function generatePDF(mode: "cardstock" | "letter") {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const DPI = 200;

      // Card sheets (pages 1–2)
      const cardSheets: HTMLDivElement[] = [];
      if (sheet1Ref.current) cardSheets.push(sheet1Ref.current);
      if (sheet2Ref.current) cardSheets.push(sheet2Ref.current);

      if (cardSheets.length === 0) return;

      const hasLetter = !!(sheet3Ref.current && letterText.trim());

      if (mode === "cardstock") {
        // ── Card stock mode: exact card dimensions ──
        const renderW = Math.round(pdfWidthIn * DPI);
        const renderH = Math.round(pdfHeightIn * DPI);
        const cardPdf = new jsPDF({ orientation: "landscape", unit: "in", format: [pdfWidthIn, pdfHeightIn] });

        for (let i = 0; i < cardSheets.length; i++) {
          if (i > 0) cardPdf.addPage([pdfWidthIn, pdfHeightIn], "landscape");
          const canvas = await captureSheet(html2canvas, cardSheets[i], renderW, renderH);
          cardPdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfWidthIn, pdfHeightIn);
        }
        cardPdf.save(buildPdfFilename("Card"));

        if (hasLetter) {
          await generateLetterPDF(html2canvas, buildPdfFilename("Letter"), "cardstock");
        }
      } else {
        // ── Letter paper mode: card centered on 8.5×11 with crop marks ──
        const pageW = 11;
        const pageH = 8.5;
        const renderPageW = Math.round(pageW * DPI);
        const renderPageH = Math.round(pageH * DPI);
        const renderCardW = Math.round(pdfWidthIn * DPI);
        const renderCardH = Math.round(pdfHeightIn * DPI);
        const offsetX = (pageW - pdfWidthIn) / 2;
        const offsetY = (pageH - pdfHeightIn) / 2;
        const cropLen = 0.25;

        const cardPdf = new jsPDF({ orientation: "landscape", unit: "in", format: [pageW, pageH] });

        for (let i = 0; i < cardSheets.length; i++) {
          if (i > 0) cardPdf.addPage([pageW, pageH], "landscape");
          const canvas = await captureSheet(html2canvas, cardSheets[i], renderCardW, renderCardH);
          cardPdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", offsetX, offsetY, pdfWidthIn, pdfHeightIn);

          // Draw crop marks at the four corners
          cardPdf.setDrawColor(0);
          cardPdf.setLineWidth(0.01);
          const cx = [offsetX, offsetX + pdfWidthIn];
          const cy = [offsetY, offsetY + pdfHeightIn];
          for (const x of cx) {
            for (const y of cy) {
              // Horizontal mark
              cardPdf.line(x < pageW / 2 ? x - cropLen : x + cropLen, y, x, y);
              // Vertical mark
              cardPdf.line(x, y < pageH / 2 ? y - cropLen : y + cropLen, x, y);
            }
          }
          // Fold line indicator (thin dashed line at center)
          const foldX = offsetX + pdfWidthIn / 2;
          cardPdf.setLineDashPattern([0.05, 0.05], 0);
          cardPdf.line(foldX, offsetY - 0.15, foldX, offsetY);
          cardPdf.line(foldX, offsetY + pdfHeightIn, foldX, offsetY + pdfHeightIn + 0.15);
          cardPdf.setLineDashPattern([], 0);
        }
        cardPdf.save(buildPdfFilename("Card"));

        if (hasLetter) {
          await generateLetterPDF(html2canvas, buildPdfFilename("Letter"), "letter");
        }
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. Please try again.");
    } finally {
      setPdfGenerating(false);
    }
  }

  return (
    <>
      <style>{`
        @page {
          margin: 0;
        }

        .card-sheet {
          display: flex;
          flex-direction: row;
          max-width: 100%;
          aspect-ratio: ${sheetAspect};
          max-height: 60vh;
          border: 1px solid var(--color-light-gray);
          border-radius: 0.5rem;
          overflow: hidden;
          margin: 0 auto 1rem;
          background: var(--color-white);
        }
        .card-panel {
          width: 50%;
          height: 100%;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          container-type: inline-size;
        }
        .card-panel + .card-panel {
          border-left: 1px dashed var(--color-light-gray);
        }

        .front-text-overlay {
          font-size: calc(clamp(1.4rem, 4vw, 2.5rem) * var(--ft-scale, 1));
          line-height: 1.2;
          text-align: center;
        }
        .paper-context-framed {
          aspect-ratio: 11 / 8.5;
          max-height: 72vh;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          margin: 0 auto 1rem;
        }
        .paper-context-letter {
          border: 1px solid var(--color-light-gray);
          background: #fff;
        }
        .paper-context-cardstock {
          border: none;
          border-radius: 0;
          background-color: transparent;
          background-image:
            repeating-linear-gradient(to right, var(--color-light-gray) 0, var(--color-light-gray) 10px, transparent 10px, transparent 18px),
            repeating-linear-gradient(to right, var(--color-light-gray) 0, var(--color-light-gray) 10px, transparent 10px, transparent 18px),
            repeating-linear-gradient(to bottom, var(--color-light-gray) 0, var(--color-light-gray) 10px, transparent 10px, transparent 18px),
            repeating-linear-gradient(to bottom, var(--color-light-gray) 0, var(--color-light-gray) 10px, transparent 10px, transparent 18px);
          background-size: 100% 1.5px, 100% 1.5px, 1.5px 100%, 1.5px 100%;
          background-position: top left, bottom left, top left, top right;
          background-repeat: no-repeat;
        }
        .paper-context-framed .card-sheet {
          max-height: none;
          aspect-ratio: auto;
          width: 100%;
          height: 100%;
          margin: 0;
        }
        .paper-context-letter .card-sheet {
          border: none;
          border-radius: 0;
        }
        .letter-sheet {
          display: block;
          max-width: 100%;
          max-height: 70vh;
          border: 1px solid var(--color-light-gray);
          border-radius: 0.5rem;
          overflow: hidden;
          margin: 0 auto 1rem;
          background: var(--color-white);
          position: relative;
        }
        .paper-context-framed .letter-sheet {
          max-height: none;
          width: 100%;
          height: 100%;
          margin: 0;
          aspect-ratio: auto;
        }
        .paper-context-letter .letter-sheet {
          border: none;
          border-radius: 0;
        }
        @media print {
          .no-print { display: none !important; }
          html, body {
            margin: 0; padding: 0; height: auto;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .card-sheet {
            width: 100vw;
            height: 100vh;
            max-width: 100vw;
            max-height: 100vh;
            aspect-ratio: auto;
            border: none;
            border-radius: 0;
            margin: 0;
            padding: 0;
            overflow: hidden;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .card-sheet-1 {
            page-break-after: always;
            break-after: page;
          }
          .card-sheet-2 {
            page-break-after: avoid;
            break-after: avoid;
          }
          .card-sheet-3,
          .letter-sheet {
            page-break-before: always;
            break-before: page;
            page-break-after: avoid;
            break-after: avoid;
            width: 100vw;
            height: 100vh;
            max-width: 100vw;
            max-height: 100vh;
            border: none;
            border-radius: 0;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          .card-panel {
            overflow: hidden;
            position: relative;
            box-sizing: border-box;
          }
          .card-panel + .card-panel { border-left: none; }
          .front-text-overlay {
            font-size: calc(clamp(1.6rem, 5vw, 3rem) * var(--ft-scale, 1)) !important;
          }
        }
      `}</style>

      <AppHeader title={card ? (() => {
        const ct = (card as Card & { card_type?: string }).card_type;
        const qName = (card as Card & { quick_recipient_name?: string | null }).quick_recipient_name;
        if (ct === "news") return `${getDisplayOccasion(card)} — Share a moment`;
        if (ct === "beyond" && qName) return `${getDisplayOccasion(card)} card for ${qName}`;
        return `${getDisplayOccasion(card)} card for ${recipient?.name ?? "recipient"}`;
      })() : undefined}>
        <button
          onClick={() => { saveSettings(); const ct = (card as Card & { card_type?: string })?.card_type; (ct === "news" || ct === "beyond") ? router.push("/") : (recipient ? router.push(`/recipients/${recipient.id}`) : router.push("/")); }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          {recipient?.name ?? "Home"}
        </button>
        <span className="flex-1" />
        <button
          onClick={() => { saveSettings(); window.location.href = `/cards/edit/${cardId}`; }}
          className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          Edit card
        </button>
        <button
          onClick={() => setShowLetterEditor(true)}
          className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          {letterText.trim() ? "Edit letter" : "Add letter"}
        </button>
        <button
          onClick={() => { saveSettings(); window.location.href = `/cards/view/${cardId}`; }}
          className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          View e-card
        </button>
        <button
          onClick={async () => {
            if (!card || sharing) return;
            saveSettings();
            setSharing(true);
            setShareError(null);
            try {
              const profile = getUserProfile();
              const recipients = getRecipients();
              const rName = getRecipientDisplayName(card, recipient);
              const sName = getSenderNames(card, recipient, recipients, profile);
              const hydrated = await hydrateCardImages(card);
              const result = await shareCard(hydrated, rName, sName);
              if ("error" in result) { setShareError(result.error); }
              else { setShareUrl(result.shareUrl); }
            } catch (err) {
              setShareError(err instanceof Error ? err.message : "Failed to share. Check your connection and try again.");
            } finally {
              setSharing(false);
            }
          }}
          disabled={sharing}
          className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          {sharing ? "Sharing..." : "Share e-card"}
        </button>
        <button
          onClick={() => { setShowUseAgain(true); setUseAgainTarget(""); }}
          className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          Use Again
        </button>
      </AppHeader>

      {/* Share URL banner */}
      {shareUrl && (
        <div className="no-print max-w-4xl mx-auto px-6 pt-3">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
            <span className="text-xs text-charcoal font-medium">Shareable link:</span>
            <input
              readOnly
              value={shareUrl}
              className="flex-1 text-xs bg-transparent outline-none text-charcoal"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={async () => {
                const ok = await copyToClipboard(shareUrl);
                if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
              }}
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {shareError && (
        <div className="no-print max-w-4xl mx-auto px-6 pt-2">
          <div className="p-3 rounded-lg text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>{shareError}</div>
        </div>
      )}

      {/* ── Print controls (above Page 1) ── */}
      <div className="no-print print-wrapper max-w-4xl mx-auto px-6 pt-4 flex items-center justify-between gap-4">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--color-error)", border: "1.5px solid var(--color-error)" }}
        >
          Delete
        </button>
        <div className="flex items-center gap-3">
          <fieldset className="rounded-lg px-2.5 pt-0 pb-1.5" style={{ border: "1px solid var(--color-light-gray)" }}>
            <legend className="text-[10px] text-warm-gray uppercase tracking-wide px-1">Card size</legend>
            <div className="flex items-center gap-1.5">
              {(["4x6", "5x7", "8.5x11"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPrintSize(s)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    printSize === s
                      ? "font-medium text-charcoal"
                      : "text-warm-gray hover:text-charcoal"
                  }`}
                  style={printSize === s
                    ? { background: "var(--color-sage)", border: "1.5px solid var(--color-sage)" }
                    : { border: "1.5px solid var(--color-light-gray)" }
                  }
                >
                  {s === "4x6" ? "4×6" : s === "5x7" ? "5×7" : "8.5×11"}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="rounded-lg px-2.5 pt-0 pb-1.5" style={{ border: "1px solid var(--color-light-gray)" }}>
            <legend className="text-[10px] text-warm-gray uppercase tracking-wide px-1">Paper</legend>
            <div className="flex items-center gap-1.5">
              {(["letter", "cardstock"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPaperType(p)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    paperType === p ? "font-medium text-charcoal" : "text-warm-gray hover:text-charcoal"
                  }`}
                  style={paperType === p
                    ? { background: "var(--color-sage)", border: "1.5px solid var(--color-sage)" }
                    : { border: "1.5px solid var(--color-light-gray)" }
                  }
                >
                  {p === "letter" ? "Letter paper" : "Card stock"}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="relative">
            <button
              onClick={() => setShowPrintInfo(!showPrintInfo)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-charcoal transition-colors"
              style={{ border: "1.5px solid var(--color-sage)" }}
              title="Print instructions"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
            {showPrintInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPrintInfo(false)} />
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl shadow-lg p-4 text-sm"
                  style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
                >
                  <p className="font-medium text-charcoal mb-2">How to print</p>
                  {showPaperFrame ? (
                    <>
                      <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mt-2 mb-1">Letter paper</p>
                      <ul className="list-disc list-inside space-y-1 text-warm-gray">
                        {letterText.trim() && <li><strong className="text-charcoal">Saves 2 PDFs</strong> (card + letter)</li>}
                        <li>Select <strong className="text-charcoal">Letter paper</strong>, then <strong className="text-charcoal">Save to Print</strong></li>
                        <li>Print card on <strong className="text-charcoal">8.5×11</strong> — trim along crop marks, fold in half</li>
                        {letterText.trim() && <li>Print letter on <strong className="text-charcoal">8.5×11</strong> — trim along crop marks, fold, tuck inside card</li>}
                      </ul>
                      <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mt-3 mb-1">Card stock (pre-scored)</p>
                      <ul className="list-disc list-inside space-y-1 text-warm-gray">
                        {letterText.trim() && <li><strong className="text-charcoal">Saves 2 PDFs</strong> (card + letter)</li>}
                        <li>Select <strong className="text-charcoal">Card stock</strong>, then <strong className="text-charcoal">Save to Print</strong></li>
                        <li>Print card on <strong className="text-charcoal">{printSize === "5x7" ? "10×7" : "8×6"} card stock</strong>, <strong className="text-charcoal">Landscape</strong>, at actual size</li>
                        {letterText.trim() && <li>Print letter — scale to your paper from the PDF app, fold, tuck inside card</li>}
                        <li>Fold card along the score</li>
                      </ul>
                    </>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 text-warm-gray mt-2">
                      {letterText.trim() && <li><strong className="text-charcoal">Saves 2 PDFs</strong> (card + letter)</li>}
                      <li>Click <strong className="text-charcoal">Save to Print</strong> to download</li>
                      <li>Print card on <strong className="text-charcoal">8.5×11</strong> at actual size, fold in half</li>
                      {letterText.trim() && <li>Print letter — scale to your paper from the PDF app, fold, tuck inside card</li>}
                    </ul>
                  )}
                  <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mt-3 mb-1">Printing tips</p>
                  <ul className="list-disc list-inside space-y-1 text-warm-gray">
                    <li>Print page 1 first, re-insert face-down rotated 180°, print page 2</li>
                    <li><strong className="text-charcoal">Page 1:</strong> Left = back · Right = front</li>
                    <li><strong className="text-charcoal">Page 2:</strong> Left = blank · Right = message</li>
                  </ul>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => generatePDF(effectiveMode)}
            disabled={pdfGenerating || (!imagesLoaded && imageUrls.length > 0)}
            className="btn-primary px-5 py-2 rounded-full text-sm disabled:opacity-50"
          >
            {pdfGenerating ? "Saving…" : "Save to Print"}
          </button>
        </div>
      </div>
      <p className="no-print text-xs text-warm-gray text-center mt-3 mb-1">
        {letterText.trim() && <><strong className="text-charcoal">Saves 2 PDFs:</strong><br /></>}
        {showPaperFrame
          ? paperType === "letter"
            ? <>Print card on <strong className="text-charcoal">8.5×11 letter paper</strong> — trim along crop marks, fold in half</>
            : <>Print card on <strong className="text-charcoal">{printSize === "5x7" ? "10×7" : "8×6"} card stock</strong> — print at actual size, fold along score</>
          : <>Print card on <strong className="text-charcoal">8.5×11</strong> — print at actual size, fold in half</>
        }
        {letterText.trim() && effectiveMode === "letter" && <><br /><span>Print letter on <strong className="text-charcoal">8.5×11 letter paper</strong> — trim along crop marks, fold, tuck inside card</span></>}
        {letterText.trim() && effectiveMode === "cardstock" && <><br /><span>Print letter — scale to your paper from the PDF app, fold, tuck inside card</span></>}
      </p>

      {/* ── Sheet Previews ── */}
      <div className="print-wrapper max-w-4xl mx-auto px-6 pt-4 pb-8">

        {/* Sheet 1 — Back (left) + Front (right) */}
        <p className="no-print section-label mb-1">
          Page 1 — Outside (back + front)
        </p>
        <div className={showPaperFrame ? `paper-context-framed paper-context-${paperType}` : undefined}>
        <div style={showPaperFrame ? { width: cardWpct, aspectRatio: `${pdfWidthIn} / ${pdfHeightIn}`, position: "relative" as const } : undefined}>
        <div ref={sheet1Ref} className="card-sheet card-sheet-1">
          <div className="card-panel flex flex-col items-center justify-end p-4">
            <NuugeWaxSeal size={58} />
            <p className="text-warm-gray mt-3 pb-4" style={{ fontSize: "1.125rem" }}>Created by Nuuge</p>
          </div>

          <div className="card-panel">
            {card.image_url ? (
              <>
                <img
                  src={card.image_url}
                  alt="Card front"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                    display: "block",
                  }}
                />
                {card.front_text && card.front_text_mode !== "bake" && (
                  <div
                    className="front-text-overlay"
                    style={{
                      position: "absolute",
                      ...ftPosCSS,
                      ...frontFontStyle,
                      ...ftStyleCSSForPrint,
                      width: "96%",
                      fontSize: ftSizeCqw,
                      lineHeight: 1.25,
                      textAlign: frontTextAlign(ftPosition),
                      whiteSpace: "pre-line",
                    }}
                  >
                    {card.front_text}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--color-brand-light)" }}>
                <p className="text-lg font-medium" style={{ color: "var(--color-brand)" }}>{getDisplayOccasion(card)}</p>
              </div>
            )}
          </div>
        </div>
        {showPaperFrame && paperType === "letter" && cropMarks}
        </div>
        </div>

        {/* ── Front cover settings ── */}
        {card.front_text && card.front_text_mode !== "bake" && (
          <div className="no-print rounded-lg p-4 mb-2" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
            <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Front text settings</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-warm-gray mb-1">Position</label>
                <select
                  value={ftPosition}
                  onChange={(e) => { setFtPosition(e.target.value); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  {POSITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Style</label>
                <select
                  value={ftStyle}
                  onChange={(e) => { setFtStyle(e.target.value as TextStyleChoice); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  {TEXT_STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Font</label>
                <select
                  value={ftFont}
                  onChange={(e) => { setFtFont(e.target.value); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  {FONT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Text size</label>
                <select
                  value={ftSizeScale}
                  onChange={(e) => { setFtSizeScale(parseFloat(e.target.value)); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  <option value={0.7}>Small</option>
                  <option value={0.85}>Medium</option>
                  <option value={1}>Auto</option>
                  <option value={1.2}>Large</option>
                  <option value={1.4}>Extra Large</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Sheet 2 — Inside left (blank) + Inside right (message) */}
        <p className="no-print section-label mb-1 mt-4">
          Page 2 — Inside (blank + message)
        </p>
        <div className={showPaperFrame ? `paper-context-framed paper-context-${paperType}` : undefined}>
        <div style={showPaperFrame ? { width: cardWpct, aspectRatio: `${pdfWidthIn} / ${pdfHeightIn}`, position: "relative" as const } : undefined}>
        <div ref={sheet2Ref} className="card-sheet card-sheet-2">
          <div className="card-panel" />

          {/* Inside right — message + illustration */}
          <div
            className="card-panel"
            style={{
              ...messageFontStyle,
              position: "relative",
              display: "flex",
              flexDirection: insidePos === "left" || insidePos === "right" ? "row" : "column",
            }}
          >
            {/* ── Watermark: fills entire panel, text overlays on top ── */}
            {insidePos === "behind" && card.inside_image_url && (
              <img
                src={card.inside_image_url}
                alt=""
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.12,
                  pointerEvents: "none",
                }}
              />
            )}

            {insidePos === "left" && card.inside_image_url && (
              <div style={{ width: "18%", flexShrink: 0, height: "100%" }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {insidePos === "top" && card.inside_image_url && (
              <div style={{ width: "100%", height: "16%", flexShrink: 0 }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            {insidePos === "top_edge_accent" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("top_edge_accent");
              const ao = (card as { accent_opacity?: number }).accent_opacity;
              return slots.includes(1) ? (
                <div style={edgeStyle(1)}>
                  <img src={card.inside_image_url!} alt="" style={edgeImgStyle(ao ?? undefined)} />
                </div>
              ) : null;
            })()}

            {/* Message text — centered, adaptive sizing */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: insidePos === "left" || insidePos === "right"
                  ? "6% 4%"
                  : "8% 10%",
                overflow: "hidden",
                position: "relative",
                zIndex: 1,
                gap: sizing.gap,
              }}
            >
              {insidePos === "middle" && card.inside_image_url && (
                <div style={{ width: "100%", height: "16%", flexShrink: 0 }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.25rem" }} />
                </div>
              )}

              <p
                className="text-charcoal text-center"
                style={{ ...messageFontStyle, fontSize: sizing.greetingSize, fontWeight: 600, lineHeight: 1.3 }}
              >
                {greeting}
              </p>
              {body && (
                <p
                  className="text-charcoal whitespace-pre-wrap text-center"
                  style={{ ...messageFontStyle, fontSize: sizing.bodySize, lineHeight: 1.55 }}
                >
                  {body}
                </p>
              )}
              {closing && (
                <p
                  className="text-charcoal text-center whitespace-pre-line"
                  style={{ ...messageFontStyle, fontSize: sizing.closingSize, fontStyle: "italic", lineHeight: 1.4 }}
                >
                  {closing}
                </p>
              )}
            </div>

            {insidePos === "bottom" && card.inside_image_url && (
              <div style={{ width: "100%", height: "16%", flexShrink: 0 }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {insidePos === "right" && card.inside_image_url && (
              <div style={{ width: "18%", flexShrink: 0, height: "100%" }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            {insidePos === "corner_flourish" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("corner_flourish");
              const ao = (card as { accent_opacity?: number }).accent_opacity;
              return slots.map((slot) => (
                <div key={slot} style={cornerStyle(slot)}>
                  <img src={card.inside_image_url!} alt="" style={cornerImgStyle(ao ?? undefined)} />
                </div>
              ));
            })()}
            {insidePos === "frame" && card.inside_image_url && (
              <img src={card.inside_image_url} alt="" style={frameImgStyle((card as { accent_opacity?: number }).accent_opacity ?? undefined)} />
            )}
            {insidePos === "top_edge_accent" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("top_edge_accent");
              const ao = (card as { accent_opacity?: number }).accent_opacity;
              return slots.includes(2) ? (
                <div style={edgeStyle(2)}>
                  <img src={card.inside_image_url!} alt="" style={edgeImgStyle(ao ?? undefined)} />
                </div>
              ) : null;
            })()}
          </div>
        </div>
        {showPaperFrame && paperType === "letter" && cropMarks}
        </div>
        </div>

        {/* ── Message settings ── */}
        <div className="no-print rounded-lg p-4 mt-2" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
          <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Message settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-warm-gray mb-1">Font</label>
              <select
                value={msgFont}
                onChange={(e) => { setMsgFont(e.target.value); }}
                className="w-full text-sm input-field px-2 py-1.5"
              >
                {FONT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-warm-gray mb-1">Text size</label>
              <select
                value={msgSizeScale}
                onChange={(e) => { setMsgSizeScale(parseFloat(e.target.value)); }}
                className="w-full text-sm input-field px-2 py-1.5"
              >
                {sizeOpts.map((o) => (
                  <option key={o.label} value={o.label === "Auto" ? 0 : o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {card.inside_image_url && (
              <div>
                <label className="block text-xs text-warm-gray mb-1">Decoration position</label>
                <select
                  value={insidePos}
                  onChange={(e) => { setInsidePos(e.target.value as typeof insidePos); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="behind">Behind (watermark)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Sheet 3 — Letter Insert (portrait, single-column) ── */}
        {letterText.trim() && (() => {
          const letterFontStyle = fontCSS((letterFont || "handwritten") as FontChoice);
          const baseFontSize = 0.75 * letterSizeScale;
          const greetingSize = `${(0.85 * letterSizeScale).toFixed(3)}rem`;
          const bodySize = `${baseFontSize.toFixed(3)}rem`;
          const closingSize = `${baseFontSize.toFixed(3)}rem`;
          const parts = letterText.split("\n\n");
          const lGreeting = parts[0] || "";
          const lBody = parts.length > 2 ? parts.slice(1, -1).join("\n\n") : "";
          const lClosing = parts.length > 1 ? parts[parts.length - 1] : "";

          const letterContent = (
            <div
              style={{
                ...letterFontStyle,
                width: "100%",
                height: "100%",
                padding: "8% 10%",
                boxSizing: "border-box" as const,
                position: "relative" as const,
                textAlign: "left" as const,
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, #8b7d6b 28px)", pointerEvents: "none" }} />
              {effectiveMode === "letter" && (
                <div style={{ position: "absolute", left: "10%", right: "10%", top: "50%", height: 0, borderTop: "1px dashed var(--color-light-gray)", pointerEvents: "none", opacity: 0.4 }} />
              )}
              <div style={{ position: "relative", zIndex: 1 }}>
                <p className="text-charcoal" style={{ ...letterFontStyle, fontSize: greetingSize, fontWeight: 500, lineHeight: 1.4, marginBottom: "0.6em" }}>
                  {lGreeting}
                </p>
                {lBody && (
                  <div className="text-charcoal whitespace-pre-wrap" style={{ ...letterFontStyle, fontSize: bodySize, lineHeight: 1.65, marginBottom: "0.6em" }}>
                    {lBody}
                  </div>
                )}
                {lClosing && (
                  <p className="text-charcoal whitespace-pre-line" style={{ ...letterFontStyle, fontSize: closingSize, fontStyle: "italic", lineHeight: 1.5 }}>
                    {lClosing}
                  </p>
                )}
              </div>
            </div>
          );

          return (
            <>
              <p className="no-print section-label mb-1 mt-4">
                {effectiveMode === "letter"
                  ? <>Letter insert on 8.5×11 letter paper — trim along crop marks, fold, tuck inside card</>
                  : <>Letter insert — scale to your paper from the PDF app, fold, tuck inside card</>
                }
              </p>
              {effectiveMode === "letter" && letterNeedsFrame ? (
                <div
                  className="paper-context-framed paper-context-letter"
                  style={{ aspectRatio: "8.5 / 11" }}
                >
                  <div style={{ width: letterWpct, aspectRatio: letterAspect, position: "relative" as const }}>
                    <div ref={sheet3Ref} className="letter-sheet" style={{ aspectRatio: letterAspect }}>
                      {letterContent}
                    </div>
                    {letterCropMarks}
                  </div>
                </div>
              ) : (
                <div ref={sheet3Ref} className="letter-sheet" style={{ aspectRatio: letterAspect }}>
                  {letterContent}
                </div>
              )}

              {/* ── Letter settings ── */}
              <div className="no-print rounded-lg p-4 mt-2" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Letter settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Font</label>
                    <select
                      value={letterFont}
                      onChange={(e) => { setLetterFont(e.target.value); }}
                      className="w-full text-sm input-field px-2 py-1.5"
                    >
                      {FONT_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Text size</label>
                    <select
                      value={letterSizeScale}
                      onChange={(e) => { setLetterSizeScale(parseFloat(e.target.value)); }}
                      className="w-full text-sm input-field px-2 py-1.5"
                    >
                      <option value={0.8}>Small</option>
                      <option value={0.9}>Medium</option>
                      <option value={1}>Auto</option>
                      <option value={1.15}>Large</option>
                      <option value={1.3}>Extra Large</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      </div>

      {!imagesLoaded && imageUrls.length > 0 && (
        <div className="no-print fixed bottom-4 right-4 text-sm px-4 py-2 rounded-lg shadow" style={{ background: "var(--color-amber-light)", color: "var(--color-charcoal)" }}>
          Loading images...
        </div>
      )}

      {showLetterEditor && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowLetterEditor(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4"
            style={{ background: "var(--color-white)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-charcoal mb-1">Personal letter insert</h3>
            <p className="text-sm text-warm-gray mb-4">
              Write a personal note that will print as a separate page tucked inside the card.
            </p>
            <textarea
              value={letterText}
              onChange={(e) => {
                if (e.target.value.length <= letterMaxChars) setLetterText(e.target.value);
              }}
              rows={6}
              maxLength={letterMaxChars}
              placeholder="Dear friend, I wanted to add a personal note..."
              className="input-field rounded-xl w-full text-base"
              style={fontCSS(letterFont as FontChoice)}
            />
            <p className="text-xs text-right mb-3" style={{ color: letterText.length > letterMaxChars * 0.9 ? "var(--color-error)" : "var(--color-warm-gray)" }}>
              {letterMaxChars - letterText.length} characters remaining
            </p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-warm-gray">Font:</span>
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLetterFont(f.id)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    letterFont === f.id
                      ? "border-brand bg-brand-light font-medium"
                      : "border-light-gray hover:border-sage"
                  }`}
                  style={fontCSS(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLetterEditor(false)}
                className="px-4 py-2 text-sm rounded-lg font-medium text-charcoal"
                style={{ border: "1px solid var(--color-light-gray)" }}
              >
                Cancel
              </button>
              {letterText.trim() && (
                <button
                  onClick={() => {
                    setLetterText("");
                    if (card) {
                      updateCard(card.id, { letter_text: null, letter_font: null });
                      setCard({ ...card, letter_text: null, letter_font: null });
                    }
                    setShowLetterEditor(false);
                  }}
                  className="px-4 py-2 text-sm rounded-lg font-medium"
                  style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}
                >
                  Remove letter
                </button>
              )}
              <button
                onClick={() => {
                  if (card) {
                    const updates = {
                      letter_text: letterText.trim() || null,
                      letter_font: letterFont,
                    };
                    updateCard(card.id, updates);
                    setCard({ ...card, ...updates });
                  }
                  setShowLetterEditor(false);
                }}
                className="btn-primary px-4 py-2 text-sm rounded-lg"
              >
                {letterText.trim() ? "Save letter" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            style={{ background: "var(--color-white)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-charcoal mb-2">Delete this card?</h3>
            <p className="text-sm text-warm-gray mb-6">
              This will permanently remove the card and its message. This can&apos;t be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg font-medium text-charcoal"
                style={{ border: "1px solid var(--color-light-gray)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCard(cardId);
                  router.push("/");
                }}
                className="px-4 py-2 text-sm rounded-lg font-medium text-white"
                style={{ background: "var(--color-error)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Use Again modal */}
      {showUseAgain && card && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card-surface rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-charcoal mb-2">Use this image again</h3>
            <p className="text-sm text-warm-gray mb-4">
              Same artwork, fresh message for a new recipient.
            </p>
            <select
              value={useAgainTarget}
              onChange={(e) => setUseAgainTarget(e.target.value)}
              className="w-full input-field rounded-lg px-3 py-2 text-sm mb-4"
            >
              <option value="">Choose recipient…</option>
              {getRecipients()
                .filter((r) => r.id !== card.recipient_id)
                .map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.relationship_type})</option>
                ))}
              <option value="__quick__">Someone not in my circle</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUseAgain(false)}
                className="px-4 py-2 text-sm text-warm-gray hover:text-charcoal"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (useAgainTarget === "__quick__") {
                    router.push(`/cards/create/quick?reuseCardId=${cardId}`);
                  } else {
                    router.push(`/cards/create/${useAgainTarget}?reuseCardId=${cardId}`);
                  }
                }}
                disabled={!useAgainTarget}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

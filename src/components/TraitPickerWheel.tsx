"use client";

import { useRef, useState, useEffect } from "react";

const ITEM_HEIGHT = 48;
const VISIBLE_COUNT = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;

interface TraitPickerWheelProps {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  /** Optional: called when the centered/focused item changes (for description previews) */
  onCenterChange?: (item: string, index: number) => void;
  /** When true and exactly one item is selected, scroll the wheel to center that item (e.g. when user types a match) */
  scrollToSelectedWhenSingle?: boolean;
}

export default function TraitPickerWheel({ items, selected, onToggle, onCenterChange, scrollToSelectedWhenSingle }: TraitPickerWheelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [centerIndex, setCenterIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const rounded = Math.round(scrollTop / ITEM_HEIGHT);
    const next = Math.max(0, Math.min(rounded, items.length - 1));
    setCenterIndex(next);
  }, [scrollTop, items.length]);

  useEffect(() => {
    if (!scrollToSelectedWhenSingle || selected.length !== 1) return;
    const idx = items.indexOf(selected[0]);
    if (idx === -1) return;
    const el = scrollRef.current;
    if (!el) return;
    const targetScrollTop = idx * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetScrollTop) > 2) {
      el.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }, [scrollToSelectedWhenSingle, selected, items]);

  useEffect(() => {
    const centered = items[centerIndex];
    if (centered !== undefined && onCenterChange) {
      onCenterChange(centered, centerIndex);
    }
  }, [centerIndex, items, onCenterChange]);

  const handleItemClick = (item: string) => {
    onToggle(item);
  };

  return (
    <div className="relative rounded-xl overflow-hidden w-full" style={{ border: "1.5px solid var(--color-sage-light)", backgroundColor: "#E8E4DF" }}>
        {/* Center pill — solid, opaque, behind traits; pale sage so it stands out from cream bg */}
        <div
          className="absolute left-2 right-2 pointer-events-none rounded-full"
          style={{
            top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
            height: ITEM_HEIGHT,
            border: "3px solid var(--color-sage)",
            background: "#FFFFFF",
            boxShadow: "0 2px 10px rgba(45,42,38,0.12)",
            zIndex: 0,
          }}
        />
        <div
          ref={scrollRef}
          className="overflow-y-auto overflow-x-hidden snap-y snap-mandatory relative z-10"
          style={{
            height: WHEEL_HEIGHT,
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
          }}
        >
          <div style={{ height: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2, flexShrink: 0 }} />
          {items.map((trait, i) => {
            const itemCenter = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2 + i * ITEM_HEIGHT + ITEM_HEIGHT / 2;
            const viewportCenter = scrollTop + WHEEL_HEIGHT / 2;
            const distance = (itemCenter - viewportCenter) / ITEM_HEIGHT;
            const absDist = Math.abs(distance);

            let opacity = 1;
            let scale = 1;
            let zIndex = 0;
            if (absDist <= 0.5) {
              opacity = 1;
              scale = 1;
              zIndex = 10;
            } else if (absDist <= 1.5) {
              opacity = 0.6;
              scale = 0.92;
              zIndex = 5;
            } else if (absDist <= 2.5) {
              opacity = 0.3;
              scale = 0.82;
              zIndex = 1;
            } else {
              opacity = 0.12;
              scale = 0.72;
              zIndex = 0;
            }

            const isSelected = selected.includes(trait);

            return (
              <div
                key={trait}
                onClick={() => handleItemClick(trait)}
                className="flex items-center justify-center cursor-pointer select-none transition-opacity duration-100 snap-center"
                style={{
                  height: ITEM_HEIGHT,
                  opacity,
                  transform: `scale(${scale})`,
                  zIndex,
                }}
              >
                <span
                  className={`${absDist <= 0.5 ? "text-xl" : "text-base"} font-medium transition-colors ${
                    isSelected ? "text-brand" : "text-charcoal"
                  }`}
                >
                  {trait}
                  {isSelected && " ✓"}
                </span>
              </div>
            );
          })}
          <div style={{ height: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2, flexShrink: 0 }} />
        </div>
    </div>
  );
}

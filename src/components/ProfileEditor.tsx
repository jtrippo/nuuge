"use client";

import { useEffect, useRef, useState } from "react";
import { PERSON_PROFILE_FIELDS, type PersonProfile } from "@/types/database";

interface ProfileEditorProps {
  profile: Partial<PersonProfile>;
  editing: boolean;
  onChange: (updated: Partial<PersonProfile>) => void;
  excludeFields?: (keyof PersonProfile)[];
}

export default function ProfileEditor({
  profile,
  editing,
  onChange,
  excludeFields = [],
}: ProfileEditorProps) {
  const fields = PERSON_PROFILE_FIELDS.filter(
    (f) => !excludeFields.includes(f.key)
  );

  // Local editing buffer — keeps raw strings so commas don't get eaten
  const [editBuf, setEditBuf] = useState<Record<string, string>>({});
  const prevEditing = useRef(false);

  useEffect(() => {
    if (editing && !prevEditing.current) {
      const buf: Record<string, string> = {};
      for (const f of fields) {
        const val = profile[f.key];
        if (Array.isArray(val)) {
          buf[f.key] = val.join(", ");
        } else if (f.key === "mailing_address" && typeof val === "string" && val.includes("|")) {
          buf[f.key] = val.split("|").map((s) => s.trim()).filter(Boolean).join(", ");
        } else {
          buf[f.key] = (val as string) || "";
        }
      }
      setEditBuf(buf);
    }
    prevEditing.current = editing;
    // Sync edit buffer when entering edit mode (use latest profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function getDisplayValue(key: keyof PersonProfile): string {
    const val = profile[key];
    if (Array.isArray(val)) return val.join(", ");
    if (key === "mailing_address" && typeof val === "string" && val.includes("|")) {
      return val.split("|").map((s) => s.trim()).filter(Boolean).join(", ");
    }
    return (val as string) || "";
  }

  function getViewValue(key: keyof PersonProfile, value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    if (key === "mailing_address" && typeof value === "string" && value.includes("|")) {
      return value.split("|").map((s) => s.trim()).filter(Boolean).join(", ");
    }
    return String(value);
  }

  function handleChange(key: keyof PersonProfile, value: string) {
    setEditBuf((prev) => ({ ...prev, [key]: value }));
    onChange({ ...profile, [key]: value || null });
  }

  if (editing) {
    return (
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-charcoal mb-1">
              {field.label}
              {field.type === "tags" && (
                <span className="text-warm-gray font-normal ml-1">(comma-separated)</span>
              )}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={editBuf[field.key] ?? getDisplayValue(field.key)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={field.key === "mailing_address" ? 3 : 2}
                className="w-full input-field rounded-lg"
              />
            ) : (
              <input
                value={editBuf[field.key] ?? getDisplayValue(field.key)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full input-field rounded-lg"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = profile[field.key];
        const isEmpty =
          value === null ||
          value === undefined ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        const displayStr = getViewValue(field.key, value);

        return (
          <div key={field.key}>
            <p className="section-label mb-1">{field.label}</p>
            {isEmpty ? (
              <p className="text-sm text-warm-gray italic">Not set</p>
            ) : Array.isArray(value) ? (
              <div className="flex flex-wrap gap-1.5">
                {value.map((item, i) => (
                  <span
                    key={i}
                    className="text-sm px-2.5 py-1 rounded-full"
                    style={{ background: "var(--color-faint-gray)", color: "var(--color-charcoal)" }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-charcoal">{displayStr}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

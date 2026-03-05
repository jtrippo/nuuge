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
        buf[f.key] = Array.isArray(val) ? val.join(", ") : (val as string) || "";
      }
      setEditBuf(buf);
    }
    prevEditing.current = editing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function getDisplayValue(key: keyof PersonProfile): string {
    const val = profile[key];
    if (Array.isArray(val)) return val.join(", ");
    return (val as string) || "";
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.type === "tags" && (
                <span className="text-gray-400 font-normal ml-1">(comma-separated)</span>
              )}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={editBuf[field.key] ?? getDisplayValue(field.key)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
              />
            ) : (
              <input
                value={editBuf[field.key] ?? getDisplayValue(field.key)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
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

        return (
          <div key={field.key}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              {field.label}
            </p>
            {isEmpty ? (
              <p className="text-sm text-gray-300 italic">Not set</p>
            ) : Array.isArray(value) ? (
              <div className="flex flex-wrap gap-1.5">
                {value.map((item, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700">{value as string}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

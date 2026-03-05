"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile, saveUserProfile } from "@/lib/store";
import ProfileEditor from "@/components/ProfileEditor";
import type { UserProfile, PersonProfile } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [editData, setEditData] = useState<Partial<PersonProfile>>({});
  const [partnerName, setPartnerName] = useState("");
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const p = getUserProfile();
    if (p) {
      setProfile(p);
      setEditData(p);
      setPartnerName(p.partner_name || "");
    }
  }, []);

  if (!mounted) return null;

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white">
        <p className="text-gray-500 mb-4">No profile found.</p>
        <button
          onClick={() => router.push("/onboarding")}
          className="text-indigo-600 font-medium"
        >
          Set up your profile
        </button>
      </div>
    );
  }

  function toTags(val: unknown): string[] {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function handleSave() {
    saveUserProfile({
      ...editData,
      interests: toTags(editData.interests),
      values: toTags(editData.values),
      partner_name: partnerName || null,
    });
    const refreshed = getUserProfile();
    if (refreshed) {
      setProfile(refreshed);
      setEditData(refreshed);
    }
    setEditing(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Dashboard
          </button>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditData(profile);
                    setPartnerName(profile.partner_name || "");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg
                             hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800 px-3 py-1.5"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {!editing && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.display_name || "Your Profile"}
              </h1>
              <p className="text-gray-500">Your Nuuge profile</p>
            </div>
          )}

          <ProfileEditor
            profile={editData}
            editing={editing}
            onChange={setEditData}
          />

          {/* Partner section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Partner / co-signer
            </p>
            {editing ? (
              <div>
                <input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Partner's name (for co-signing cards)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1">
                  If set, you&apos;ll have the option to sign cards from both of you.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-700">
                {profile.partner_name || (
                  <span className="text-gray-300 italic">Not set</span>
                )}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

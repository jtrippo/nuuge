"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile, saveUserProfile, getRecipients, addHouseholdLink, removeHouseholdLink } from "@/lib/store";
import ProfileEditor from "@/components/ProfileEditor";
import AppHeader from "@/components/AppHeader";
import type { UserProfile, PersonProfile, Recipient } from "@/types/database";

const HOUSEHOLD_LABELS = [
  "Spouse", "Partner", "Son", "Daughter", "Child", "Parent", "Sibling", "Other",
];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [editData, setEditData] = useState<Partial<PersonProfile>>({});
  const [partnerName, setPartnerName] = useState("");
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [householdTarget, setHouseholdTarget] = useState("");
  const [householdLabel, setHouseholdLabel] = useState("Spouse");

  useEffect(() => {
    setMounted(true);
    const p = getUserProfile();
    if (p) {
      setProfile(p);
      setEditData(p);
      setPartnerName(p.partner_name || "");
    }
    setAllRecipients(getRecipients().filter((r) => r.setup_complete !== false));
  }, []);

  if (!mounted) return null;

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray mb-4">No profile found.</p>
        <button
          onClick={() => router.push("/onboarding")}
          className="btn-link"
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
    <div className="min-h-screen bg-cream">
      <AppHeader>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Home
        </button>
        <span className="font-medium text-charcoal">My Profile</span>
        <span className="flex-1" />
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData(profile);
                  setPartnerName(profile.partner_name || "");
                }}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-brand text-sm px-4 py-1.5"
              >
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-1.5 rounded-full text-sm font-medium text-warm-gray hover:text-charcoal transition-colors"
              style={{ border: "1.5px solid var(--color-sage)" }}
            >
              Edit profile
            </button>
          )}
        </div>
      </AppHeader>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="card-surface p-6">
          {!editing && (
            <div className="mb-6">
              <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                {profile.display_name || "Your Profile"}
              </h1>
              <p className="text-warm-gray text-sm">Your Nuuge profile</p>
            </div>
          )}

          <ProfileEditor
            profile={editData}
            editing={editing}
            onChange={setEditData}
          />

          {/* Household / co-signers section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                My household
              </p>
              <button
                onClick={() => { setHouseholdTarget(""); setHouseholdLabel("Spouse"); setShowHouseholdModal(true); }}
                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                + Add member
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              People who co-sign cards with you (spouse, children, etc.)
            </p>
            {(!profile.household_links || profile.household_links.length === 0) ? (
              <p className="text-sm text-gray-300 italic">No household members yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.household_links.map((link) => {
                  const r = allRecipients.find((rec) => rec.id === link.recipient_id);
                  if (!r) return null;
                  return (
                    <div key={link.recipient_id} className="flex items-center justify-between rounded-lg px-4 py-2.5" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-charcoal">{r.name}</span>
                        <span className="text-xs text-warm-gray capitalize">({link.label})</span>
                      </div>
                      <button
                        onClick={() => {
                          removeHouseholdLink(link.recipient_id);
                          const refreshed = getUserProfile();
                          if (refreshed) { setProfile(refreshed); setEditData(refreshed); }
                        }}
                        className="text-xs text-warm-gray hover:text-charcoal transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showHouseholdModal && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
              <div className="card-surface rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="text-lg font-semibold text-charcoal mb-4">Add household member</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Person from your circle</label>
                    <select
                      value={householdTarget}
                      onChange={(e) => setHouseholdTarget(e.target.value)}
                      className="w-full input-field rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select a person...</option>
                      {allRecipients
                        .filter((r) => !(profile.household_links || []).some((l) => l.recipient_id === r.id))
                        .map((r) => (
                          <option key={r.id} value={r.id}>{r.name} ({r.relationship_type})</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Relationship to you</label>
                    <select
                      value={householdLabel}
                      onChange={(e) => setHouseholdLabel(e.target.value)}
                      className="w-full input-field rounded-lg px-3 py-2 text-sm"
                    >
                      {HOUSEHOLD_LABELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowHouseholdModal(false)}
                    className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                    style={{ border: "1.5px solid var(--color-sage)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!householdTarget) return;
                      addHouseholdLink(householdTarget, householdLabel);
                      const refreshed = getUserProfile();
                      if (refreshed) { setProfile(refreshed); setEditData(refreshed); }
                      setShowHouseholdModal(false);
                    }}
                    disabled={!householdTarget}
                    className="btn-primary px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

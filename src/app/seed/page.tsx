"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveUserProfile, saveRecipient, getUserProfile, getRecipients, importAllData, type NuugeBackup } from "@/lib/store";
import { SEED_USER, SEED_RECIPIENTS } from "@/lib/seed-data";

export default function SeedPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"ready" | "done">("ready");
  const [statusMessage, setStatusMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const existingProfile = typeof window !== "undefined" ? getUserProfile() : null;
  const existingRecipients = typeof window !== "undefined" ? getRecipients() : [];

  function loadSeedData(clearFirst: boolean) {
    if (clearFirst) {
      localStorage.removeItem("nuuge_user_profile");
      localStorage.removeItem("nuuge_recipients");
      localStorage.removeItem("nuuge_onboarding_history");
    }
    saveUserProfile(SEED_USER);
    for (const r of SEED_RECIPIENTS) {
      saveRecipient(r);
    }
    setStatusMessage("Seed data loaded.");
    setStatus("done");
  }

  function clearAll() {
    localStorage.removeItem("nuuge_user_profile");
    localStorage.removeItem("nuuge_recipients");
    localStorage.removeItem("nuuge_onboarding_history");
    localStorage.removeItem("nuuge_cards");
    setStatusMessage("All data cleared.");
    setStatus("done");
  }

  async function handleRestoreFromBackup(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as NuugeBackup;

      if (!data.version || !data.exportedAt) {
        throw new Error("This doesn't look like a Nuuge backup file.");
      }

      await importAllData(data);

      const recipientCount = data.recipients?.length ?? 0;
      const cardCount = data.cards?.length ?? 0;
      const imageCount = Object.keys(data.images ?? {}).length;
      setStatusMessage(
        `Restored from ${new Date(data.exportedAt).toLocaleDateString()}: ` +
        `${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}, ` +
        `${cardCount} card${cardCount !== 1 ? "s" : ""}, ` +
        `${imageCount} image${imageCount !== 1 ? "s" : ""}.`
      );
      setStatus("done");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#9989;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Done</h1>
          {statusMessage && (
            <p className="text-sm text-gray-600 mb-6">{statusMessage}</p>
          )}
          <button
            onClick={() => router.push("/")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-50 to-white px-4">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Data Manager
        </h1>
        <p className="text-sm text-gray-500 mb-8 text-center">
          Restore from a backup, load seed data, or clear everything.
        </p>

        {existingProfile?.onboarding_complete && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-sm">
            <p className="font-medium text-gray-800 mb-1">Current state:</p>
            <p className="text-gray-600">
              Profile: {existingProfile.display_name || "unnamed"} &middot;{" "}
              {existingRecipients.length} recipient{existingRecipients.length !== 1 ? "s" : ""}
              {existingRecipients.length > 0 && (
                <span className="text-gray-400">
                  {" "}({existingRecipients.map((r) => r.name).join(", ")})
                </span>
              )}
            </p>
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRestoreFromBackup(file);
          }}
          className="hidden"
        />

        <div className="space-y-3">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors text-left disabled:opacity-50"
          >
            <span className="block text-base">
              {importing ? "Restoring..." : "Restore from backup file"}
            </span>
            <span className="block text-sm text-indigo-200 mt-1">
              Load all profiles, recipients, cards, and images from a .json backup
            </span>
          </button>

          <button
            onClick={() => loadSeedData(true)}
            className="w-full bg-white text-gray-800 border border-gray-200 px-6 py-4 rounded-xl
                       font-medium hover:border-indigo-300 transition-colors text-left"
          >
            <span className="block text-base">Load seed data (fresh start)</span>
            <span className="block text-sm text-gray-500 mt-1">
              Clears everything, loads demo profile + demo recipients
            </span>
          </button>

          <button
            onClick={() => loadSeedData(false)}
            className="w-full bg-white text-gray-800 border border-gray-200 px-6 py-4 rounded-xl
                       font-medium hover:border-indigo-300 transition-colors text-left"
          >
            <span className="block text-base">Add seed data (keep existing)</span>
            <span className="block text-sm text-gray-500 mt-1">
              Adds demo data without clearing your current data
            </span>
          </button>

          <button
            onClick={clearAll}
            className="w-full bg-white text-red-600 border border-red-200 px-6 py-4 rounded-xl
                       font-medium hover:border-red-400 transition-colors text-left"
          >
            <span className="block text-base">Clear all data</span>
            <span className="block text-sm text-red-300 mt-1">
              Removes everything — profile, recipients, cards, history
            </span>
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Cancel — go back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

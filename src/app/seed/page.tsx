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
      <div
        className="flex flex-col items-center justify-center h-screen px-4"
        style={{ background: "var(--color-cream)" }}
      >
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#9989;</div>
          <h1 className="text-2xl font-semibold text-charcoal mb-3">Done</h1>
          {statusMessage && (
            <p className="text-sm text-warm-gray mb-6">{statusMessage}</p>
          )}
          <button
            onClick={() => router.push("/")}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-screen px-4"
      style={{ background: "var(--color-cream)" }}
    >
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-semibold text-charcoal mb-2 text-center">
          Data Manager
        </h1>
        <p className="text-sm text-warm-gray mb-8 text-center">
          Restore from a backup, load seed data, or clear everything.
        </p>

        {existingProfile?.onboarding_complete && (
          <div className="card-surface p-4 mb-6 text-sm">
            <p className="font-medium text-charcoal mb-1">Current state:</p>
            <p className="text-warm-gray">
              Profile: {existingProfile.display_name || "unnamed"} &middot;{" "}
              {existingRecipients.length} recipient{existingRecipients.length !== 1 ? "s" : ""}
              {existingRecipients.length > 0 && (
                <span className="text-warm-gray opacity-60">
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
            className="w-full btn-primary px-6 py-4 text-left disabled:opacity-50"
          >
            <span className="block text-base">
              {importing ? "Restoring..." : "Restore from backup file"}
            </span>
            <span className="block text-sm mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
              Load all profiles, recipients, cards, and images from a .json backup
            </span>
          </button>

          <button
            onClick={() => loadSeedData(true)}
            className="w-full card-surface card-surface-clickable px-6 py-4 text-left"
          >
            <span className="block text-base font-medium text-charcoal">Load seed data (fresh start)</span>
            <span className="block text-sm text-warm-gray mt-1">
              Clears everything, loads demo profile + demo recipients
            </span>
          </button>

          <button
            onClick={() => loadSeedData(false)}
            className="w-full card-surface card-surface-clickable px-6 py-4 text-left"
          >
            <span className="block text-base font-medium text-charcoal">Add seed data (keep existing)</span>
            <span className="block text-sm text-warm-gray mt-1">
              Adds demo data without clearing your current data
            </span>
          </button>

          <button
            onClick={clearAll}
            className="w-full px-6 py-4 rounded-xl font-medium text-left transition-colors"
            style={{ background: "var(--color-error-light)", border: "1.5px solid var(--color-error)", color: "var(--color-error)" }}
          >
            <span className="block text-base">Clear all data</span>
            <span className="block text-sm mt-1 opacity-60">
              Removes everything — profile, recipients, cards, history
            </span>
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full text-center text-sm text-warm-gray hover:text-charcoal py-2 transition-colors"
          >
            Cancel — go back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { exportAllData, importAllData, type NuugeBackup } from "@/lib/store";
import { backfillToSupabase } from "@/lib/usage-store";

export default function BackupPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setStatus(null);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `nuuge-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const recipientCount = data.recipients?.length ?? 0;
      const cardCount = data.cards?.length ?? 0;
      const imageCount = Object.keys(data.images ?? {}).length;
      const usageCount = data.usageEvents?.length ?? 0;
      setStatus(
        `Exported: ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}, ` +
        `${cardCount} card${cardCount !== 1 ? "s" : ""}, ` +
        `${imageCount} image${imageCount !== 1 ? "s" : ""}, ` +
        `${usageCount} usage event${usageCount !== 1 ? "s" : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setError(null);
    setStatus(null);
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
      const usageCount = data.usageEvents?.length ?? 0;
      setStatus(
        `Restored from ${new Date(data.exportedAt).toLocaleDateString()}: ` +
        `${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}, ` +
        `${cardCount} card${cardCount !== 1 ? "s" : ""}, ` +
        `${imageCount} image${imageCount !== 1 ? "s" : ""}, ` +
        `${usageCount} usage event${usageCount !== 1 ? "s" : ""}. ` +
        `Refresh the page or navigate away to see your data.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 py-16"
      style={{ background: "var(--color-cream)" }}
    >
      <div className="max-w-md w-full">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-warm-gray hover:text-charcoal mb-8 transition-colors"
        >
          &larr; Home
        </button>

        <h1 className="text-2xl font-semibold text-charcoal mb-2">
          Backup &amp; Restore
        </h1>
        <p className="text-sm text-warm-gray mb-8">
          Save all your profiles, recipients, cards, and images to a file.
          Restore them any time — after a reboot, on a new browser, or on another computer.
        </p>

        {/* Export */}
        <div className="card-surface p-5 mb-4">
          <h2 className="text-sm font-semibold text-charcoal mb-1">
            Export everything
          </h2>
          <p className="text-xs text-warm-gray mb-4">
            Downloads a .json file with all your data. Keep it somewhere safe.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full btn-primary"
          >
            {exporting ? "Exporting..." : "Download backup"}
          </button>
        </div>

        {/* Import */}
        <div className="card-surface p-5 mb-4">
          <h2 className="text-sm font-semibold text-charcoal mb-1">
            Restore from backup
          </h2>
          <p className="text-xs text-warm-gray mb-4">
            Load a previously exported backup file. This will add the data back
            (existing data with the same IDs will be overwritten).
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
            className="hidden"
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            className="w-full btn-secondary"
          >
            {importing ? "Restoring..." : "Choose backup file"}
          </button>
        </div>

        {/* Sync usage to Supabase */}
        <div className="card-surface p-5 mb-4">
          <h2 className="text-sm font-semibold text-charcoal mb-1">
            Sync usage data
          </h2>
          <p className="text-xs text-warm-gray mb-4">
            Push all usage events from this browser to Supabase so they&apos;re
            saved permanently and visible across users.
          </p>
          <button
            onClick={async () => {
              setSyncing(true);
              setError(null);
              setStatus(null);
              try {
                const count = await backfillToSupabase();
                setStatus(`Synced ${count} usage event${count !== 1 ? "s" : ""} to Supabase.`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sync failed");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="w-full btn-secondary"
          >
            {syncing ? "Syncing..." : "Sync to Supabase"}
          </button>
        </div>

        {/* Status / Error */}
        {status && (
          <div
            className="rounded-xl p-4 text-sm mb-4"
            style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage-light)", color: "var(--color-brand)" }}
          >
            {status}
          </div>
        )}
        {error && (
          <div
            className="rounded-xl p-4 text-sm mb-4"
            style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}
          >
            {error}
          </div>
        )}

        <p className="text-xs text-warm-gray mt-6 text-center">
          Tip: Export after every testing session so you never lose your work.
        </p>
      </div>
    </div>
  );
}

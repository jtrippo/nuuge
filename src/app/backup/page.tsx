"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { exportAllData, importAllData, type NuugeBackup } from "@/lib/store";

export default function BackupPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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
      setStatus(
        `Exported: ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}, ` +
        `${cardCount} card${cardCount !== 1 ? "s" : ""}, ` +
        `${imageCount} image${imageCount !== 1 ? "s" : ""}.`
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
      setStatus(
        `Restored from ${new Date(data.exportedAt).toLocaleDateString()}: ` +
        `${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}, ` +
        `${cardCount} card${cardCount !== 1 ? "s" : ""}, ` +
        `${imageCount} image${imageCount !== 1 ? "s" : ""}. ` +
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center px-6 py-16">
      <div className="max-w-md w-full">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-gray-500 hover:text-gray-700 mb-8"
        >
          &larr; Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Backup &amp; Restore
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Save all your profiles, recipients, cards, and images to a file.
          Restore them any time — after a reboot, on a new browser, or on another computer.
        </p>

        {/* Export */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">
            Export everything
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Downloads a .json file with all your data. Keep it somewhere safe.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Download backup"}
          </button>
        </div>

        {/* Import */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">
            Restore from backup
          </h2>
          <p className="text-xs text-gray-500 mb-4">
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
            className="w-full bg-white border border-indigo-200 text-indigo-600 py-3 rounded-xl
                       font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {importing ? "Restoring..." : "Choose backup file"}
          </button>
        </div>

        {/* Status / Error */}
        {status && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 mb-4">
            {status}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6 text-center">
          Tip: Export after every testing session so you never lose your work.
        </p>
      </div>
    </div>
  );
}

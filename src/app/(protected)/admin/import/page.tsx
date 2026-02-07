"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Pre-loaded CSV URL
const CSV_URL = "https://docs.google.com/spreadsheets/d/1LSCyKkPhlivzKaq6RjuAmH7enfF_t-eCnzicmCCrCbM/export?format=csv&gid=381649560";

export default function ImportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImport = async () => {
    if (!confirm("⚠️ This will DELETE all existing tasks and notes, then import fresh data from your Google Sheet. Continue?")) {
      return;
    }

    setLoading(true);
    setStatus("Fetching CSV from Google Sheets...");

    try {
      // Fetch CSV
      const csvResponse = await fetch(CSV_URL);
      if (!csvResponse.ok) {
        throw new Error("Failed to fetch CSV from Google Sheets");
      }
      const csvData = await csvResponse.text();
      setStatus(`Fetched ${csvData.split('\\n').length} rows. Starting import...`);

      // Call import API
      const importResponse = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData, confirm: true }),
      });

      const data = await importResponse.json();

      if (!importResponse.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      setStatus("✅ Import complete!");
      
      // Refresh after 2 seconds
      setTimeout(() => router.push("/"), 2000);

    } catch (error) {
      setStatus(`❌ Error: ${error}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6">Import from Google Sheet</h1>
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-amber-800 mb-2">⚠️ Warning</h3>
        <p className="text-amber-700 text-sm">
          This will <strong>DELETE ALL existing tasks and notes</strong> and replace them with data from your Google Sheet (Hit List tab).
        </p>
      </div>

      <div className="bg-slate-100 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-600 mb-2">
          <strong>Source:</strong> Build Management - UP.FIT Skydio Trailer and LVMPD 10
        </p>
        <p className="text-sm text-slate-600">
          <strong>Tab:</strong> Hit List
        </p>
      </div>

      <button
        onClick={handleImport}
        disabled={loading}
        className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition"
      >
        {loading ? "Importing..." : "🗑️ Wipe & Import"}
      </button>

      {status && (
        <div className="mt-6 p-4 bg-slate-800 text-slate-100 rounded-lg font-mono text-sm">
          {status}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h3 className="font-semibold text-emerald-800 mb-2">Import Results</h3>
          <ul className="text-sm text-emerald-700">
            <li>✓ {result.stats?.projects || 0} projects</li>
            <li>✓ {result.stats?.tasks || 0} tasks</li>
            <li>✓ {result.stats?.notes || 0} notes</li>
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BugReport = {
  id: string;
  type: "bug" | "feature_request";
  description: string;
  status: string;
  resolution: string | null;
  screenshot_url: string | null;
  created_at: string;
  fixed_at: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; pulse?: boolean }> = {
  pending: { label: "Submitted", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", icon: "📩" },
  analyzing: { label: "AI Analyzing", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: "🔍", pulse: true },
  fixing: { label: "AI Fixing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: "🔧", pulse: true },
  deployed: { label: "Fix Deployed", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", icon: "🚀" },
  fixed: { label: "Verified", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: "✅" },
  wont_fix: { label: "Won't Fix", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300", icon: "⏭️" },
  reviewing: { label: "Under Review", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: "👀" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.color}`}>
      <span>{config.icon}</span>
      <span className={config.pulse ? "animate-pulse" : ""}>{config.label}</span>
    </span>
  );
}

function StatusTimeline({ status }: { status: string }) {
  const bugSteps = ["pending", "analyzing", "fixing", "deployed", "fixed"];
  const currentIdx = bugSteps.indexOf(status);

  return (
    <div className="flex items-center gap-1 mt-2">
      {bugSteps.map((step, i) => {
        const config = STATUS_CONFIG[step];
        const isComplete = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                isCurrent ? "w-3 h-3 bg-teal-500 ring-2 ring-teal-200 dark:ring-teal-800" :
                isComplete ? "bg-teal-400" : "bg-slate-200 dark:bg-slate-600"
              }`}
              title={config.label}
            />
            {i < bugSteps.length - 1 && (
              <div className={`w-6 h-0.5 ${isComplete && i < currentIdx ? "bg-teal-400" : "bg-slate-200 dark:bg-slate-600"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VerifyButton({ reportId, onVerified }: { reportId: string; onVerified: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (works: boolean) => {
    setLoading(true);
    await fetch(`/api/bugs/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: works ? "fixed" : "pending",
        resolution: works ? "Verified by reporter" : null,
      }),
    });
    setLoading(false);
    setConfirming(false);
    onVerified();
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="mt-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 transition"
      >
        🧪 Verify Fix
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">Does the fix work?</span>
      <button
        onClick={() => handleVerify(true)}
        disabled={loading}
        className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
      >
        ✅ Yes
      </button>
      <button
        onClick={() => handleVerify(false)}
        disabled={loading}
        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
      >
        ❌ No, still broken
      </button>
    </div>
  );
}

export default function MyReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bug_reports")
      .select("id, type, description, status, resolution, screenshot_url, created_at, fixed_at")
      .eq("reported_by", user.id)
      .order("created_at", { ascending: false });

    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
    // Poll for status updates every 15s
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Reports</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Track the status of your bug reports and feature requests. Bugs are automatically analyzed and fixed by AI.
      </p>

      {reports.length === 0 ? (
        <div className="mt-12 text-center text-slate-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">No reports yet. Use the 🐛 button to submit feedback.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400">
                      {report.type === "bug" ? "🐛" : "💡"}
                    </span>
                    <StatusBadge status={report.status} />
                    <span className="text-[10px] text-slate-400">
                      {new Date(report.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {report.description}
                  </p>
                  {report.resolution && (
                    <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold">Resolution:</span> {report.resolution}
                    </div>
                  )}
                  {report.type === "bug" && <StatusTimeline status={report.status} />}
                  {report.status === "deployed" && (
                    <VerifyButton reportId={report.id} onVerified={fetchReports} />
                  )}
                </div>
                {report.screenshot_url && (
                  <a href={report.screenshot_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.screenshot_url}
                      alt="Screenshot"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0"
                    />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

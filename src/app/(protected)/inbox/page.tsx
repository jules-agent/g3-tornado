"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type BugReport = {
  id: string;
  type: "bug" | "feature_request" | "tagline_downvote";
  description: string;
  status: string;
  resolution: string | null;
  screenshot_url: string | null;
  created_at: string;
  fixed_at: string | null;
  reported_by: string;
  reported_by_email: string | null;
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

const CLOSED_STATUSES = ["fixed", "wont_fix"];

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
      body: JSON.stringify({ status: works ? "fixed" : "pending", resolution: works ? "Verified by reporter" : null }),
    });
    setLoading(false);
    setConfirming(false);
    onVerified();
  };
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="mt-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 transition">
        🧪 Verify Fix
      </button>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">Does the fix work?</span>
      <button onClick={() => handleVerify(true)} disabled={loading} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50">✅ Yes</button>
      <button onClick={() => handleVerify(false)} disabled={loading} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50">❌ No, still broken</button>
    </div>
  );
}

// Read state helpers (localStorage)
function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem("inbox_read_ids");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markAsRead(ids: string[]) {
  const current = getReadIds();
  ids.forEach(id => current.add(id));
  localStorage.setItem("inbox_read_ids", JSON.stringify([...current]));
}

export default function InboxPage() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // Admin sections
  const [newUsers, setNewUsers] = useState<{ id: string; email: string; full_name: string | null; created_at: string; owner_id: string | null }[]>([]);
  const [newContacts, setNewContacts] = useState<{ id: string; name: string; created_by_email: string | null; created_at: string }[]>([]);
  const [taglineVotes, setTaglineVotes] = useState<{ id: string; tagline: string; vote: string; user_email: string | null; created_at: string }[]>([]);

  const fetchReports = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Check admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const admin = profile?.role === "admin";
    setIsAdmin(admin);

    // Admin sees all, user sees own
    let query = supabase
      .from("bug_reports")
      .select("id, type, description, status, resolution, screenshot_url, created_at, fixed_at, reported_by, reported_by_email")
      .order("created_at", { ascending: false });

    if (!admin) {
      query = query.eq("reported_by", user.id);
    }

    const { data } = await query;
    setReports(data || []);
    setReadIds(getReadIds());

    // Admin: fetch extra sections
    if (admin) {
      // New users (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: users } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, owner_id")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });
      setNewUsers(users || []);

      // New contacts (last 30 days, user-created)
      const { data: contacts } = await supabase
        .from("owners")
        .select("id, name, created_by_email, created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });
      setNewContacts(contacts || []);

      // Tagline votes (last 30 days)
      const { data: votes } = await supabase
        .from("tagline_votes")
        .select("id, tagline, vote, user_email, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setTaglineVotes(votes || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  const handleMarkAllRead = () => {
    const ids = reports.map(r => r.id);
    markAsRead(ids);
    setReadIds(getReadIds());
  };

  const handleMarkRead = (id: string) => {
    markAsRead([id]);
    setReadIds(new Set(getReadIds()));
  };

  // Admin actions
  const handleMarkComplete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("bug_reports").update({ status: "fixed", resolution: "Marked complete by admin", fixed_at: new Date().toISOString() }).eq("id", id);
    markAsRead([id]);
    fetchReports();
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject and remove this report?")) return;
    const supabase = createClient();
    await supabase.from("bug_reports").delete().eq("id", id);
    fetchReports();
  };

  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);

  const handleSendResponse = async (reportId: string) => {
    if (!responseText.trim()) return;
    setSendingResponse(true);
    // Save response as resolution on the report
    const supabase = createClient();
    const report = reports.find(r => r.id === reportId);
    await supabase.from("bug_reports").update({
      resolution: responseText.trim(),
      status: "reviewing",
    }).eq("id", reportId);
    
    // Send to Jules (iMessage) for relay to Ben
    await fetch("/api/admin/respond-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId,
        reportDescription: report?.description,
        reporterEmail: report?.reported_by_email,
        response: responseText.trim(),
      }),
    }).catch(() => {}); // Best effort

    markAsRead([reportId]);
    setRespondingTo(null);
    setResponseText("");
    setSendingResponse(false);
    fetchReports();
  };

  const openReports = reports.filter(r => !CLOSED_STATUSES.includes(r.status));
  const closedReports = reports.filter(r => CLOSED_STATUSES.includes(r.status));
  const unreadCount = reports.filter(r => !readIds.has(r.id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">📬 Inbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin ? "All user submissions" : "Your submitted reports and requests"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            ✓ Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="mt-12 text-center text-slate-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">Inbox empty. Use the 🐛 button to submit feedback.</p>
        </div>
      ) : (
        <>
          {/* Bug Reports / Feature Requests Section */}
          <div className="mt-6">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Bug Reports / Feature Requests
            </h2>

            {/* Open */}
            {openReports.length > 0 && (
              <div className="space-y-3 mb-6">
                {openReports.map((report) => {
                  const isUnread = !readIds.has(report.id);
                  return (
                    <div
                      key={report.id}
                      onClick={() => handleMarkRead(report.id)}
                      className={`rounded-xl border p-4 shadow-sm cursor-pointer transition ${
                        isUnread
                          ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            <span className="text-xs">{report.type === "bug" ? "🐛" : report.type === "tagline_downvote" ? "👎" : "💡"}</span>
                            <StatusBadge status={report.status} />
                            {isAdmin && report.reported_by_email && (
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-0.5">
                                {report.reported_by_email}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {new Date(report.created_at).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{report.description}</p>
                          {report.resolution && (
                            <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-semibold">Resolution:</span> {report.resolution}
                            </div>
                          )}
                          {report.type === "bug" && <StatusTimeline status={report.status} />}
                          {report.status === "deployed" && report.reported_by === userId && (
                            <VerifyButton reportId={report.id} onVerified={fetchReports} />
                          )}

                          {/* Admin Actions */}
                          {isAdmin && (
                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                              {respondingTo === report.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    placeholder="Type your response..."
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSendResponse(report.id)}
                                      disabled={sendingResponse || !responseText.trim()}
                                      className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40 transition"
                                    >
                                      {sendingResponse ? "Sending..." : "Send Response"}
                                    </button>
                                    <button
                                      onClick={() => { setRespondingTo(null); setResponseText(""); }}
                                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {report.type === "tagline_downvote" ? (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const supabase = createClient();
                                        await supabase.from("bug_reports").update({ status: "rejected" }).eq("id", report.id);
                                        markAsRead([report.id]);
                                        fetchReports();
                                      }}
                                      className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
                                    >
                                      🔄 Restore To Rotation
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMarkComplete(report.id); }}
                                      className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                                    >
                                      ✅ Complete
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleReject(report.id); }}
                                    className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                                  >
                                    ❌ Reject
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRespondingTo(report.id); }}
                                    className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                                  >
                                    💬 Respond
                                  </button>
                                  {!readIds.has(report.id) && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMarkRead(report.id); }}
                                      className="rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                                    >
                                      👁 Mark Read
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {report.screenshot_url && (
                          <a href={report.screenshot_url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={report.screenshot_url} alt="Screenshot" className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Closed */}
            {closedReports.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-6">Closed</h3>
                <div className="space-y-2 opacity-60">
                  {closedReports.map((report) => (
                    <div
                      key={report.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs">{report.type === "bug" ? "🐛" : report.type === "tagline_downvote" ? "👎" : "💡"}</span>
                        <StatusBadge status={report.status} />
                        {isAdmin && report.reported_by_email && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-0.5">
                            {report.reported_by_email}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-through">{report.description}</p>
                      {report.resolution && (
                        <p className="text-xs text-slate-400 mt-1">✓ {report.resolution}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Admin-only sections */}
          {isAdmin && (
            <>
              {/* New User Signups */}
              {newUsers.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    👤 New User Signups
                  </h2>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <th className="px-4 py-2">User</th>
                          <th className="px-4 py-2">Linked Owner</th>
                          <th className="px-4 py-2">Signed Up</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {newUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-slate-900 dark:text-white">{u.full_name || "—"}</span>
                              <span className="text-xs text-slate-400 ml-2">{u.email}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              {u.owner_id ? (
                                <span className="text-xs text-emerald-600 font-semibold">✅ Linked</span>
                              ) : (
                                <span className="text-xs text-amber-600 font-semibold">⚠️ Not linked</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">
                              {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* New Contacts (user-created) */}
              {newContacts.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    📇 New Contacts
                  </h2>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <th className="px-4 py-2">Contact Name</th>
                          <th className="px-4 py-2">Created By</th>
                          <th className="px-4 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {newContacts.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{c.created_by_email || "System"}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">
                              {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tagline Votes */}
              {taglineVotes.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    🗳️ Daily Motto Votes
                  </h2>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <th className="px-4 py-2">Motto</th>
                          <th className="px-4 py-2">Vote</th>
                          <th className="px-4 py-2">User</th>
                          <th className="px-4 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {taglineVotes.map(v => (
                          <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white text-xs">{v.tagline}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-sm ${v.vote === "up" ? "" : ""}`}>
                                {v.vote === "up" ? "👍" : "👎"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{v.user_email?.split("@")[0] || "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">
                              {new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

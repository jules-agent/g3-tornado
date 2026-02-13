"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type UserScore = {
  name: string;
  ownerId: string;
  isMe: boolean;
  tasksCompleted: number;
  tasksOverdue: number;
  tasksOnTrack: number;
  totalOpen: number;
  reliabilityScore: number; // 0-100
  avgDaysToAct: number;
  streak: number; // consecutive days with movement
  level: string;
  levelEmoji: string;
  rank: number;
};

function getLevel(score: number): { level: string; emoji: string } {
  if (score >= 95) return { level: "Tornado", emoji: "🌪️" };
  if (score >= 85) return { level: "Lightning", emoji: "⚡" };
  if (score >= 75) return { level: "Storm", emoji: "🌩️" };
  if (score >= 60) return { level: "Wind", emoji: "💨" };
  if (score >= 40) return { level: "Breeze", emoji: "🍃" };
  return { level: "Calm", emoji: "☁️" };
}

function getMotivation(score: number): string {
  if (score >= 95) return "Absolute machine. Nothing gets past you.";
  if (score >= 85) return "Crushing it! Keep this energy.";
  if (score >= 75) return "Solid work. A few tweaks and you're elite.";
  if (score >= 60) return "Good foundation. Let's tighten up those overdue items.";
  if (score >= 40) return "Room to grow. Focus on your daily actions list.";
  return "Let's get moving! Check your 📋 Actions list.";
}

function getRankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function Scorecard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [scores, setScores] = useState<UserScore[]>([]);
  const [myScore, setMyScore] = useState<UserScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<"me" | "team">("me");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("owner_id, role").eq("id", user.id).maybeSingle();
      const admin = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";
      setIsAdmin(admin);
      const userOwnerId = profile?.owner_id;

      // Fetch all tasks with owners and notes
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id, status, fu_cadence_days, last_movement_at, created_at,
          task_owners (owner_id, owners (id, name, is_third_party_vendor, is_up_employee, is_bp_employee, is_upfit_employee, is_bpas_employee)),
          task_notes (created_at)
        `)
        .order("created_at");

      if (!tasks) { setLoading(false); return; }

      // Build per-owner stats
      const ownerStats = new Map<string, {
        name: string;
        completed: number;
        overdue: number;
        onTrack: number;
        totalOpen: number;
        totalTasks: number;
        withinCadence: number;
        totalDaysToAct: number;
        actCount: number;
        recentMovementDays: Set<string>;
      }>();

      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      for (const task of tasks as any[]) {
        const owners = task.task_owners || [];
        const daysSinceMovement = Math.floor(
          (now - new Date(task.last_movement_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const isOverdue = task.status === "open" && daysSinceMovement > task.fu_cadence_days;
        const completedThisWeek = task.status === "closed" && new Date(task.last_movement_at).getTime() > oneWeekAgo;

        for (const to of owners) {
          const ownerId = to.owner_id;
          const ownerName = to.owners?.name || "Unknown";
          if (!ownerId) continue;

          // FILTER: Exclude 3rd party vendors from team leaderboard (internal staff only)
          const owner = to.owners;
          const isVendor = owner?.is_third_party_vendor === true;
          const hasEmployeeFlag = owner?.is_up_employee || owner?.is_bp_employee || owner?.is_upfit_employee || owner?.is_bpas_employee;
          // Skip vendors unless they also have an employee flag
          if (isVendor && !hasEmployeeFlag) continue;

          if (!ownerStats.has(ownerId)) {
            ownerStats.set(ownerId, {
              name: ownerName,
              completed: 0,
              overdue: 0,
              onTrack: 0,
              totalOpen: 0,
              totalTasks: 0,
              withinCadence: 0,
              totalDaysToAct: 0,
              actCount: 0,
              recentMovementDays: new Set(),
            });
          }

          const stats = ownerStats.get(ownerId)!;
          stats.totalTasks++;

          if (completedThisWeek) stats.completed++;
          if (task.status === "open") {
            stats.totalOpen++;
            if (isOverdue) {
              stats.overdue++;
            } else {
              stats.onTrack++;
              stats.withinCadence++;
            }
          } else {
            stats.withinCadence++; // closed = handled
          }

          // Track days with movement (for streak)
          if (task.task_notes) {
            for (const note of task.task_notes) {
              const noteDate = new Date(note.created_at).toISOString().split("T")[0];
              if (new Date(note.created_at).getTime() > now - 30 * 24 * 60 * 60 * 1000) {
                stats.recentMovementDays.add(noteDate);
              }
            }
          }

          stats.totalDaysToAct += daysSinceMovement;
          stats.actCount++;
        }
      }

      // Calculate scores
      const allScores: UserScore[] = [];
      for (const [ownerId, stats] of ownerStats) {
        if (stats.totalTasks === 0) continue;

        const reliability = stats.totalTasks > 0
          ? Math.round((stats.withinCadence / stats.totalTasks) * 100)
          : 100;
        const avgDays = stats.actCount > 0 ? Math.round(stats.totalDaysToAct / stats.actCount) : 0;

        // Calculate streak (consecutive days with movement, counting back from today)
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          const dateStr = checkDate.toISOString().split("T")[0];
          if (stats.recentMovementDays.has(dateStr)) {
            streak++;
          } else if (i > 0) { // allow today to not have movement yet
            break;
          }
        }

        const { level, emoji } = getLevel(reliability);

        allScores.push({
          name: stats.name,
          ownerId,
          isMe: ownerId === userOwnerId,
          tasksCompleted: stats.completed,
          tasksOverdue: stats.overdue,
          tasksOnTrack: stats.onTrack,
          totalOpen: stats.totalOpen,
          reliabilityScore: reliability,
          avgDaysToAct: avgDays,
          streak,
          level,
          levelEmoji: emoji,
          rank: 0,
        });
      }

      // Sort by reliability score and assign ranks
      allScores.sort((a, b) => b.reliabilityScore - a.reliabilityScore || a.tasksOverdue - b.tasksOverdue);
      allScores.forEach((s, i) => { s.rank = i + 1; });

      setScores(allScores);
      setMyScore(allScores.find(s => s.isMe) || null);
      setLoading(false);
    };

    fetchData();
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 overflow-y-auto" style={{ isolation: "isolate" }}>
      <style>{`body { overflow: hidden !important; }`}</style>

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Scorecard</h1>
            <p className="text-xs text-slate-500">This week&apos;s performance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
              <button
                onClick={() => setView("me")}
                className={`px-3 py-1.5 font-semibold transition ${view === "me" ? "bg-teal-500 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                My Score
              </button>
              <button
                onClick={() => setView("team")}
                className={`px-3 py-1.5 font-semibold transition ${view === "team" ? "bg-teal-500 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                Team
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : view === "me" && myScore ? (
          /* ===== PERSONAL SCORECARD ===== */
          <div className="space-y-6">
            {/* Hero card */}
            <div className="text-center py-8">
              <div className="text-6xl mb-3">{myScore.levelEmoji}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                {myScore.reliabilityScore}%
              </div>
              <div className="text-sm font-semibold text-slate-500 mb-1">Reliability Score</div>
              <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs font-bold uppercase tracking-wide">
                {myScore.levelEmoji} {myScore.level} Level
              </div>
              <p className="mt-3 text-sm text-slate-500 max-w-sm mx-auto italic">
                &ldquo;{getMotivation(myScore.reliabilityScore)}&rdquo;
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Completed" value={myScore.tasksCompleted} emoji="✅" sublabel="this week" color="green" />
              <StatCard label="On Track" value={myScore.tasksOnTrack} emoji="🟢" sublabel="within cadence" color="teal" />
              <StatCard label="Overdue" value={myScore.tasksOverdue} emoji="🔴" sublabel="need attention" color="red" />
              <StatCard label="Streak" value={myScore.streak} emoji="🔥" sublabel={myScore.streak === 1 ? "day" : "days"} color="amber" />
            </div>

            {/* Progress bar */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reliability</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{myScore.reliabilityScore}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    myScore.reliabilityScore >= 85 ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                    myScore.reliabilityScore >= 60 ? "bg-gradient-to-r from-amber-400 to-yellow-500" :
                    "bg-gradient-to-r from-red-400 to-rose-500"
                  }`}
                  style={{ width: `${myScore.reliabilityScore}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                <span>☁️ Calm</span>
                <span>🍃 Breeze</span>
                <span>💨 Wind</span>
                <span>🌩️ Storm</span>
                <span>⚡ Lightning</span>
                <span>🌪️ Tornado</span>
              </div>
            </div>

            {/* Rank */}
            {scores.length > 1 && (
              <div className="text-center py-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-3xl mb-1">{getRankBadge(myScore.rank)}</div>
                <p className="text-sm text-slate-500">
                  Rank <span className="font-bold text-slate-900 dark:text-white">{myScore.rank}</span> of {scores.length} team members
                </p>
              </div>
            )}

            {/* Tips */}
            {myScore.tasksOverdue > 0 && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">💡 Pro tip</div>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  You have {myScore.tasksOverdue} overdue task{myScore.tasksOverdue !== 1 ? "s" : ""}. Knock out just one today and watch your score climb!
                  Hit the 📋 button to see your action list.
                </p>
              </div>
            )}
          </div>
        ) : view === "me" && !myScore ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🤷</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No score yet</h2>
            <p className="text-slate-500">Your profile needs to be linked to an owner record. Ask your admin to set this up.</p>
          </div>
        ) : (
          /* ===== TEAM LEADERBOARD ===== */
          <div className="space-y-3">
            {/* Aggregate Team Metrics */}
            {scores.length > 0 && (() => {
              const totalOpen = scores.reduce((s, u) => s + u.totalOpen, 0);
              const totalOverdue = scores.reduce((s, u) => s + u.tasksOverdue, 0);
              const totalOnTrack = scores.reduce((s, u) => s + u.tasksOnTrack, 0);
              const totalCompleted = scores.reduce((s, u) => s + u.tasksCompleted, 0);
              const avgReliability = Math.round(scores.reduce((s, u) => s + u.reliabilityScore, 0) / scores.length);
              const overduePercent = totalOpen > 0 ? Math.round((totalOverdue / totalOpen) * 100) : 0;
              return (
                <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 p-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">📊 Team Overview</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-black text-slate-900 dark:text-white">{totalOpen}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Open Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-green-600 dark:text-green-400">{totalCompleted}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Done This Week</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-red-600 dark:text-red-400">{totalOverdue}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Overdue ({overduePercent}%)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-teal-600 dark:text-teal-400">{totalOnTrack}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">On Track</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{avgReliability}%</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Avg Reliability</div>
                    </div>
                  </div>
                  {/* Team reliability bar */}
                  <div className="mt-3 w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${avgReliability >= 75 ? "bg-green-500" : avgReliability >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${avgReliability}%` }} />
                  </div>
                </div>
              );
            })()}
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">🏆 Team Leaderboard</h2>
            {scores.map((score) => (
              <div
                key={score.ownerId}
                className={`rounded-xl border p-4 flex items-center gap-4 transition ${
                  score.isMe
                    ? "border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20 ring-1 ring-teal-200 dark:ring-teal-800"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                {/* Rank */}
                <div className="text-2xl w-10 text-center flex-shrink-0">
                  {getRankBadge(score.rank)}
                </div>

                {/* Level emoji */}
                <div className="text-2xl flex-shrink-0">{score.levelEmoji}</div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                      {score.name}
                      {score.isMe && <span className="ml-1 text-[10px] text-teal-600 dark:text-teal-400 font-semibold">(YOU)</span>}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                      {score.level}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                    <span>✅ {score.tasksCompleted} done</span>
                    <span>🟢 {score.tasksOnTrack} on track</span>
                    <span>🔴 {score.tasksOverdue} overdue</span>
                    <span>🔥 {score.streak}d streak</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-2xl font-black ${
                    score.reliabilityScore >= 85 ? "text-green-600 dark:text-green-400" :
                    score.reliabilityScore >= 60 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-600 dark:text-red-400"
                  }`}>
                    {score.reliabilityScore}%
                  </div>
                  <div className="text-[10px] text-slate-400">reliability</div>
                </div>
              </div>
            ))}

            {scores.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                No team data yet. Users need to be linked to owner records.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function StatCard({ label, value, emoji, sublabel, color }: {
  label: string;
  value: number;
  emoji: string;
  sublabel: string;
  color: "green" | "teal" | "red" | "amber";
}) {
  const borderColors = {
    green: "border-green-200 dark:border-green-800",
    teal: "border-teal-200 dark:border-teal-800",
    red: "border-red-200 dark:border-red-800",
    amber: "border-amber-200 dark:border-amber-800",
  };
  const valueColors = {
    green: "text-green-600 dark:text-green-400",
    teal: "text-teal-600 dark:text-teal-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
  };

  return (
    <div className={`rounded-xl border ${borderColors[color]} p-3 text-center`}>
      <div className="text-lg mb-0.5">{emoji}</div>
      <div className={`text-2xl font-black ${valueColors[color]}`}>{value}</div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-[10px] text-slate-400">{sublabel}</div>
    </div>
  );
}

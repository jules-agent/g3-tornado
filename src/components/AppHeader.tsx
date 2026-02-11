"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { ParkingLot } from "./ParkingLot";
import { FocusModeStandalone } from "./FocusMode";
import { DailyActionList } from "./DailyActionList";
import { Scorecard } from "./Scorecard";
import { ProjectHealth } from "./ProjectHealth";
import { BugReport } from "./BugReport";
import { ProposeTemplate } from "./ProposeTemplate";
import { DailyTagline } from "./DailyTagline";

type AppHeaderProps = {
  user: {
    email: string | null;
    fullName: string | null;
    role: string | null;
  };
};

export default function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showParkingLot, setShowParkingLot] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showDailyActions, setShowDailyActions] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showProjectHealth, setShowProjectHealth] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showProposeTemplate, setShowProposeTemplate] = useState(false);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check for overdue tasks on mount — auto-open Daily Actions if any exist
  useEffect(() => {
    async function checkOverdue() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase.from("profiles").select("owner_id, role").eq("id", authUser.id).maybeSingle();
      const isAdmin = profile?.role === "admin" || authUser.email === "ben@unpluggedperformance.com";

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, fu_cadence_days, last_movement_at, task_owners (owner_id)")
        .eq("status", "open");

      if (!tasks) { setOverdueCount(0); return; }

      let count = 0;
      const userOwnerId = profile?.owner_id;

      for (const task of tasks as any[]) {
        const daysSince = Math.floor(
          (Date.now() - new Date(task.last_movement_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince <= task.fu_cadence_days) continue;
        
        if (!isAdmin) {
          const ownerIds = task.task_owners?.map((to: any) => to.owner_id).filter(Boolean) || [];
          if (!userOwnerId || !ownerIds.includes(userOwnerId)) continue;
        }
        count++;
      }

      setOverdueCount(count);
      // Auto-open only once per browser session (on refresh or fresh login)
      const alreadyShown = sessionStorage.getItem("dailyActionsAutoOpened");
      if (count > 0 && !alreadyShown) {
        sessionStorage.setItem("dailyActionsAutoOpened", "1");
        setShowDailyActions(true);
      }
    }
    checkOverdue();
  }, []);

  // Check inbox (bug reports/feature requests)
  useEffect(() => {
    async function checkInbox() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).maybeSingle();
      const admin = profile?.role === "admin";

      let query = supabase.from("bug_reports").select("id");
      if (!admin) query = query.eq("reported_by", authUser.id);
      const { data } = await query;

      const total = (data || []).length;
      setInboxTotal(total);

      try {
        const raw = localStorage.getItem("inbox_read_ids");
        const readSet = new Set(raw ? JSON.parse(raw) : []);
        const unread = (data || []).filter((r: { id: string }) => !readSet.has(r.id)).length;
        setInboxUnread(unread);
      } catch {
        setInboxUnread(total);
      }
    }
    checkInbox();
    const interval = setInterval(checkInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayName = user.fullName || user.email || "User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems: { href: string; label: string }[] = [];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        {/* Hamburger Menu Button - Mobile Only - Larger touch target */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition"
          aria-label="Toggle menu"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-2 md:gap-3 group">
          <div className="relative w-8 h-8 md:w-10 md:h-10 transition-transform group-hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/g3-logo-v2.png"
              alt="G3-Tornado"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <div className="text-lg md:text-xl brand-title">
              G3-Tornado
            </div>
            <DailyTagline />
          </div>
        </Link>

        {/* Desktop: Right side actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => setShowProjectHealth(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition"
            title="Project Health"
          >
            📊
          </button>
          <button
            onClick={() => setShowScorecard(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 hover:text-yellow-700 dark:hover:text-yellow-300 transition"
            title="Scorecard"
          >
            🏆
          </button>
          {overdueCount !== null && overdueCount > 0 && (
            <button
              onClick={() => setShowDailyActions(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition animate-pulse-urgent"
              title={`Today's Actions (${overdueCount} overdue)`}
            >
              📋 {overdueCount}
            </button>
          )}
          <button
            onClick={() => setShowParkingLot(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300 transition"
            title="Parking Lot"
          >
            🅿️
          </button>
          {overdueCount !== null && overdueCount > 0 && (
            <button
              onClick={() => setShowFocusMode(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition"
              title="Focus Mode"
            >
              🎯
            </button>
          )}
          <button
            onClick={() => setShowBugReport(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-300 transition"
            title="Feedback"
          >
            💬
          </button>
          <button
            onClick={() => setShowProposeTemplate(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
            title="Propose Template"
          >
            📋
          </button>
          {inboxTotal > 0 && (
            <Link
              href="/inbox"
              className={`relative px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                inboxUnread > 0
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title={inboxUnread > 0 ? `Inbox (${inboxUnread} new)` : "Inbox"}
            >
              {inboxUnread > 0 ? "📬" : "📭"}
              {inboxUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {inboxUnread}
                </span>
              )}
            </Link>
          )}
          <a
            href="/tutorial"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition"
            title="User Tutorial"
          >
            📖
          </a>
          <ThemeToggle />
          
          <button
            onClick={() => setShowParkingLot(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Parking
          </button>
          <Link
            href="/tasks/new"
            className="hidden sm:inline-flex items-center gap-2 btn-primary text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </Link>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 shadow-sm">
            <Link href="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-xs font-bold text-white hover:opacity-80 transition" title="My Profile">
              {initials}
            </Link>
            <div className="hidden text-sm sm:block">
              <div className="font-semibold text-slate-800 dark:text-slate-100">{displayName}</div>
              <div className="text-[10px] font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                {user.role === "admin" || user.email === "ben@unpluggedperformance.com" ? "Admin" : "User"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 transition hover:text-red-500"
            >
              {isSigningOut ? "..." : "Sign out"}
            </button>
          </div>
        </div>

        {/* Mobile: Quick actions */}
        <div className="flex md:hidden items-center gap-2">
          {overdueCount !== null && overdueCount > 0 && (
            <button
              onClick={() => setShowDailyActions(true)}
              className="relative p-2 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition animate-pulse-urgent"
              title={`${overdueCount} overdue tasks`}
            >
              <span className="text-lg">📋</span>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {overdueCount}
              </span>
            </button>
          )}
          <Link href="/profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-sm font-bold text-white hover:opacity-80 transition">
            {initials}
          </Link>
        </div>
      </div>

      {/* Desktop Text Menu Bar - Below icon buttons */}
      <div className="hidden md:flex items-center justify-center gap-6 px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <button
          onClick={() => setShowProjectHealth(true)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Project Health
        </button>
        <button
          onClick={() => setShowScorecard(true)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition"
        >
          Scorecard
        </button>
        {overdueCount !== null && overdueCount > 0 && (
          <>
            <button
              onClick={() => setShowDailyActions(true)}
              className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
            >
              Daily Actions {overdueCount > 0 && `(${overdueCount})`}
            </button>
            <button
              onClick={() => setShowFocusMode(true)}
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              Focus Mode
            </button>
          </>
        )}
        <button
          onClick={() => setShowParkingLot(true)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
        >
          Parking Lot
        </button>
        <button
          onClick={() => setShowBugReport(true)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
        >
          Feedback
        </button>
        <button
          onClick={() => setShowProposeTemplate(true)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          Propose Template
        </button>
        {inboxTotal > 0 && (
          <Link
            href="/inbox"
            className={`text-sm font-medium transition ${
              inboxUnread > 0
                ? "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Inbox {inboxUnread > 0 && `(${inboxUnread})`}
          </Link>
        )}
        <a
          href="/tutorial"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Tutorial
        </a>
        <Link
          href="/profile"
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
        >
          My Profile
        </Link>
      </div>

      {/* Mobile Menu Slide-out */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Menu Panel - Improved safe area padding */}
          <div className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 z-50 md:hidden overflow-y-auto shadow-2xl" style={{ paddingTop: 'max(1.5rem, var(--safe-area-top))', paddingBottom: 'max(1.5rem, var(--safe-area-bottom))' }}>
            <div className="px-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-lg font-bold text-white">
                  {initials}
                </div>
                <div>
                  <div className="font-semibold text-lg text-slate-900 dark:text-white">{displayName}</div>
                  <div className="text-sm font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                    {user.role === "admin" || user.email === "ben@unpluggedperformance.com" ? "Admin" : "User"}
                  </div>
                </div>
              </div>

              {/* Quick Actions - Larger touch targets */}
              <div className="space-y-3">
                <Link
                  href="/tasks/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold shadow-md active:scale-95 transition min-h-[56px]"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-lg">New Task</span>
                </Link>
                <button
                  onClick={() => { setShowParkingLot(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl bg-blue-500 text-white font-semibold shadow-md active:scale-95 transition min-h-[56px]"
                >
                  <span className="text-2xl">🅿️</span>
                  <span className="text-lg">New Parking</span>
                </button>
              </div>

              {/* Main Actions - Better spacing and touch targets */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 mb-3">
                  Actions
                </div>
                {overdueCount !== null && overdueCount > 0 && (
                  <button
                    onClick={() => { setShowDailyActions(true); setMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-semibold active:bg-red-100 dark:active:bg-red-900/30 transition min-h-[56px]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-2xl">📋</span>
                      <span className="text-base">Today's Actions</span>
                    </span>
                    <span className="px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold min-h-[28px] min-w-[28px] flex items-center justify-center">
                      {overdueCount}
                    </span>
                  </button>
                )}
                {overdueCount !== null && overdueCount > 0 && (
                  <button
                    onClick={() => { setShowFocusMode(true); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                  >
                    <span className="text-2xl">🎯</span>
                    <span className="text-base">Focus Mode</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowProjectHealth(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                >
                  <span className="text-2xl">📊</span>
                  <span className="text-base">Project Health</span>
                </button>
                <button
                  onClick={() => { setShowScorecard(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                >
                  <span className="text-2xl">🏆</span>
                  <span className="text-base">Scorecard</span>
                </button>
                {inboxTotal > 0 && (
                  <Link
                    href="/inbox"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold transition min-h-[56px] ${
                      inboxUnread > 0
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 active:bg-blue-100 dark:active:bg-blue-900/30"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-2xl">{inboxUnread > 0 ? "📬" : "📭"}</span>
                      <span className="text-base">Inbox</span>
                    </span>
                    {inboxUnread > 0 && (
                      <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-bold min-h-[28px] min-w-[28px] flex items-center justify-center">
                        {inboxUnread}
                      </span>
                    )}
                  </Link>
                )}
                <button
                  onClick={() => { setShowBugReport(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                >
                  <span className="text-2xl">💬</span>
                  <span className="text-base">Feedback</span>
                </button>
                <button
                  onClick={() => { setShowProposeTemplate(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                >
                  <span className="text-2xl">📋</span>
                  <span className="text-base">Propose Template</span>
                </button>
                <a
                  href="/tutorial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                >
                  <span className="text-2xl">📖</span>
                  <span className="text-base">Tutorial</span>
                </a>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition min-h-[56px]"
                >
                  <span className="text-2xl">👤</span>
                  <span className="text-base">My Profile</span>
                </Link>
              </div>

              {/* Theme Toggle - Larger touch area */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between px-5 py-3 min-h-[56px]">
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-300">Theme</span>
                  <ThemeToggle />
                </div>
              </div>

              {/* Sign Out - Larger button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full px-5 py-4 rounded-xl text-center text-base font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30 transition disabled:opacity-50 min-h-[56px]"
                >
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <ParkingLot isOpen={showParkingLot} onClose={() => setShowParkingLot(false)} />
      <FocusModeStandalone isOpen={showFocusMode} onClose={() => setShowFocusMode(false)} />
      <DailyActionList isOpen={showDailyActions} onClose={() => setShowDailyActions(false)} />
      <Scorecard isOpen={showScorecard} onClose={() => setShowScorecard(false)} />
      <ProjectHealth isOpen={showProjectHealth} onClose={() => setShowProjectHealth(false)} />
      <BugReport isOpen={showBugReport} onClose={() => setShowBugReport(false)} />
      <ProposeTemplate isOpen={showProposeTemplate} onClose={() => setShowProposeTemplate(false)} />
    </header>
  );
}

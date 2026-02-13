"use client";

import { useRouter } from "next/navigation";

type MobileTodayProps = {
  userName: string;
  stats: {
    open: number;
    closed: number;
    gated: number;
    overdue: number;
    total: number;
  };
  recentNotes: Array<{
    id: string;
    content: string;
    created_at: string;
    taskDescription: string;
    taskNumber: string;
    authorName: string;
  }>;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MobileToday({ userName, stats, recentNotes }: MobileTodayProps) {
  const router = useRouter();
  const firstName = userName?.split(" ")[0] || "there";

  const openFocusMode = () => window.dispatchEvent(new Event("g3:openFocusMode"));
  const openParkingLot = () => window.dispatchEvent(new Event("g3:openParkingLot"));

  return (
    <div
      className="min-h-screen pb-24 px-4"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
      }}
    >
      {/* Greeting */}
      <header className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-0.5">
          {formatDate()}
        </p>
      </header>

      {/* Overdue Card */}
      {stats.overdue > 0 && (
        <button
          onClick={openFocusMode}
          aria-label={`${stats.overdue} overdue tasks. Tap to open Focus Mode.`}
          className="w-full mb-4 p-5 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-900/30 border border-red-200/60 dark:border-red-800/40 shadow-sm active:scale-[0.98] transition-transform duration-150 text-left"
          style={{ minHeight: 44 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
                Needs Attention
              </p>
              <p className="text-[34px] font-bold text-red-600 dark:text-red-300 leading-none mt-1">
                {stats.overdue}
              </p>
              <p className="text-[13px] text-red-500/80 dark:text-red-400/70 mt-1">
                overdue {stats.overdue === 1 ? "task" : "tasks"} past cadence
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-500/10 dark:bg-red-400/10 flex items-center justify-center">
              <span className="text-2xl" role="img" aria-hidden="true">🔥</span>
            </div>
          </div>
        </button>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6" role="list" aria-label="Task statistics">
        <div
          role="listitem"
          className="rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-4 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Open
          </p>
          <p className="text-[28px] font-bold text-cyan-600 dark:text-cyan-400 leading-none mt-1">
            {stats.open}
          </p>
        </div>
        <div
          role="listitem"
          className="rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-4 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Gated
          </p>
          <p className="text-[28px] font-bold text-amber-500 dark:text-amber-400 leading-none mt-1">
            {stats.gated}
          </p>
        </div>
        <div
          role="listitem"
          className="rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-4 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Done
          </p>
          <p className="text-[28px] font-bold text-emerald-500 dark:text-emerald-400 leading-none mt-1">
            {stats.closed}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <section aria-label="Recent activity">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
          Recent Activity
        </h2>
        {recentNotes.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 text-center">
            <p className="text-slate-400 dark:text-slate-500 text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm divide-y divide-slate-100 dark:divide-slate-700/50 overflow-hidden">
            {recentNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => router.push(`/?q=${encodeURIComponent(note.taskNumber)}`)}
                className="w-full px-4 py-3.5 text-left active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors"
                style={{ minHeight: 44 }}
                aria-label={`Note on task ${note.taskNumber}: ${note.content}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{note.taskNumber}</span>
                      {" · "}
                      {note.authorName}
                    </p>
                    <p className="text-[15px] text-slate-900 dark:text-white mt-0.5 line-clamp-2 leading-snug">
                      {note.content}
                    </p>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                      {note.taskDescription}
                    </p>
                  </div>
                  <span className="text-[12px] text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(note.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Fixed Bottom Action Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/60"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center justify-around px-4 pt-3">
          <button
            onClick={() => router.push("/?newTask=1")}
            aria-label="Add new task"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
            style={{ minWidth: 64, minHeight: 44 }}
          >
            <span className="text-xl text-cyan-600 dark:text-cyan-400" aria-hidden="true">＋</span>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Task</span>
          </button>
          <button
            onClick={openParkingLot}
            aria-label="Open Parking Lot"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
            style={{ minWidth: 64, minHeight: 44 }}
          >
            <span className="text-xl" aria-hidden="true">🅿️</span>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Parking</span>
          </button>
          <button
            onClick={openFocusMode}
            aria-label="Open Focus Mode"
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 active:from-cyan-600 active:to-teal-600 transition-colors shadow-lg shadow-cyan-500/20"
            style={{ minWidth: 64, minHeight: 44 }}
          >
            <span className="text-xl text-white" aria-hidden="true">🎯</span>
            <span className="text-[11px] font-bold text-white">Focus</span>
          </button>
        </div>
      </div>
    </div>
  );
}

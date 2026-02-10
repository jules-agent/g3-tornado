"use client";

import { useState, useMemo, useRef, useEffect } from "react";

type Section = {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
};

const LAST_UPDATED = "February 10, 2026";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">
      {children}
    </kbd>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 px-4 py-3 text-sm text-teal-800 dark:text-teal-200 my-3">
      <span className="font-semibold">💡 Tip:</span> {children}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 my-3">
      <span className="font-semibold">⚠️ Note:</span> {children}
    </div>
  );
}

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    content: (
      <div className="space-y-4">
        <p>Welcome to G3 Tornado — your task management and accountability system for Unplugged Performance, Bulletproof Automotive, and UP.FIT.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">First Login</h3>
        <ol className="list-decimal ml-5 space-y-2 text-sm">
          <li>Navigate to <strong>g3tornado.com</strong> and sign in with the email provided by your admin.</li>
          <li>On first login, you&apos;ll be taken to the main <strong>Task Dashboard</strong>.</li>
          <li>If you have overdue tasks, the <strong>Today&apos;s Actions</strong> panel will automatically open to help you prioritize.</li>
          <li>Your account is linked to a <strong>Contact</strong> record which determines which companies and projects you can access.</li>
        </ol>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Company Access</h3>
        <p className="text-sm">Your visibility is scoped to the companies you&apos;re associated with:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>UP</strong> — Unplugged Performance</li>
          <li><strong>BP</strong> — Bulletproof Automotive</li>
          <li><strong>UPFIT</strong> — UP.FIT</li>
        </ul>
        <p className="text-sm">You can only see projects and contacts for the companies you belong to. Admins can see everything.</p>
        <Tip>If you can&apos;t see a project or contact you expect, ask your admin to check your company associations.</Tip>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Task Dashboard",
    icon: "📋",
    content: (
      <div className="space-y-4">
        <p>The dashboard is your home screen — a table of all tasks you have access to.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Table Columns (Default View)</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Task</strong> — Task description (includes task number)</li>
          <li><strong>Project</strong> — Which project it belongs to</li>
          <li><strong>Current Gate</strong> — Who&apos;s currently blocking (if gated)</li>
          <li><strong>Next Gate</strong> — Who&apos;s next in the gate sequence</li>
          <li><strong>Next Step</strong> — The next action needed</li>
          <li><strong>Update</strong> — Most recent note/update</li>
          <li><strong>Cad.</strong> — Follow-up cadence in days</li>
          <li><strong>Aging</strong> — Days since last movement/update</li>
          <li><strong>Status</strong> — Open or Closed</li>
        </ul>
        <p className="text-sm mt-2">Hidden by default (enable via column settings):</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Contact</strong> — Who&apos;s responsible</li>
          <li><strong>Gated</strong> — Whether the task is waiting on someone</li>
          <li><strong>ID</strong> — Internal task ID</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Filters</h3>
        <p className="text-sm">Use the filter tabs at the top to narrow your view:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>All</strong> — Every task</li>
          <li><strong>Open</strong> — Currently active tasks</li>
          <li><strong>Overdue</strong> — Tasks past their follow-up cadence</li>
          <li><strong>Gated</strong> — Tasks waiting on a gate/blocker</li>
          <li><strong>Done</strong> — Completed/closed tasks</li>
          <li><strong>Shared</strong> — Tasks with multiple contacts (appears only when shared tasks exist)</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Inline Editing</h3>
        <p className="text-sm">You can edit many fields directly in the table by clicking on them:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Task</strong> — Click to edit the description</li>
          <li><strong>Project</strong> — Click to reassign to a different project</li>
          <li><strong>Current Gate / Next Gate</strong> — Click to edit gate assignments</li>
          <li><strong>Next Step</strong> — Click to update the next action</li>
          <li><strong>Cadence</strong> — Click the number to change follow-up days</li>
          <li><strong>Status</strong> — Click to change between open/closed</li>
          <li><strong>Contact</strong> — Click to reassign (when column is visible)</li>
        </ul>
        <Tip>Click a row to expand it and see more details, notes, and gate information.</Tip>
      </div>
    ),
  },
  {
    id: "creating-tasks",
    title: "Creating Tasks",
    icon: "➕",
    content: (
      <div className="space-y-4">
        <p>Click the <strong>&quot;+ New Task&quot;</strong> button in the top toolbar to create a task.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Required Fields</h3>
        <ol className="list-decimal ml-5 space-y-2 text-sm">
          <li><strong>Project</strong> — Select an existing project or create a new one. You&apos;ll only see projects for your associated companies.</li>
          <li><strong>Description</strong> — What needs to be done.</li>
          <li><strong>Follow-up Cadence</strong> — How many days before this task is considered overdue (default: 3 days).</li>
        </ol>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Contacts</h3>
        <p className="text-sm">Assign one or more contacts to the task. Contacts are filtered based on the selected project&apos;s company associations:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>If you select an UPFIT project, only UPFIT-associated employees and vendors will appear.</li>
          <li>You are auto-assigned as a contact on tasks you create.</li>
          <li>You can add new contacts inline using the <strong>&quot;+ Add Contact&quot;</strong> button.</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Gates (Blockers)</h3>
        <p className="text-sm">Gates represent sequential steps or approvals needed before a task can move forward:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Each gate has a <strong>person responsible</strong> and a <strong>description</strong> of what they need to do.</li>
          <li>Gates are completed in order — the first incomplete gate is the &quot;active&quot; blocker.</li>
          <li>Tasks with incomplete gates show as <strong>🚧 Gated</strong>.</li>
        </ul>
        <Warning>When creating a <strong>shared/team project</strong>, select the relevant companies (UP, BP, UPFIT). This determines who can see the project and which contacts are available. Personal and One-on-One projects don&apos;t require company selection.</Warning>
      </div>
    ),
  },
  {
    id: "todays-actions",
    title: "Today's Actions",
    icon: "🔥",
    content: (
      <div className="space-y-4">
        <p>The <strong>📋 Today&apos;s Actions</strong> panel shows all overdue tasks that need attention. It opens automatically on your first visit each session (browser refresh or login).</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">How It Works</h3>
        <p className="text-sm">Each action card shows:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Task description and project</li>
          <li>How many days overdue</li>
          <li>Whether it&apos;s gated (and by whom)</li>
          <li>A recommended <strong>action for today</strong></li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Quick Update Flow</h3>
        <ol className="list-decimal ml-5 space-y-2 text-sm">
          <li><strong>Type a note</strong> in the input field and press <Kbd>Enter</Kbd> or click <strong>Submit</strong>. This logs an update and resets the task&apos;s movement timer.</li>
          <li>After submitting, a <strong>manage panel</strong> appears where you can:
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li><strong>Change cadence</strong> — Use the +/− buttons or type a number directly</li>
              <li><strong>Add a blocker</strong> — Select who&apos;s blocking and describe what they need to do</li>
            </ul>
          </li>
          <li>Click <strong>&quot;Save Changes&quot;</strong> when you&apos;re done — nothing auto-saves.</li>
          <li>Use <strong>&quot;Close Task&quot;</strong> to mark a task as done, or <strong>&quot;Open →&quot;</strong> for the full task view.</li>
        </ol>
        <Tip>The manage panel stays open as long as you need it. Change cadence AND add a blocker before saving — it&apos;s all one action.</Tip>
        <Warning>The flashing red 📋 badge in the toolbar indicates overdue tasks. It only appears when tasks need attention.</Warning>
      </div>
    ),
  },
  {
    id: "notes",
    title: "Task Notes & Updates",
    icon: "📝",
    content: (
      <div className="space-y-4">
        <p>Notes are the primary way to track progress on a task. Every note resets the task&apos;s &quot;aging&quot; timer.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Adding Notes</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>From <strong>Today&apos;s Actions</strong> — type in the quick note field</li>
          <li>From the <strong>task detail page</strong> — use the Notes section</li>
          <li>From <strong>Focus Mode</strong> — click &quot;📝 Add Update&quot; on any card</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Deleting Notes</h3>
        <p className="text-sm">You can delete your own notes with these rules:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>You can only delete notes <strong>you wrote</strong></li>
          <li>You can only delete notes on tasks where you are the <strong>sole contact</strong></li>
          <li>Notes on <strong>shared tasks</strong> (multiple contacts) cannot be deleted by regular users — this protects visibility for all parties</li>
          <li>Admins can delete any note on any task</li>
        </ul>
        <p className="text-sm">To delete: click the <strong>✕</strong> button on a note, then click <strong>&quot;Confirm delete?&quot;</strong> to confirm.</p>
        <Tip>Add notes frequently! Each note resets the aging timer and shows your task is actively being worked on.</Tip>
      </div>
    ),
  },
  {
    id: "focus-mode",
    title: "Focus Mode",
    icon: "🎯",
    content: (
      <div className="space-y-4">
        <p>Focus Mode shows your <strong>top 3 most urgent overdue tasks</strong> in a clean, distraction-free view.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">How It Prioritizes</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Groups tasks by <strong>gate person</strong> — if 3+ tasks share the same gate person, they&apos;re shown together so you can batch your outreach</li>
          <li>Falls back to the 3 most overdue tasks if no grouping is possible</li>
          <li>Only shows <strong>your tasks</strong> (non-admins see only what&apos;s assigned to them)</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Actions</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>📝 Add Update</strong> — log a note and mark progress</li>
          <li><strong>Open →</strong> — jump to the full task detail page</li>
        </ul>
        <p className="text-sm">Once you add an update to a task, it&apos;s removed from Focus Mode and replaced with the next most urgent task.</p>
      </div>
    ),
  },
  {
    id: "parking-lot",
    title: "Parking Lot",
    icon: "🅿️",
    content: (
      <div className="space-y-4">
        <p>The Parking Lot is a free-form area for <strong>future ideas and tasks</strong> that don&apos;t need tracking yet.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">When to Use</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Ideas that aren&apos;t ready to become tasks</li>
          <li>Low-priority items to revisit later</li>
          <li>Quick captures during meetings</li>
        </ul>
        <p className="text-sm">Access it from the <strong>🅿️</strong> button in the toolbar or the <strong>&quot;+ New Parking&quot;</strong> button.</p>
        <Tip>Old parking lot items will show age-based alerts to remind you to either promote them to tasks or clear them out.</Tip>
      </div>
    ),
  },
  {
    id: "gates-blockers",
    title: "Gates & Blockers",
    icon: "🚧",
    content: (
      <div className="space-y-4">
        <p>Gates are sequential blockers on a task — each one represents someone who needs to do something before the task can proceed.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">How Gates Work</h3>
        <ol className="list-decimal ml-5 space-y-2 text-sm">
          <li>Gates are <strong>ordered</strong> — Gate 1 must be completed before Gate 2 becomes active.</li>
          <li>The <strong>active gate</strong> is the first incomplete one. This person is the current blocker.</li>
          <li>Tasks with incomplete gates show a <strong>🚧 Gated</strong> badge.</li>
          <li>The gate person and their task appear in Today&apos;s Actions and Focus Mode.</li>
        </ol>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Adding Gates</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Task creation form</strong> — add gates in the Gates section</li>
          <li><strong>Today&apos;s Actions</strong> — use the &quot;Add Blocker&quot; option after submitting a note</li>
          <li><strong>Task detail page</strong> — edit task form</li>
        </ul>
        <p className="text-sm">When adding a gate to a task that already has gates, you can choose where in the sequence to insert it.</p>
      </div>
    ),
  },
  {
    id: "projects",
    title: "Projects",
    icon: "📁",
    content: (
      <div className="space-y-4">
        <p>Every task belongs to a project. Projects organize work and control who can see what.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Project Types</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Shared / Team</strong> — visible to all users with matching company access</li>
          <li><strong>Personal</strong> — only visible to you</li>
          <li><strong>One on One</strong> — shared between you and one other person</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Company Associations</h3>
        <p className="text-sm">When creating a project, you must select one or more companies (UP, BP, UPFIT). This determines:</p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Which <strong>users</strong> can see the project</li>
          <li>Which <strong>contacts</strong> can be assigned to tasks in the project</li>
        </ul>
        <Warning>If a project is marked as UPFIT-only, only UPFIT-associated employees and vendors will appear as assignable contacts.</Warning>
      </div>
    ),
  },
  {
    id: "cadence",
    title: "Follow-up Cadence",
    icon: "⏰",
    content: (
      <div className="space-y-4">
        <p>Every task has a <strong>follow-up cadence</strong> — the number of days before it&apos;s considered overdue if no update has been made.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">How It Works</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Default cadence is <strong>3 days</strong></li>
          <li>The &quot;Aging&quot; column shows days since last movement</li>
          <li>When aging exceeds cadence, the task turns <strong>red/amber</strong> and appears in Today&apos;s Actions</li>
          <li>Adding a note or any update resets the aging timer</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Changing Cadence</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Dashboard</strong> — click the cadence number in the table</li>
          <li><strong>Today&apos;s Actions</strong> — use the cadence control in the manage panel</li>
          <li><strong>Task detail</strong> — edit in the task form</li>
        </ul>
        <Tip>Set shorter cadences (1-3 days) for urgent tasks and longer cadences (14-30 days) for slow-moving items. This keeps your overdue list meaningful.</Tip>
      </div>
    ),
  },
  {
    id: "scorecard",
    title: "Scorecard",
    icon: "🏆",
    content: (
      <div className="space-y-4">
        <p>The Scorecard (🏆 in toolbar) gives you performance metrics across your tasks.</p>
        <p className="text-sm">Track how many tasks are on-time vs overdue, your update frequency, and team activity.</p>
      </div>
    ),
  },
  {
    id: "health-dashboard",
    title: "Project Health",
    icon: "📊",
    content: (
      <div className="space-y-4">
        <p>The Project Health dashboard (📊 in toolbar) shows an overview of deadlines, buffer time, and risk across all projects.</p>
        <p className="text-sm">Use this to identify projects that need attention before they become critical.</p>
      </div>
    ),
  },
  {
    id: "feedback",
    title: "Reporting Bugs & Feature Requests",
    icon: "💬",
    content: (
      <div className="space-y-4">
        <p>Click the <strong>💬</strong> button in the toolbar to report bugs or suggest features.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Bug Reports</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Describe what happened vs. what you expected</li>
          <li>Optionally paste or upload a screenshot (<Kbd>Ctrl+V</Kbd> to paste)</li>
          <li>Bugs are reviewed and fixed as quickly as possible</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Feature Requests</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li>Describe what you&apos;d like to see and how it would help you</li>
          <li>Feature requests are reviewed against our roadmap and priorities</li>
          <li>Good ideas get built fast!</li>
        </ul>
        <Tip>The more detail you include, the faster we can act on your feedback.</Tip>
      </div>
    ),
  },
  {
    id: "admin",
    title: "Admin Features",
    icon: "⚙️",
    content: (
      <div className="space-y-4">
        <p>Admins have access to additional management features via the <strong>Admin</strong> panel.</p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Admin Capabilities</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Users</strong> — Manage user accounts, roles, and permissions</li>
          <li><strong>Projects</strong> — Create/edit all projects across companies</li>
          <li><strong>Contacts</strong> — Manage all contacts, set company associations (UP/BP/UPFIT), mark as employee or vendor</li>
          <li><strong>Activity Log</strong> — View all system activity</li>
          <li><strong>Feedback</strong> — Review bug reports and feature requests</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Admin Visibility</h3>
        <p className="text-sm">Admins bypass all company-scoping filters — they can see every project, contact, and task regardless of company association.</p>
      </div>
    ),
  },
  {
    id: "keyboard-shortcuts",
    title: "Tips & Shortcuts",
    icon: "⌨️",
    content: (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Toolbar Quick Access</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>📊</strong> — Project Health Dashboard</li>
          <li><strong>🏆</strong> — Scorecard</li>
          <li><strong>📋</strong> — Today&apos;s Actions (shows count when overdue tasks exist)</li>
          <li><strong>🅿️</strong> — Parking Lot</li>
          <li><strong>🎯</strong> — Focus Mode</li>
          <li><strong>💬</strong> — Report Bug / Request Feature</li>
          <li><strong>📖</strong> — This tutorial</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Keyboard Shortcuts</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><Kbd>Enter</Kbd> in note field — Submit the note</li>
          <li><Kbd>Escape</Kbd> — Close editor popups (gate editor, contact editor)</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Pro Tips</h3>
        <ul className="list-disc ml-5 space-y-2 text-sm">
          <li><strong>Start each day with Today&apos;s Actions</strong> — it shows exactly what needs attention, prioritized by urgency.</li>
          <li><strong>Use Focus Mode when overwhelmed</strong> — it narrows your view to just 3 tasks, grouped by gate person for efficient batching.</li>
          <li><strong>Set cadence intentionally</strong> — not everything is a 7-day task. Urgent items should be 1-3 days; slow-burn items can be 14-30.</li>
          <li><strong>Add notes even when there&apos;s no progress</strong> — &quot;Still waiting on X&quot; is a valid update that shows accountability.</li>
          <li><strong>Use gates to track dependencies</strong> — if someone else needs to act before you can proceed, add a gate instead of just leaving a note.</li>
        </ul>
      </div>
    ),
  },
];

export default function TutorialPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sectionElements = container.querySelectorAll("[data-section-id]");
      let current = "getting-started";
      for (const el of Array.from(sectionElements)) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 160) {
          current = el.getAttribute("data-section-id") || current;
        }
      }
      setActiveSection(current);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              📖 G3 Tornado — User Guide
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
          <a
            href="/"
            className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            ← Back to App
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar TOC */}
        <nav className="hidden lg:block w-64 shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto border-r border-slate-100 dark:border-slate-800 px-4 py-6">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tutorial..."
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <ul className="space-y-1">
            {filteredSections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    activeSection === section.id
                      ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile search */}
        <div className="lg:hidden px-6 pt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutorial..."
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 min-w-0 px-6 lg:px-12 py-8 space-y-12">
          {filteredSections.map((section) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              data-section-id={section.id}
              className="scroll-mt-24"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span>{section.icon}</span>
                {section.title}
              </h2>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {section.content}
              </div>
            </div>
          ))}

          {filteredSections.length === 0 && (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-500">No sections match &quot;{searchQuery}&quot;</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-8 pb-12 text-center text-sm text-slate-400">
            <p>G3 Tornado User Guide — Updated {LAST_UPDATED}</p>
            <p className="mt-1">Questions? Use the 💬 Feedback button in the app to reach us.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

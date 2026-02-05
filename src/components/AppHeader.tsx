"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppHeaderProps = {
  user: {
    email: string | null;
    fullName: string | null;
    role: string | null;
  };
};

export default function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  return (
    <header className="border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌪️</span>
            <div>
              <div className="text-lg font-semibold text-slate-900">G3-Tornado</div>
              <div className="text-xs text-slate-500">UP.FIT Task Management</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 md:flex">
            <Link href="/" className="hover:text-slate-900">
              Hit List
            </Link>
            <Link href="/tasks/new" className="hover:text-slate-900">
              New Task
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/tasks/new"
            className="hidden rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex"
          >
            + New Task
          </Link>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="hidden text-sm sm:block">
              <div className="font-medium text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-500">
                {user.role === "admin" || user.email === "ben@unpluggedperformance.com" ? "Admin" : "User"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-900"
            >
              {isSigningOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

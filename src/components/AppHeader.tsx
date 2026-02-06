"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./ThemeToggle";

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

  const navItems = [
    { href: "/", label: "Tasks" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo & Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/g3-logo-v2.png"
                alt="G3-Tornado"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="text-xl brand-title">
                G3-Tornado
              </div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Task Management
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm shadow-cyan-500/25"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-xs font-bold text-white">
              {initials}
            </div>
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
      </div>
    </header>
  );
}

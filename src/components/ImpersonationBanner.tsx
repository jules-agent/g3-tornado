"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TargetUser = {
  id: string;
  email: string;
  name: string | null;
};

export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check localStorage for impersonation data (set by AdminTabs when starting)
    const target = localStorage.getItem("impersonation_target");
    if (target) {
      try {
        setTargetUser(JSON.parse(target));
        setIsImpersonating(true);
      } catch {
        localStorage.removeItem("impersonation_target");
      }
    }
  }, []);

  const endImpersonation = async () => {
    try {
      await fetch("/api/admin/impersonate/stop", { method: "POST" });
    } catch {
      // Ignore
    }

    localStorage.removeItem("impersonation_token");
    localStorage.removeItem("impersonation_target");
    // Hard navigate to force full page reload with admin context
    window.location.href = "/admin";
  };

  if (!isImpersonating || !targetUser) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-purple-600 text-white px-4 py-2 flex items-center justify-between text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-purple-200">👤 Viewing as:</span>
        <span className="font-semibold">{targetUser.name || targetUser.email}</span>
        <span className="text-purple-200">({targetUser.email})</span>
      </div>
      <button
        onClick={endImpersonation}
        className="rounded bg-purple-700 hover:bg-purple-800 px-3 py-1 text-xs font-semibold transition"
      >
        Exit Impersonation
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TargetUser = {
  id: string;
  email: string;
  name: string | null;
};

export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check URL param for impersonation token
    const impersonateToken = searchParams.get("impersonate");
    if (impersonateToken) {
      localStorage.setItem("impersonation_token", impersonateToken);
      // Remove the param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("impersonate");
      window.history.replaceState({}, "", url.toString());
    }

    // Check localStorage for impersonation data
    const token = localStorage.getItem("impersonation_token");
    const target = localStorage.getItem("impersonation_target");
    
    if (token && target) {
      try {
        setTargetUser(JSON.parse(target));
        setIsImpersonating(true);
      } catch {
        // Invalid data, clear it
        localStorage.removeItem("impersonation_token");
        localStorage.removeItem("impersonation_target");
      }
    }
  }, [searchParams]);

  const endImpersonation = async () => {
    const token = localStorage.getItem("impersonation_token");
    
    try {
      await fetch(`/api/admin/impersonate?token=${token}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore errors
    }

    // Clear local storage
    localStorage.removeItem("impersonation_token");
    localStorage.removeItem("impersonation_target");
    
    // Refresh the page
    setIsImpersonating(false);
    setTargetUser(null);
    router.refresh();
  };

  if (!isImpersonating || !targetUser) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-purple-600 text-white px-4 py-2 flex items-center justify-between text-sm">
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

"use client";

import { useState, useEffect } from "react";

const TAGLINES = [
  "Get Shit Done",
  "Own It",
  "Ship It",
  "Talk Less Do More",
  "Stay Dangerous",
  "Lock In",
  "All Gas No Brake",
  "Built Different",
  "Break Things",
  "FAFO",
  "Send It",
  "No Sleep Till Done",
  "Eat. Close. Repeat.",
  "Chaos Is A Ladder",
  "Move Fast Break Shit",
  "Bet On Yourself",
  "Main Character Energy",
  "Let Them Watch",
  "We Don't Miss",
  "Different Breed",
  "LFG 🚀",
  "Built Not Bought",
  "Sicko Mode",
  "Risk It For The Biscuit",
  "Hold My Beer",
];

function getTodaysTagline(): string {
  // Deterministic: same tagline for everyone each weekday
  // Rotate through all taglines, prioritize unvoted, recycle upvoted
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Weekends: no tagline change, show last Friday's
  // Get days since epoch, only count weekdays
  const epoch = new Date("2026-02-10"); // launch day = "Get Shit Done"
  const diffMs = now.getTime() - epoch.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Count only weekdays
  let weekdays = 0;
  for (let i = 0; i <= diffDays; i++) {
    const d = new Date(epoch.getTime() + i * 86400000);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) weekdays++;
  }

  // Day 0 = "Get Shit Done" (index 0)
  // After cycling through all, recycle upvoted ones from localStorage
  if (weekdays <= 0) return TAGLINES[0];

  const idx = (weekdays - 1) % TAGLINES.length;
  return TAGLINES[idx];
}

export function DailyTagline() {
  const [tagline, setTagline] = useState("");
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const t = getTodaysTagline();
    setTagline(t);

    // Check if already voted today
    try {
      const votes = JSON.parse(localStorage.getItem("tagline_votes") || "{}");
      const today = new Date().toISOString().slice(0, 10);
      if (votes[today]) {
        setVoted(votes[today]);
      }
    } catch {}
  }, []);

  const handleVote = (vote: "up" | "down") => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const votes = JSON.parse(localStorage.getItem("tagline_votes") || "{}");
      votes[today] = vote;
      localStorage.setItem("tagline_votes", JSON.stringify(votes));

      // Track aggregate: which taglines get upvoted for recycling
      const agg = JSON.parse(localStorage.getItem("tagline_agg") || "{}");
      agg[tagline] = (agg[tagline] || 0) + (vote === "up" ? 1 : -1);
      localStorage.setItem("tagline_agg", JSON.stringify(agg));
    } catch {}

    setVoted(vote);
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 1500);
  };

  if (!tagline) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        {tagline}
      </span>
      {!voted ? (
        <span className="inline-flex gap-0.5 opacity-40 hover:opacity-100 transition">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote("up"); }}
            className="text-[9px] hover:text-emerald-500 transition p-0 leading-none"
            title="Like this one"
          >
            👍
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote("down"); }}
            className="text-[9px] hover:text-red-500 transition p-0 leading-none"
            title="Not feeling it"
          >
            👎
          </button>
        </span>
      ) : showFeedback ? (
        <span className="text-[9px] text-slate-400 animate-pulse">
          {voted === "up" ? "🔥" : "👌"}
        </span>
      ) : (
        <span className="text-[9px] text-slate-300">
          {voted === "up" ? "👍" : "👎"}
        </span>
      )}
    </div>
  );
}

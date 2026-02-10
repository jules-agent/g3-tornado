"use client";

import { useState, useEffect } from "react";

const ALL_TAGLINES = [
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
  // Tesla / SpaceX
  "Ludicrous Mode",
  "Mars Or Bust",
  "Full Send Full Throttle",
  "Launch Sequence Initiated",
  "Pedal Down No Regen",
  // JDM
  "VTEC Just Kicked In",
  "Boost Is Life",
  "Kansei Dorifto",
  "Redline Everything",
  "Touge Mode",
];

function getWeekdayIndex(): number {
  const epoch = new Date("2026-02-10"); // launch day = index 0
  const now = new Date();
  const diffMs = now.getTime() - epoch.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let weekdays = 0;
  for (let i = 0; i <= diffDays; i++) {
    const d = new Date(epoch.getTime() + i * 86400000);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) weekdays++;
  }
  return Math.max(0, weekdays - 1);
}

function pickTagline(blocked: Set<string>): string {
  const available = ALL_TAGLINES.filter(t => !blocked.has(t));
  if (available.length === 0) return ALL_TAGLINES[0]; // fallback
  const idx = getWeekdayIndex() % available.length;
  return available[idx];
}

export function DailyTagline() {
  const [tagline, setTagline] = useState("");
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch blocked taglines, then pick today's
    fetch("/api/taglines")
      .then(r => r.json())
      .then(data => {
        const blockedSet = new Set<string>(data.blocked || []);
        setBlocked(blockedSet);
        setTagline(pickTagline(blockedSet));
      })
      .catch(() => {
        setTagline(pickTagline(new Set()));
      });

    // Check if already voted today
    try {
      const votes = JSON.parse(localStorage.getItem("tagline_votes") || "{}");
      const today = new Date().toISOString().slice(0, 10);
      if (votes[today]) setVoted(votes[today]);
    } catch {}
  }, []);

  const handleVote = async (vote: "up" | "down") => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const votes = JSON.parse(localStorage.getItem("tagline_votes") || "{}");
      votes[today] = vote;
      localStorage.setItem("tagline_votes", JSON.stringify(votes));
    } catch {}

    setVoted(vote);

    // Save vote server-side (both up and down)
    await fetch("/api/taglines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagline, vote }),
    }).catch(() => {});
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
      ) : voted === "up" ? (
        <span className="text-[9px]">🔥</span>
      ) : (
        <span className="text-[9px] text-slate-300">👎</span>
      )}
    </div>
  );
}

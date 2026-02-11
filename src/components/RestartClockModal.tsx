"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

type RestartClockModalProps = {
  isOpen: boolean;
  onConfirm: (newCadenceDays: number) => void;
  onCancel: () => void;
  currentCadenceDays: number;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function diffDays(from: Date, to: Date): number {
  const msPerDay = 86400000;
  const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toStart = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toStart.getTime() - fromStart.getTime()) / msPerDay);
}

export function RestartClockModal({
  isOpen,
  onConfirm,
  onCancel,
  currentCadenceDays,
}: RestartClockModalProps) {
  const [cadenceDays, setCadenceDays] = useState(Math.round(currentCadenceDays) || 1);

  useEffect(() => {
    if (isOpen) {
      setCadenceDays(Math.round(currentCadenceDays) || 1);
    }
  }, [isOpen, currentCadenceDays]);

  const handleConfirm = () => {
    onConfirm(cadenceDays);
  };

  const handleIncrement = () => {
    setCadenceDays((prev) => Math.min(365, prev + 1));
  };

  const handleDecrement = () => {
    setCadenceDays((prev) => Math.max(1, prev - 1));
  };

  // Calendar: show the target date and surrounding weeks
  const today = useMemo(() => new Date(), []);
  const targetDate = useMemo(() => addDays(today, cadenceDays), [today, cadenceDays]);

  // Generate calendar weeks around the target date
  const calendarWeeks = useMemo(() => {
    // Start from the beginning of the target week's month
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const startDay = monthStart.getDay();
    const calStart = addDays(monthStart, -startDay);

    const weeks: Date[][] = [];
    let current = calStart;
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(current));
        current = addDays(current, 1);
      }
      weeks.push(week);
      // Stop if we've passed the end of the month
      if (current.getMonth() !== targetDate.getMonth() && current.getDate() > 7) break;
    }
    return weeks;
  }, [targetDate]);

  const handleDateClick = (date: Date) => {
    const days = diffDays(today, date);
    if (days >= 1 && days <= 365) {
      setCadenceDays(days);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md md:max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Restart The Clock</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Set follow-up in whole days, then restart the clock.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {/* Day counter */}
          <div>
            <label className="block text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Follow-up in
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDecrement}
                disabled={cadenceDays <= 1}
                className="min-w-[56px] min-h-[56px] rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 active:bg-slate-50 dark:active:bg-slate-800 disabled:opacity-30 transition font-bold text-2xl"
              >
                −
              </button>
              <input
                type="number"
                value={cadenceDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    setCadenceDays(Math.max(1, Math.min(365, val)));
                  }
                }}
                step={1}
                min={1}
                max={365}
                className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-4 text-center text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[56px]"
              />
              <button
                onClick={handleIncrement}
                disabled={cadenceDays >= 365}
                className="min-w-[56px] min-h-[56px] rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 active:bg-slate-50 dark:active:bg-slate-800 disabled:opacity-30 transition font-bold text-2xl"
              >
                +
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
              {cadenceDays === 1 ? "1 day" : `${cadenceDays} days`} →{" "}
              <span className="font-semibold text-teal-600 dark:text-teal-400">
                {DAY_NAMES[targetDate.getDay()]}, {MONTH_NAMES[targetDate.getMonth()]} {targetDate.getDate()}
              </span>
            </p>
          </div>

          {/* Mini calendar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="text-center mb-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {MONTH_NAMES[targetDate.getMonth()]} {targetDate.getFullYear()}
              </span>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase">
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((date, di) => {
                  const isTarget = isSameDay(date, targetDate);
                  const isToday = isSameDay(date, today);
                  const isPast = date < today && !isToday;
                  const isOtherMonth = date.getMonth() !== targetDate.getMonth();
                  const daysFromNow = diffDays(today, date);
                  const isSelectable = daysFromNow >= 1 && daysFromNow <= 365;

                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => isSelectable && handleDateClick(date)}
                      disabled={!isSelectable}
                      className={`h-9 rounded-lg text-xs font-medium transition ${
                        isTarget
                          ? "bg-teal-500 text-white font-bold ring-2 ring-teal-300 dark:ring-teal-700"
                          : isToday
                          ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                          : isPast || isOtherMonth
                          ? "text-slate-300 dark:text-slate-600 cursor-default"
                          : isSelectable
                          ? "text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                          : "text-slate-300 dark:text-slate-600 cursor-default"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              💡 The clock will restart, marking this as the last update. If you skip, the action will still complete, but the clock won&apos;t reset.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-teal-500 px-6 py-4 text-base font-semibold text-white hover:bg-teal-600 active:bg-teal-700 transition min-h-[56px]"
          >
            Restart The Clock
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl px-6 py-4 text-base font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition min-h-[56px]"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type RestartClockModalProps = {
  isOpen: boolean;
  onConfirm: (newCadenceDays: number) => void;
  onCancel: () => void;
  currentCadenceDays: number;
};

export function RestartClockModal({
  isOpen,
  onConfirm,
  onCancel,
  currentCadenceDays,
}: RestartClockModalProps) {
  const [cadenceDays, setCadenceDays] = useState(currentCadenceDays);

  // Reset to current cadence when modal opens
  useEffect(() => {
    if (isOpen) {
      setCadenceDays(currentCadenceDays);
    }
  }, [isOpen, currentCadenceDays]);

  const handleConfirm = () => {
    onConfirm(cadenceDays);
  };

  const handleIncrement = () => {
    setCadenceDays((prev) => Math.min(365, prev + 0.25));
  };

  const handleDecrement = () => {
    setCadenceDays((prev) => Math.max(0.25, prev - 0.25));
  };

  if (!isOpen || typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Restart The Clock</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Adjust the follow-up cadence if needed, then restart the clock.
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Follow-up Cadence (days)
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDecrement}
                className="w-10 h-10 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition font-bold text-lg"
              >
                −
              </button>
              <input
                type="number"
                value={cadenceDays}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setCadenceDays(Math.max(0.25, Math.min(365, val)));
                  }
                }}
                step={0.25}
                min={0.25}
                max={365}
                className="flex-1 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-center text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleIncrement}
                className="w-10 h-10 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition font-bold text-lg"
              >
                +
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Current: {currentCadenceDays} {currentCadenceDays === 1 ? "day" : "days"}
            </p>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              💡 The clock will restart, marking this as the last update. If you skip, the action will still complete, but the clock won't reset.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition"
          >
            Restart The Clock
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

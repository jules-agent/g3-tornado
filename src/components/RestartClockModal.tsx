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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md md:max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Larger for mobile */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Restart The Clock</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Adjust the follow-up cadence if needed, then restart the clock.
          </p>
        </div>

        {/* Body - Better spacing */}
        <div className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Follow-up Cadence (days)
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDecrement}
                className="min-w-[56px] min-h-[56px] rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 active:bg-slate-50 dark:active:bg-slate-800 transition font-bold text-2xl"
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
                className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-4 text-center text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[56px]"
              />
              <button
                onClick={handleIncrement}
                className="min-w-[56px] min-h-[56px] rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 active:bg-slate-50 dark:active:bg-slate-800 transition font-bold text-2xl"
              >
                +
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
              Current: {currentCadenceDays} {currentCadenceDays === 1 ? "day" : "days"}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              💡 The clock will restart, marking this as the last update. If you skip, the action will still complete, but the clock won't reset.
            </p>
          </div>
        </div>

        {/* Footer - Larger buttons */}
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

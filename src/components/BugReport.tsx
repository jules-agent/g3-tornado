"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type FeedbackType = "bug" | "feature_request";

export function BugReport({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<FeedbackType>("bug");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setDescription("");
        setScreenshot(null);
        setSubmitted(false);
        setTab("bug");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) readFileAsBase64(file);
        break;
      }
    }
  }, []);

  const readFileAsBase64 = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFileAsBase64(file);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), screenshot, type: tab }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // silent fail
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const isBug = tab === "bug";
  const accentColor = isBug ? "teal" : "indigo";

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-5 pt-3 pb-0">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("bug")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                  isBug
                    ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                🐛 Bug Report
              </button>
              <button
                onClick={() => setTab("feature_request")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                  !isBug
                    ? "border-indigo-500 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                💡 Feature Request
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">&times;</button>
          </div>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {isBug ? "✅ Bug submitted!" : "✅ Feature request submitted!"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isBug ? "Our AI will analyze and fix this automatically. Track progress on" : "Thanks for the idea! Track it on"}{" "}
              <a href="/my-reports" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">My Reports</a>.
            </p>
            <button
              onClick={onClose}
              className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                isBug ? "bg-teal-500 hover:bg-teal-600" : "bg-indigo-500 hover:bg-indigo-600"
              }`}
            >
              Close
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4" onPaste={handlePaste}>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {isBug ? "What happened?" : "What would you like to see?"} <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 resize-none ${
                  isBug ? "focus:ring-teal-500" : "focus:ring-indigo-500"
                }`}
                placeholder={isBug ? "Describe the bug... What did you expect vs what happened?" : "Describe your idea... How would this feature help you?"}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Screenshot <span className="text-slate-400">(optional — paste or upload)</span>
              </label>
              {screenshot ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshot} alt="Screenshot" className="max-h-32 rounded-lg border border-slate-200 dark:border-slate-700" />
                  <button
                    onClick={() => setScreenshot(null)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 px-4 py-6 text-xs text-slate-400 transition text-center ${
                    isBug ? "hover:border-teal-400 hover:text-teal-500" : "hover:border-indigo-400 hover:text-indigo-500"
                  }`}
                >
                  📷 Click to upload or paste an image (Ctrl+V)
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={loading || !description.trim()}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 transition ${
                  isBug
                    ? `bg-${accentColor}-500 hover:bg-${accentColor}-600`
                    : "bg-indigo-500 hover:bg-indigo-600"
                }`}
              >
                {loading ? "Submitting..." : isBug ? "Submit Bug Report" : "Submit Feature Request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

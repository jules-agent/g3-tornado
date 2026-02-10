"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

export function BugReport({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
      // Reset after close animation
      const t = setTimeout(() => {
        setDescription("");
        setScreenshot(null);
        setSubmitted(false);
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
        body: JSON.stringify({ description: description.trim(), screenshot }),
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

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">🐛 Report a Bug</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">&times;</button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">✅ Bug submitted!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">We&apos;ll look into it shortly.</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4" onPaste={handlePaste}>
            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                What happened? <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Describe the bug... What did you expect vs what happened?"
              />
            </div>

            {/* Screenshot */}
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
                  className="w-full rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 px-4 py-6 text-xs text-slate-400 hover:border-teal-400 hover:text-teal-500 transition text-center"
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

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={loading || !description.trim()}
                className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition"
              >
                {loading ? "Submitting..." : "Submit Bug Report"}
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

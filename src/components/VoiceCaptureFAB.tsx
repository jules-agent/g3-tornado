"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, X, Check, Loader2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type VoiceState = "idle" | "listening" | "captured" | "saving" | "done";

export function VoiceCaptureFAB() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [supported, setSupported] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    setSupported(!!SR);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) setTranscript(final);
      setInterimText(interim);
    };

    recognition.onend = () => {
      if (state === "listening") {
        // Auto-stop: move to captured if we have text
        const currentTranscript = transcript || interimText;
        if (currentTranscript.trim()) {
          if (!transcript && interimText) setTranscript(interimText);
          setState("captured");
        } else {
          setState("idle");
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please enable microphone permissions in your browser settings.");
      }
      setState("idle");
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setInterimText("");

    try {
      recognition.start();
    } catch {
      setState("idle");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    // Use whatever we have
    setTranscript((prev) => {
      const text = prev || interimText;
      if (text.trim()) {
        setState("captured");
      } else {
        setState("idle");
      }
      return text || interimText;
    });
  }, [interimText]);

  const saveToParking = async () => {
    if (!transcript.trim()) return;
    setState("saving");

    try {
      const res = await fetch("/api/parking-lot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: transcript.trim() }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown error");
        throw new Error(err);
      }

      setState("done");
      setToast("Added to Parking Lot ✅");
      setTimeout(() => {
        setToast(null);
        reset();
        setOpen(false);
        // Reload to show the new item
        window.location.reload();
      }, 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      alert("Error saving: " + msg);
      setState("captured");
    }
  };

  const reset = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setState("idle");
    setTranscript("");
    setInterimText("");
  };

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  if (!supported) return null;

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          title="Voice Capture"
          aria-label="Voice capture"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h2 className="text-lg font-bold text-white">Voice Capture</h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status */}
            <p className="px-5 text-sm text-slate-400">
              {state === "idle" && "Tap the mic to start"}
              {state === "listening" && "Listening... tap to stop"}
              {state === "captured" && "Review your capture"}
              {state === "saving" && "Saving..."}
              {state === "done" && "Saved!"}
            </p>

            {/* Mic Button */}
            <div className="flex justify-center py-8">
              <button
                onClick={state === "listening" ? stopListening : startListening}
                disabled={state === "saving" || state === "done"}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  state === "listening"
                    ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)] animate-pulse"
                    : state === "saving" || state === "done"
                    ? "bg-slate-700 cursor-not-allowed"
                    : "bg-emerald-500 shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] hover:scale-105 active:scale-95"
                }`}
              >
                {state === "saving" ? (
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                ) : state === "listening" ? (
                  <MicOff className="w-10 h-10 text-white" />
                ) : state === "done" ? (
                  <Check className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </button>
            </div>

            {/* Transcript */}
            {(transcript || interimText) && (
              <div className="mx-5 mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white text-base leading-relaxed text-center">
                  {transcript}
                  {interimText && (
                    <span className="text-slate-400 italic">{interimText}</span>
                  )}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {state === "captured" && transcript.trim() && (
              <div className="flex gap-3 px-5 pb-5">
                <button
                  onClick={reset}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/15 transition"
                >
                  Try Again
                </button>
                <button
                  onClick={saveToParking}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-900 font-bold hover:bg-emerald-400 transition"
                >
                  Save to Parking
                </button>
              </div>
            )}

            {/* Bottom padding for mobile safe area */}
            <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10001] px-6 py-3 bg-emerald-500 text-slate-900 font-bold rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { Mic } from "lucide-react";

interface SpeechInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function SpeechInput({
  onResult,
  disabled = false,
  className = "",
}: SpeechInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use a format that works on iOS Safari
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (chunksRef.current.length === 0) {
          setIsRecording(false);
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Send to Whisper API
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          formData.append("audio", audioBlob, `recording.${ext}`);

          const res = await fetch("/api/speech", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const { text } = await res.json();
            if (text?.trim()) onResult(text.trim());
          } else {
            console.error("Speech API error:", res.status);
          }
        } catch (err) {
          console.error("Transcription error:", err);
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
        }
      };

      recorder.start(250); // Collect in 250ms chunks
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        alert("Microphone access denied. Please enable microphone permissions in Settings.");
      }
      setIsRecording(false);
    }
  }, [onResult]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const active = isRecording || isTranscribing;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isTranscribing}
      className={`
        flex items-center justify-center
        w-10 h-10 rounded-lg
        transition-all duration-200
        ${
          isRecording
            ? "bg-red-500 text-white animate-pulse"
            : isTranscribing
            ? "bg-amber-500 text-white animate-pulse"
            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
      title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Start voice input"}
      aria-label={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Start voice input"}
    >
      {isTranscribing ? (
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
}

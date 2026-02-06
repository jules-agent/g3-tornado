"use client";

import { useEffect, useState, useRef } from "react";

const STORAGE_KEY = "g3-column-widths";

type ColumnWidths = Record<string, number>;

const DEFAULT_WIDTHS: ColumnWidths = {
  id: 56,
  task: 0, // flex
  project: 112,
  owner: 112,
  cadence: 64,
  days: 56,
  status: 80,
};

export function useColumnWidths() {
  const [widths, setWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setWidths({ ...DEFAULT_WIDTHS, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error("Failed to load column widths:", e);
    }
    setLoaded(true);
  }, []);

  const setWidth = (columnId: string, width: number) => {
    setWidths((prev) => {
      const updated = { ...prev, [columnId]: Math.max(50, width) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const resetWidths = () => {
    setWidths(DEFAULT_WIDTHS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { widths, loaded, setWidth, resetWidths };
}

type ResizeHandleProps = {
  columnId: string;
  currentWidth: number;
  onResize: (columnId: string, newWidth: number) => void;
};

export function ResizeHandle({ columnId, currentWidth, onResize }: ResizeHandleProps) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = currentWidth;
    
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + diff);
      onResize(columnId, newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-teal-400/50 transition-colors z-10"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-300 dark:bg-slate-600 hover:bg-teal-500" />
    </div>
  );
}

export function ColumnResizeControls({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex justify-end mb-1">
      <button
        onClick={onReset}
        className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
      >
        Reset column widths
      </button>
    </div>
  );
}

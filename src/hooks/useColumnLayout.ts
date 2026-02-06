"use client";

import { useState, useEffect, useCallback } from "react";

export type ColumnConfig = {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  order: number;
  visible: boolean;
};

const STORAGE_KEY = "g3-column-layout";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "id", label: "ID", width: 56, minWidth: 50, order: 0, visible: true },
  { id: "task", label: "Task", width: 300, minWidth: 150, order: 1, visible: true },
  { id: "project", label: "Project", width: 112, minWidth: 80, order: 2, visible: true },
  { id: "owner", label: "Owner", width: 112, minWidth: 80, order: 3, visible: true },
  { id: "cadence", label: "Cad.", width: 64, minWidth: 50, order: 4, visible: true },
  { id: "days", label: "Days", width: 56, minWidth: 50, order: 5, visible: true },
  { id: "status", label: "Status", width: 80, minWidth: 60, order: 6, visible: true },
];

export function useColumnLayout(userId?: string) {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new columns
        const merged = DEFAULT_COLUMNS.map((def) => {
          const saved = parsed.find((c: ColumnConfig) => c.id === def.id);
          return saved ? { ...def, ...saved } : def;
        });
        setColumns(merged.sort((a, b) => a.order - b.order));
      }
    } catch (e) {
      console.error("Failed to load column layout:", e);
    }
    setIsLoaded(true);
  }, []);

  // Load from server if userId provided
  useEffect(() => {
    if (!userId || !isLoaded) return;
    
    fetch("/api/user/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data.column_layout) {
          const merged = DEFAULT_COLUMNS.map((def) => {
            const saved = data.column_layout.find((c: ColumnConfig) => c.id === def.id);
            return saved ? { ...def, ...saved } : def;
          });
          setColumns(merged.sort((a, b) => a.order - b.order));
          // Also update localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      })
      .catch((e) => console.error("Failed to load preferences:", e));
  }, [userId, isLoaded]);

  // Save layout
  const saveLayout = useCallback(async (newColumns: ColumnConfig[]) => {
    // Always save to localStorage immediately
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newColumns));
    
    // Save to server (debounced by caller if needed)
    if (userId) {
      setIsSaving(true);
      try {
        await fetch("/api/user/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column_layout: newColumns }),
        });
      } catch (e) {
        console.error("Failed to save preferences:", e);
      }
      setIsSaving(false);
    }
  }, [userId]);

  // Update column width
  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setColumns((prev) => {
      const updated = prev.map((col) =>
        col.id === columnId ? { ...col, width: Math.max(col.minWidth, width) } : col
      );
      saveLayout(updated);
      return updated;
    });
  }, [saveLayout]);

  // Reorder columns
  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      // Update order numbers
      const reordered = updated.map((col, idx) => ({ ...col, order: idx }));
      saveLayout(reordered);
      return reordered;
    });
  }, [saveLayout]);

  // Reset to defaults
  const resetLayout = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
    saveLayout(DEFAULT_COLUMNS);
  }, [saveLayout]);

  // Get sorted columns
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return {
    columns: sortedColumns,
    isLoaded,
    isSaving,
    setColumnWidth,
    reorderColumns,
    resetLayout,
  };
}

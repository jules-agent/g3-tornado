"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";

const STORAGE_KEY = "g3-column-layout";

type ColumnConfig = {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  align?: "left" | "center";
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "id", label: "ID", width: 56, minWidth: 50, align: "left" },
  { id: "task", label: "Task", width: 250, minWidth: 150, align: "left" },
  { id: "project", label: "Project", width: 100, minWidth: 80, align: "left" },
  { id: "updated", label: "Updated", width: 80, minWidth: 60, align: "left" },
  { id: "currentGate", label: "Current Gate", width: 110, minWidth: 90, align: "left" },
  { id: "nextGate", label: "Next Gate", width: 110, minWidth: 90, align: "left" },
  { id: "nextStep", label: "Next Step", width: 150, minWidth: 100, align: "left" },
  { id: "cadence", label: "Cad.", width: 50, minWidth: 40, align: "center" },
  { id: "days", label: "Days", width: 50, minWidth: 40, align: "center" },
  { id: "status", label: "Status", width: 70, minWidth: 60, align: "center" },
];

type Gate = {
  name: string;
  owner_name: string;
  completed: boolean;
};

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  daysSinceMovement: number;
  task_number: string | null;
  projects: { id: string; name: string } | null;
  ownerNames: string;
  isOverdue: boolean;
  last_movement_at: string;
  gates: Gate[] | null;
  next_step: string | null;
};

type TaskTableProps = {
  tasks: Task[];
  total: number;
};

export function TaskTable({ tasks, total }: TaskTableProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [loaded, setLoaded] = useState(false);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Handle row selection with shift+click for bulk select
  const handleRowClick = (e: React.MouseEvent, taskId: string, index: number) => {
    if (e.shiftKey && lastSelectedIndex !== null) {
      // Shift+click: select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelected = new Set(selectedRows);
      for (let i = start; i <= end; i++) {
        newSelected.add(tasks[i].id);
      }
      setSelectedRows(newSelected);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle single
      const newSelected = new Set(selectedRows);
      if (newSelected.has(taskId)) {
        newSelected.delete(taskId);
      } else {
        newSelected.add(taskId);
      }
      setSelectedRows(newSelected);
      setLastSelectedIndex(index);
    } else {
      // Normal click: select single (clear others)
      setSelectedRows(new Set([taskId]));
      setLastSelectedIndex(index);
    }
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
    setLastSelectedIndex(null);
  };

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults
        const merged = DEFAULT_COLUMNS.map((def) => {
          const saved = parsed.find((c: ColumnConfig) => c.id === def.id);
          return saved ? { ...def, width: saved.width } : def;
        });
        // Restore order if saved
        if (parsed[0]?.order !== undefined) {
          merged.sort((a, b) => {
            const aOrder = parsed.find((c: ColumnConfig & { order?: number }) => c.id === a.id)?.order ?? 0;
            const bOrder = parsed.find((c: ColumnConfig & { order?: number }) => c.id === b.id)?.order ?? 0;
            return aOrder - bOrder;
          });
        }
        setColumns(merged);
      }
    } catch (e) {
      console.error("Failed to load columns:", e);
    }
    setLoaded(true);
  }, []);

  // Save to localStorage
  const saveColumns = useCallback((cols: ColumnConfig[]) => {
    const toSave = cols.map((c, i) => ({ id: c.id, width: c.width, order: i }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: colId, startX: e.clientX, startWidth: currentWidth });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const col = columns.find((c) => c.id === resizing.id);
      if (!col) return;
      const newWidth = Math.max(col.minWidth, resizing.startWidth + diff);
      setColumns((prev) => {
        const updated = prev.map((c) => (c.id === resizing.id ? { ...c, width: newWidth } : c));
        return updated;
      });
    };

    const handleUp = () => {
      setColumns((prev) => {
        saveColumns(prev);
        return prev;
      });
      setResizing(null);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [resizing, columns, saveColumns]);

  // Drag & drop for reordering
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedCol(colId);
    setTimeout(() => (e.target as HTMLElement).style.opacity = "0.5", 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "";
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (colId !== draggedCol) {
      setDragOverCol(colId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetId) return;

    setColumns((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === draggedCol);
      const toIdx = prev.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      saveColumns(updated);
      return updated;
    });

    setDraggedCol(null);
    setDragOverCol(null);
  };

  const resetLayout = () => {
    setColumns(DEFAULT_COLUMNS);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!loaded) {
    return <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-lg" />;
  }

  return (
    <div>
      {/* Selection banner */}
      {selectedRows.size > 0 && (
        <div className="mb-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-lg flex items-center justify-between">
          <span className="text-sm text-teal-800 dark:text-teal-200">
            <span className="font-semibold">{selectedRows.size}</span> task{selectedRows.size > 1 ? "s" : ""} selected
            <span className="text-teal-600 dark:text-teal-400 ml-2">(Shift+click to select range)</span>
          </span>
          <div className="flex gap-2">
            <button 
              onClick={clearSelection}
              className="text-xs px-2 py-1 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Clear
            </button>
            <button className="text-xs px-2 py-1 rounded bg-teal-500 text-white hover:bg-teal-600">
              Bulk Edit
            </button>
          </div>
        </div>
      )}

      {/* Reset button */}
      <div className="flex justify-end mb-1">
        <button onClick={resetLayout} className="text-[10px] text-slate-400 hover:text-teal-500 transition">
          Reset columns
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: columns.reduce((sum, c) => sum + c.width, 0) }}>
            <colgroup>
              {columns.map((col) => (
                <col key={col.id} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="table-header text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {columns.map((col) => (
                  <th
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`relative px-3 py-2 font-semibold select-none ${
                      col.align === "center" ? "text-center" : "text-left"
                    } ${dragOverCol === col.id ? "bg-teal-100 dark:bg-teal-900/30" : ""}`}
                    style={{ cursor: draggedCol ? "grabbing" : "grab" }}
                  >
                    <span className="truncate block pr-2">{col.label}</span>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-teal-400/50 transition-colors z-10"
                      onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
                    >
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-300 dark:bg-slate-600" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {tasks.length > 0 ? (
                tasks.map((task, index) => {
                  const isSelected = selectedRows.has(task.id);
                  let rowClasses = "table-row cursor-pointer";
                  if (isSelected) {
                    rowClasses += " ring-2 ring-teal-500 ring-inset bg-teal-50 dark:bg-teal-900/20";
                  } else if (task.status === "closed") {
                    rowClasses += " bg-slate-50/50 dark:bg-slate-800/60 text-slate-400";
                  } else if (task.isOverdue) {
                    rowClasses += " bg-gradient-to-r from-red-50 to-white dark:from-red-900/30 dark:to-slate-800 border-l-4 border-l-red-500";
                  } else if (task.is_blocked) {
                    rowClasses += " bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/30 dark:to-slate-800 border-l-4 border-l-amber-500";
                  } else {
                    rowClasses += " bg-white dark:bg-slate-800/40";
                  }

                  return (
                    <tr 
                      key={task.id} 
                      className={rowClasses}
                      onClick={(e) => handleRowClick(e, task.id, index)}
                    >
                      {columns.map((col) => (
                        <td key={col.id} className={`px-3 py-2 ${col.align === "center" ? "text-center" : ""}`}>
                          {renderCell(col.id, task)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                    No tasks match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-[11px] text-slate-400 text-right mt-1">
        {tasks.filter((t) => t.status !== "closed").length} of {total}
      </div>
    </div>
  );
}

function renderCell(columnId: string, task: Task) {
  switch (columnId) {
    case "id":
      return (
        <Link href={`/tasks/${task.id}`} className="text-slate-600 dark:text-slate-300 hover:text-cyan-600 font-mono text-xs font-medium">
          {task.task_number || "—"}
        </Link>
      );

    case "task":
      return (
        <>
          <Link href={`/tasks/${task.id}`} className="group">
            <span className={`group-hover:text-cyan-500 transition text-sm ${task.status === "closed" ? "text-slate-400" : "text-slate-900 dark:text-white font-medium"}`}>
              {task.description}
            </span>
          </Link>
          {task.isOverdue && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">OVERDUE</span>
          )}
          {task.is_blocked && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">BLOCKED</span>
          )}
        </>
      );

    case "project":
      return <span className="text-slate-700 dark:text-slate-200 truncate text-sm">{task.projects?.name ?? "—"}</span>;

    case "updated": {
      const date = new Date(task.last_movement_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      let colorClass = "text-green-600";
      let displayText = "Today";
      if (diffDays === 1) {
        displayText = "1d ago";
        colorClass = "text-green-600";
      } else if (diffDays > 1 && diffDays <= 3) {
        displayText = `${diffDays}d ago`;
        colorClass = "text-yellow-600";
      } else if (diffDays > 3) {
        displayText = `${diffDays}d ago`;
        colorClass = "text-red-600";
      }
      return <span className={`text-xs font-medium ${colorClass}`}>{displayText}</span>;
    }

    case "currentGate": {
      const gates = task.gates || [];
      const currentIdx = gates.findIndex(g => !g.completed);
      if (currentIdx === -1) return <span className="text-slate-400 text-xs">—</span>;
      const gate = gates[currentIdx];
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
          <span className="opacity-60">{currentIdx + 1}/{gates.length}</span>
          <span className="truncate">{gate.owner_name}</span>
        </span>
      );
    }

    case "nextGate": {
      const gates = task.gates || [];
      const currentIdx = gates.findIndex(g => !g.completed);
      const nextIdx = currentIdx >= 0 ? gates.findIndex((g, i) => i > currentIdx && !g.completed) : -1;
      if (nextIdx === -1) return <span className="text-slate-400 text-xs">—</span>;
      const gate = gates[nextIdx];
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-medium">
          <span className="opacity-60">{nextIdx + 1}/{gates.length}</span>
          <span className="truncate">{gate.owner_name}</span>
        </span>
      );
    }

    case "nextStep":
      return (
        <span className="text-slate-600 dark:text-slate-300 text-xs truncate" title={task.next_step || ""}>
          {task.next_step || "—"}
        </span>
      );

    case "cadence":
      return <span className="text-slate-500 text-xs">{task.fu_cadence_days}d</span>;

    case "days":
      return (
        <span className={`font-bold text-lg ${
          task.status === "closed" ? "text-slate-400" :
          task.isOverdue ? "text-red-600" :
          task.daysSinceMovement > task.fu_cadence_days * 0.75 ? "text-amber-600" : "text-emerald-600"
        }`}>
          {task.daysSinceMovement}
        </span>
      );

    case "status":
      if (task.status === "closed") {
        return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-200 text-slate-600">CLOSED</span>;
      }
      if (task.status === "close_requested") {
        return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-700">PENDING</span>;
      }
      return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700">OPEN</span>;

    default:
      return null;
  }
}

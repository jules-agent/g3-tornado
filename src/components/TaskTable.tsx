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
  editable?: boolean;
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "id", label: "ID", width: 56, minWidth: 50, align: "left" },
  { id: "task", label: "Task", width: 250, minWidth: 150, align: "left" },
  { id: "project", label: "Project", width: 100, minWidth: 80, align: "left", editable: true },
  { id: "updated", label: "Updated", width: 80, minWidth: 60, align: "left" },
  { id: "currentGate", label: "Current Gate", width: 110, minWidth: 90, align: "left" },
  { id: "nextGate", label: "Next Gate", width: 110, minWidth: 90, align: "left" },
  { id: "nextStep", label: "Next Step", width: 150, minWidth: 100, align: "left", editable: true },
  { id: "cadence", label: "Cad.", width: 50, minWidth: 40, align: "center", editable: true },
  { id: "days", label: "Days", width: 50, minWidth: 40, align: "center" },
  { id: "status", label: "Status", width: 70, minWidth: 60, align: "center", editable: true },
];

// Columns that support bulk edit
const BULK_EDITABLE_COLUMNS = ["project", "nextStep", "cadence", "status"];

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

type SelectedCell = {
  taskId: string;
  columnId: string;
};

export function TaskTable({ tasks, total }: TaskTableProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [loaded, setLoaded] = useState(false);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  
  // Cell-based selection (all cells must be in same column)
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  // Bulk edit UI state
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditValue, setBulkEditValue] = useState("");

  // Check if a cell is selected
  const isCellSelected = (taskId: string, columnId: string) => {
    return selectedCells.some(c => c.taskId === taskId && c.columnId === columnId);
  };

  // Handle cell click for selection
  const handleCellClick = (e: React.MouseEvent, taskId: string, columnId: string, rowIndex: number) => {
    // Only allow selection on editable columns
    if (!BULK_EDITABLE_COLUMNS.includes(columnId)) {
      // If clicking non-editable cell, just navigate or ignore
      return;
    }

    e.stopPropagation();

    if (e.shiftKey && lastSelectedIndex !== null && activeColumn === columnId) {
      // Shift+click: select range in same column
      const start = Math.min(lastSelectedIndex, rowIndex);
      const end = Math.max(lastSelectedIndex, rowIndex);
      const newCells: SelectedCell[] = [];
      for (let i = start; i <= end; i++) {
        newCells.push({ taskId: tasks[i].id, columnId });
      }
      setSelectedCells(newCells);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle cell
      if (activeColumn && activeColumn !== columnId) {
        // Switching columns - start fresh
        setSelectedCells([{ taskId, columnId }]);
        setActiveColumn(columnId);
      } else {
        // Same column - toggle
        const exists = isCellSelected(taskId, columnId);
        if (exists) {
          const filtered = selectedCells.filter(c => !(c.taskId === taskId && c.columnId === columnId));
          setSelectedCells(filtered);
          if (filtered.length === 0) setActiveColumn(null);
        } else {
          setSelectedCells([...selectedCells, { taskId, columnId }]);
          setActiveColumn(columnId);
        }
      }
      setLastSelectedIndex(rowIndex);
    } else {
      // Normal click: select single cell
      setSelectedCells([{ taskId, columnId }]);
      setActiveColumn(columnId);
      setLastSelectedIndex(rowIndex);
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedCells([]);
    setActiveColumn(null);
    setLastSelectedIndex(null);
    setShowBulkEdit(false);
    setBulkEditValue("");
  };

  // Get column label
  const getColumnLabel = (colId: string) => {
    return columns.find(c => c.id === colId)?.label || colId;
  };

  // Apply bulk edit
  const applyBulkEdit = async () => {
    if (!activeColumn || selectedCells.length === 0) return;
    
    // TODO: Call API to update all selected tasks
    console.log("Bulk edit:", {
      column: activeColumn,
      value: bulkEditValue,
      taskIds: selectedCells.map(c => c.taskId)
    });
    
    // For now, just clear selection
    clearSelection();
    // TODO: Trigger refresh
  };

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = DEFAULT_COLUMNS.map((def) => {
          const saved = parsed.find((c: ColumnConfig) => c.id === def.id);
          return saved ? { ...def, width: saved.width } : def;
        });
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
    <div className="relative">
      {/* Floating action bar for bulk edit */}
      {selectedCells.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="text-teal-400 font-bold text-lg">{selectedCells.length}</span>
            <span className="text-slate-300">
              cell{selectedCells.length > 1 ? "s" : ""} in <span className="font-semibold text-white">{getColumnLabel(activeColumn!)}</span>
            </span>
          </div>
          
          <div className="h-6 w-px bg-slate-600" />
          
          {/* Edit input based on column type */}
          {activeColumn === "status" ? (
            <select
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 focus:border-teal-500 focus:outline-none"
            >
              <option value="">Set status...</option>
              <option value="open">Open</option>
              <option value="close_requested">Pending Close</option>
              <option value="closed">Closed</option>
            </select>
          ) : activeColumn === "cadence" ? (
            <input
              type="number"
              min="1"
              max="90"
              placeholder="Days..."
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 focus:border-teal-500 focus:outline-none w-24"
            />
          ) : (
            <input
              type="text"
              placeholder={`Set ${getColumnLabel(activeColumn!)}...`}
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 focus:border-teal-500 focus:outline-none w-48"
            />
          )}
          
          <button
            onClick={applyBulkEdit}
            disabled={!bulkEditValue}
            className="bg-teal-500 hover:bg-teal-600 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg text-sm font-semibold transition"
          >
            Apply
          </button>
          
          <button
            onClick={clearSelection}
            className="text-slate-400 hover:text-white px-2 py-1 text-sm transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Help text */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-slate-400">
          💡 <span className="font-medium">Bulk edit:</span> Cmd+click cells in same column, then edit
        </span>
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
                    <span className="truncate block pr-2">
                      {col.label}
                      {BULK_EDITABLE_COLUMNS.includes(col.id) && (
                        <span className="ml-1 text-teal-500 opacity-50">•</span>
                      )}
                    </span>
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
                  let rowClasses = "table-row";
                  if (task.status === "closed") {
                    rowClasses += " bg-slate-50/50 dark:bg-slate-800/60 text-slate-400";
                  } else if (task.isOverdue) {
                    rowClasses += " bg-gradient-to-r from-red-50 to-white dark:from-red-900/30 dark:to-slate-800 border-l-4 border-l-red-500";
                  } else if (task.is_blocked) {
                    rowClasses += " bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/30 dark:to-slate-800 border-l-4 border-l-amber-500";
                  } else {
                    rowClasses += " bg-white dark:bg-slate-800/40";
                  }

                  return (
                    <tr key={task.id} className={rowClasses}>
                      {columns.map((col) => {
                        const isEditable = BULK_EDITABLE_COLUMNS.includes(col.id);
                        const isSelected = isCellSelected(task.id, col.id);
                        
                        let cellClasses = `px-3 py-2 ${col.align === "center" ? "text-center" : ""}`;
                        if (isEditable) {
                          cellClasses += " cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors";
                        }
                        if (isSelected) {
                          cellClasses += " ring-2 ring-teal-500 ring-inset bg-teal-100 dark:bg-teal-900/40";
                        }

                        return (
                          <td
                            key={col.id}
                            className={cellClasses}
                            onClick={(e) => isEditable && handleCellClick(e, task.id, col.id, index)}
                          >
                            {renderCell(col.id, task)}
                          </td>
                        );
                      })}
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

"use client";

import Link from "next/link";
import { useColumnLayout } from "@/hooks/useColumnLayout";
import { ResizableTable } from "@/components/ResizableTable";

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  last_movement_at: string;
  task_number: string | null;
  project_id: string;
  projects: { id: string; name: string } | null;
  ownerNames: string;
  daysRemaining: number;
  cadenceDisplay: string;
  isStale: boolean;
};

type TaskTableClientProps = {
  tasks: Task[];
  userId?: string;
};

export function TaskTableClient({ tasks, userId }: TaskTableClientProps) {
  const { columns, isLoaded, setColumnWidth, reorderColumns, resetLayout } = useColumnLayout(userId);

  // Convert tasks to generic row data
  const data = tasks.map((task) => ({
    ...task,
    _id: task.id,
  }));

  // Render cell content based on column ID
  const renderCell = (columnId: string, row: Record<string, unknown>) => {
    const task = row as unknown as Task;
    
    switch (columnId) {
      case "id":
        return (
          <Link
            href={`/tasks/${task.id}`}
            className="font-mono text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 text-xs"
          >
            {task.task_number || "—"}
          </Link>
        );
      
      case "task":
        return (
          <div className="flex items-center flex-wrap gap-1">
            <Link
              href={`/tasks/${task.id}`}
              className="text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 font-medium truncate text-sm"
            >
              {task.description}
            </Link>
            {task.isStale && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                STALE
              </span>
            )}
            {task.is_blocked && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                BLOCKED
              </span>
            )}
          </div>
        );
      
      case "project":
        return (
          <span className="text-slate-700 dark:text-slate-200 truncate text-sm">
            {task.projects?.name ?? "—"}
          </span>
        );
      
      case "owner":
        return (
          <span className="text-slate-700 dark:text-slate-200 truncate text-sm">
            {task.ownerNames || "—"}
          </span>
        );
      
      case "cadence":
        return (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {task.cadenceDisplay}
          </span>
        );
      
      case "days":
        const daysClass = task.status === "CLOSED"
          ? "text-slate-400"
          : task.isStale
            ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
            : task.daysRemaining <= 1
              ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
              : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300";
        
        return (
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${daysClass}`}>
            {task.status === "CLOSED" ? "—" : task.daysRemaining}
          </span>
        );
      
      case "status":
        const statusClass = task.status === "CLOSED"
          ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
        
        return (
          <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase ${statusClass}`}>
            {task.status}
          </span>
        );
      
      default:
        return null;
    }
  };

  // Row class based on status
  const getRowClassName = (row: Record<string, unknown>) => {
    const task = row as unknown as Task;
    let classes = "table-row";
    if (task.isStale && task.status !== "CLOSED") {
      classes += " bg-amber-50/50 dark:bg-amber-950/20";
    }
    return classes;
  };

  if (!isLoaded) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded mb-2" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded mb-2" />
      </div>
    );
  }

  return (
    <div>
      {/* Layout controls */}
      <div className="flex justify-end mb-2">
        <button
          onClick={resetLayout}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Reset columns
        </button>
      </div>
      
      <ResizableTable
        columns={columns}
        onColumnResize={setColumnWidth}
        onColumnReorder={reorderColumns}
        renderCell={renderCell}
        data={data}
        rowClassName={getRowClassName}
      />
      
      {/* Row count */}
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
        {tasks.filter((t) => t.status !== "CLOSED").length} of {tasks.length}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useRef, useCallback, ReactNode } from "react";
import { ColumnConfig } from "@/hooks/useColumnLayout";

type ResizableTableProps = {
  columns: ColumnConfig[];
  onColumnResize: (columnId: string, width: number) => void;
  onColumnReorder: (fromIndex: number, toIndex: number) => void;
  renderCell: (columnId: string, rowData: Record<string, unknown>, rowIndex: number) => ReactNode;
  data: Record<string, unknown>[];
  rowClassName?: (rowData: Record<string, unknown>, rowIndex: number) => string;
  onRowClick?: (rowData: Record<string, unknown>, rowIndex: number) => void;
};

export function ResizableTable({
  columns,
  onColumnResize,
  onColumnReorder,
  renderCell,
  data,
  rowClassName,
  onRowClick,
}: ResizableTableProps) {
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState<{ columnId: string; fromIndex: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ columnId, startX: e.clientX, startWidth: currentWidth });
  }, []);

  // Handle resize move
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(50, resizing.startWidth + diff);
    onColumnResize(resizing.columnId, newWidth);
  }, [resizing, onColumnResize]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  // Add/remove global mouse listeners for resize
  React.useEffect(() => {
    if (resizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, handleResizeMove, handleResizeEnd]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, columnId: string, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnId);
    setDragging({ columnId, fromIndex: index });
    // Add a slight delay to show drag styling
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.5";
    }, 0);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "";
    setDragging(null);
    setDragOverIndex(null);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragging && dragging.fromIndex !== toIndex) {
      onColumnReorder(dragging.fromIndex, toIndex);
    }
    setDragging(null);
    setDragOverIndex(null);
  }, [dragging, onColumnReorder]);

  return (
    <div className="overflow-x-auto">
      <table ref={tableRef} className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr className="table-header text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {columns.filter(c => c.visible).map((column, index) => (
              <th
                key={column.id}
                draggable
                onDragStart={(e) => handleDragStart(e, column.id, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative px-3 py-2 font-semibold select-none ${
                  dragOverIndex === index ? "bg-teal-100 dark:bg-teal-900/30" : ""
                } ${column.id === "cadence" || column.id === "days" || column.id === "status" ? "text-center" : ""}`}
                style={{ 
                  width: column.width, 
                  minWidth: column.minWidth,
                  cursor: dragging ? "grabbing" : "grab",
                }}
              >
                <span className="truncate block pr-2">{column.label}</span>
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-teal-400 transition-colors group"
                  onMouseDown={(e) => handleResizeStart(e, column.id, column.width)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-300 dark:bg-slate-600 group-hover:bg-teal-500 transition-colors" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={rowClassName?.(row, rowIndex) || "table-row"}
              onClick={() => onRowClick?.(row, rowIndex)}
            >
              {columns.filter(c => c.visible).map((column) => (
                <td
                  key={column.id}
                  className={`px-3 py-2 ${
                    column.id === "cadence" || column.id === "days" || column.id === "status" ? "text-center" : ""
                  }`}
                  style={{ width: column.width, minWidth: column.minWidth }}
                >
                  {renderCell(column.id, row, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

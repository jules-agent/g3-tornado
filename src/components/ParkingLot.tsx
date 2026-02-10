"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type ParkingLotItem = {
  id: string;
  description: string;
  created_at: string;
  spawned_task_id: string | null;
};

export function ParkingLot({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<ParkingLotItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const fetchItems = async () => {
    const res = await fetch("/api/parking-lot");
    if (res.ok) setItems(await res.json());
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    setLoading(true);
    const res = await fetch("/api/parking-lot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: newItem.trim() }),
    });
    if (res.ok) {
      const item = await res.json();
      setItems([item, ...items]);
      setNewItem("");
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/parking-lot?id=${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = async (id: string, description: string) => {
    if (!description.trim()) return;
    const res = await fetch("/api/parking-lot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, description: description.trim() }),
    });
    if (res.ok) {
      setItems(items.map((i) => i.id === id ? { ...i, description: description.trim() } : i));
    }
    setEditingId(null);
    setEditingValue("");
  };

  const spawnTask = (item: ParkingLotItem) => {
    // Close parking lot, then navigate to new task with prefill
    onClose();
    router.push(`/tasks/new?parking=${item.id}&desc=${encodeURIComponent(item.description)}`);
  };

  const startEditing = (item: ParkingLotItem) => {
    setEditingId(item.id);
    setEditingValue(item.description);
  };

  const getAge = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAgeClass = (days: number) => {
    if (days >= 14) return "animate-pulse-red";
    if (days >= 7) return "animate-pulse-orange";
    return "";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">🅿️ Parking Lot</h2>
            <p className="text-xs text-slate-400 mt-0.5">Future tasks — jot them down, spawn when ready</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        {/* Add new item */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Type a future task..."
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={addItem}
            disabled={loading || !newItem.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-500 text-white font-bold text-lg hover:bg-teal-600 disabled:opacity-50 transition"
          >
            +
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No items yet. Add your first future task above.
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => {
                const days = getAge(item.created_at);
                const ageClass = getAgeClass(days);
                const isEditing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg group hover:bg-slate-50 dark:hover:bg-slate-700/50 ${ageClass}`}
                  >
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateItem(item.id, editingValue);
                            if (e.key === "Escape") { setEditingId(null); setEditingValue(""); }
                          }}
                          onBlur={() => updateItem(item.id, editingValue)}
                          className="w-full rounded border border-teal-300 dark:border-teal-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                          autoFocus
                        />
                      ) : (
                        <p
                          className="text-sm text-slate-800 dark:text-slate-200 truncate cursor-text hover:text-teal-700 dark:hover:text-teal-300 transition"
                          onClick={() => startEditing(item)}
                          title="Click to edit"
                        >
                          {item.description}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString()} · {days}d ago
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={() => spawnTask(item)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 hover:bg-teal-200 transition text-xs"
                        title="Spawn as task"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 transition text-xs font-bold"
                        title="Delete"
                      >
                        −
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 flex justify-between">
          <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"></span>&gt;7d
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-2 mr-1"></span>&gt;14d
          </span>
        </div>
      </div>
    </div>
  );
}

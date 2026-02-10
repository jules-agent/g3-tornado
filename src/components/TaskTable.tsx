"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { GateEditor } from "./GateEditor";
import { OwnerEditor } from "./OwnerEditor";

const STORAGE_KEY = "g3-view-preferences";

type ColumnConfig = {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  align?: "left" | "center";
  editable?: boolean;
  defaultVisible?: boolean;
};

const COLUMN_TOOLTIPS: Record<string, string> = {
  task: "Task description and title",
  project: "Project this task belongs to",
  currentGate: "Current gate: Owner / Task to complete",
  nextGate: "Next gate: Owner / Task to complete",
  nextStep: "Next action to be taken",
  notes: "Most recent note - hover 📝 for full history",
  cadence: "Follow-up frequency in days",
  aging: "Days since last update / Days since task created",
  status: "Current task status (Open/Pending/Done)",
  owner: "Task owner(s) responsible",
  gated: "Waiting for a gate to pass",
  id: "Unique task identifier",
};

const ALL_COLUMNS: ColumnConfig[] = [
  { id: "task", label: "Task", width: 250, minWidth: 150, align: "left", editable: true, defaultVisible: true },
  { id: "project", label: "Project", width: 100, minWidth: 80, align: "left", editable: true, defaultVisible: true },
  { id: "currentGate", label: "Current Gate", width: 140, minWidth: 110, align: "left", editable: true, defaultVisible: true },
  { id: "nextGate", label: "Next Gate", width: 140, minWidth: 110, align: "left", editable: true, defaultVisible: true },
  { id: "nextStep", label: "Next Step", width: 150, minWidth: 100, align: "left", editable: true, defaultVisible: true },
  { id: "notes", label: "Update", width: 200, minWidth: 150, align: "left", defaultVisible: true },
  { id: "cadence", label: "Cad.", width: 50, minWidth: 40, align: "center", editable: true, defaultVisible: true },
  { id: "aging", label: "Aging", width: 70, minWidth: 60, align: "center", defaultVisible: true },
  { id: "status", label: "Status", width: 70, minWidth: 60, align: "center", editable: true, defaultVisible: true },
  { id: "owner", label: "Owner", width: 100, minWidth: 80, align: "left", editable: true, defaultVisible: false },
  { id: "gated", label: "Gated", width: 70, minWidth: 60, align: "center", defaultVisible: false },
  { id: "id", label: "ID", width: 56, minWidth: 50, align: "left", defaultVisible: false },
];

const BULK_EDITABLE_COLUMNS = ["task", "project", "currentGate", "nextGate", "nextStep", "cadence", "status", "owner"];

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

type TaskNote = {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  daysSinceMovement: number;
  daysSinceCreated: number;
  task_number: string | null;
  projects: { id: string; name: string } | null;
  ownerNames: string;
  ownerIds: string[];
  isStale: boolean;
  isMyTask: boolean;
  last_movement_at: string;
  created_at: string;
  gates: Gate[] | null;
  next_step: string | null;
  notes: TaskNote[];
};

type TaskTableProps = {
  tasks: Task[];
  total: number;
  allTasks?: Task[];
  currentProject?: string;
  currentFilter?: string;
};

type SelectedCell = {
  taskId: string;
  columnId: string;
};

type ViewProfile = {
  id: string;
  name: string;
  columns: Array<{ id: string; width: number; order: number }>;
  visibleColumns: string[];
  scale: number;
};

type ViewPreferences = {
  profiles: Record<string, ViewProfile>;
  defaults: { desktop: string | null; mobile: string | null };
  lastUsed: { desktop: string | null; mobile: string | null };
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

const DEFAULT_PROFILE: ViewProfile = {
  id: 'default',
  name: 'Default',
  columns: ALL_COLUMNS.filter(c => c.defaultVisible).map((c, i) => ({ id: c.id, width: c.width, order: i })),
  visibleColumns: ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id),
  scale: 100
};

export function TaskTable({ tasks, total, allTasks, currentProject = "all", currentFilter = "open" }: TaskTableProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  // View profiles state
  const [allProfiles, setAllProfiles] = useState<Record<string, ViewProfile>>({ default: DEFAULT_PROFILE });
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');
  const [defaults, setDefaults] = useState<{ desktop: string | null; mobile: string | null }>({ desktop: null, mobile: null });
  
  // Current view state
  const [columns, setColumns] = useState<ColumnConfig[]>(() => ALL_COLUMNS.filter(c => c.defaultVisible));
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  const [scale, setScale] = useState(100);
  
  // UI state
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Inline note editing
  const [editingNoteTaskId, setEditingNoteTaskId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);
  
  // Resize/drag state
  const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  
  // Mobile resize mode - tap column to select, then use +/- buttons
  const [mobileResizeCol, setMobileResizeCol] = useState<string | null>(null);
  
  // Cell selection state
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkEditValue, setBulkEditValue] = useState("");
  
  // Notes tooltip
  const [hoveredNotes, setHoveredNotes] = useState<{ taskId: string; notes: TaskNote[] } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Gate editor state
  const [editingGate, setEditingGate] = useState<{ taskId: string; gateIndex: number; gates: Gate[] } | null>(null);
  
  // Owner editor state
  const [editingOwner, setEditingOwner] = useState<{ taskId: string; ownerIds: string[] } | null>(null);
  
  // Row actions menu state
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Top 5 projects by open task count (for current user)
  const top5Projects = useMemo(() => {
    const source = allTasks || tasks;
    const openTasks = source.filter(t => t.status === "open" && t.isMyTask);
    const counts: Record<string, { name: string; id: string; count: number }> = {};
    for (const t of openTasks) {
      const pid = t.projects?.id;
      const pname = t.projects?.name;
      if (!pid || !pname) continue;
      if (!counts[pid]) counts[pid] = { name: pname, id: pid, count: 0 };
      counts[pid].count++;
    }
    // If user has no open tasks, fall back to all open tasks
    if (Object.keys(counts).length === 0) {
      const allOpen = source.filter(t => t.status === "open");
      for (const t of allOpen) {
        const pid = t.projects?.id;
        const pname = t.projects?.name;
        if (!pid || !pname) continue;
        if (!counts[pid]) counts[pid] = { name: pname, id: pid, count: 0 };
        counts[pid].count++;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [allTasks, tasks]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      // Close row menu if clicking outside
      if (rowMenuOpen && rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [rowMenuOpen]);

  // Apply a profile to the current view
  const applyProfile = useCallback((profile: ViewProfile) => {
    // Ensure "notes" column is visible (was added later, may be missing from old profiles)
    let visibleIds = profile.visibleColumns.length > 0 
      ? profile.visibleColumns 
      : ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);
    
    // Add notes if missing from saved profile
    if (!visibleIds.includes('notes')) {
      visibleIds = [...visibleIds, 'notes'];
    }
    
    // Migrate: Move ID to the end if it's at the beginning (old layout)
    const idIndex = visibleIds.indexOf('id');
    if (idIndex === 0 || idIndex === 1) {
      visibleIds = [...visibleIds.filter(id => id !== 'id'), 'id'];
    }
    
    setVisibleColumnIds(visibleIds);
    const visibleCols = ALL_COLUMNS.filter(c => visibleIds.includes(c.id));
    const merged = visibleCols.map((def) => {
      const saved = profile.columns.find(c => c.id === def.id);
      return saved ? { ...def, width: saved.width } : def;
    });
    
    // Re-sort to put ID at end if it was migrated
    merged.sort((a, b) => {
      // ID always goes last
      if (a.id === 'id') return 1;
      if (b.id === 'id') return -1;
      const aOrder = profile.columns.find(c => c.id === a.id)?.order ?? 999;
      const bOrder = profile.columns.find(c => c.id === b.id)?.order ?? 999;
      return aOrder - bOrder;
    });
    setColumns(merged);
    setScale(profile.scale);
    setHasUnsavedChanges(false);
  }, []);

  // Load preferences from server
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        let prefs: ViewPreferences | null = null;
        
        if (stored) {
          try { prefs = JSON.parse(stored); } catch {}
        }

        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const { preferences } = await res.json();
          if (preferences?.profiles) {
            prefs = preferences;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
          }
        }
        
        if (prefs?.profiles) {
          setAllProfiles(prefs.profiles);
          setDefaults(prefs.defaults || { desktop: null, mobile: null });
          
          // Determine which profile to load
          const defaultForDevice = prefs.defaults?.[deviceType];
          const lastUsedForDevice = prefs.lastUsed?.[deviceType];
          const profileToLoad = defaultForDevice || lastUsedForDevice || 'default';
          
          if (prefs.profiles[profileToLoad]) {
            setCurrentProfileId(profileToLoad);
            applyProfile(prefs.profiles[profileToLoad]);
          }
        }
      } catch (e) {
        console.error("Failed to load preferences:", e);
      }
      setLoaded(true);
    };
    loadPreferences();
  }, [deviceType, applyProfile]);

  // Get current config as profile data
  const getCurrentConfig = useCallback((): Omit<ViewProfile, 'id' | 'name'> => ({
    columns: columns.map((c, i) => ({ id: c.id, width: c.width, order: i })),
    visibleColumns: visibleColumnIds,
    scale
  }), [columns, visibleColumnIds, scale]);

  // Save all preferences to server
  const saveAllPreferences = useCallback(async (
    profiles: Record<string, ViewProfile>,
    newDefaults?: { desktop: string | null; mobile: string | null },
    newLastUsed?: { desktop: string | null; mobile: string | null }
  ) => {
    const prefs: ViewPreferences = {
      profiles,
      defaults: newDefaults || defaults,
      lastUsed: newLastUsed || { ...defaults, [deviceType]: currentProfileId }
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    
    setSaving(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewPreferences: prefs })
      });
    } catch (e) {
      console.error("Failed to save:", e);
    }
    setSaving(false);
  }, [defaults, deviceType, currentProfileId]);

  // Save current view to current profile
  const saveCurrentProfile = useCallback(() => {
    const config = getCurrentConfig();
    const updatedProfile = { ...allProfiles[currentProfileId], ...config };
    const updatedProfiles = { ...allProfiles, [currentProfileId]: updatedProfile };
    setAllProfiles(updatedProfiles);
    setHasUnsavedChanges(false);
    saveAllPreferences(updatedProfiles);
  }, [allProfiles, currentProfileId, getCurrentConfig, saveAllPreferences]);

  // Save as new profile
  const saveAsNewProfile = useCallback(() => {
    if (!newProfileName.trim()) return;
    const id = generateId();
    const config = getCurrentConfig();
    const newProfile: ViewProfile = { id, name: newProfileName.trim(), ...config };
    const updatedProfiles = { ...allProfiles, [id]: newProfile };
    setAllProfiles(updatedProfiles);
    setCurrentProfileId(id);
    setHasUnsavedChanges(false);
    setShowSaveDialog(false);
    setNewProfileName('');
    saveAllPreferences(updatedProfiles, undefined, { ...defaults, [deviceType]: id });
  }, [newProfileName, getCurrentConfig, allProfiles, saveAllPreferences, defaults, deviceType]);

  // Switch to a different profile
  const switchProfile = useCallback((profileId: string) => {
    if (allProfiles[profileId]) {
      setCurrentProfileId(profileId);
      applyProfile(allProfiles[profileId]);
      setShowProfileMenu(false);
      // Update last used
      const lastUsed = { desktop: deviceType === 'desktop' ? profileId : defaults.desktop, mobile: deviceType === 'mobile' ? profileId : defaults.mobile };
      saveAllPreferences(allProfiles, undefined, lastUsed as { desktop: string | null; mobile: string | null });
    }
  }, [allProfiles, applyProfile, saveAllPreferences, deviceType, defaults]);

  // Set profile as default for current device
  const setAsDefault = useCallback((profileId: string) => {
    const newDefaults = { ...defaults, [deviceType]: profileId };
    setDefaults(newDefaults);
    saveAllPreferences(allProfiles, newDefaults);
  }, [defaults, deviceType, allProfiles, saveAllPreferences]);

  // Delete a profile
  const deleteProfile = useCallback((profileId: string) => {
    if (profileId === 'default') return; // Can't delete default
    const { [profileId]: _, ...remaining } = allProfiles;
    setAllProfiles(remaining);
    if (currentProfileId === profileId) {
      setCurrentProfileId('default');
      applyProfile(remaining['default'] || DEFAULT_PROFILE);
    }
    // Clear from defaults if needed
    const newDefaults = { ...defaults };
    if (newDefaults.desktop === profileId) newDefaults.desktop = null;
    if (newDefaults.mobile === profileId) newDefaults.mobile = null;
    setDefaults(newDefaults);
    saveAllPreferences(remaining, newDefaults);
  }, [allProfiles, currentProfileId, defaults, applyProfile, saveAllPreferences]);

  // Mark changes as unsaved
  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Cell selection handlers
  const isCellSelected = (taskId: string, columnId: string) => {
    return selectedCells.some(c => c.taskId === taskId && c.columnId === columnId);
  };

  const handleCellClick = (e: React.MouseEvent, taskId: string, columnId: string, rowIndex: number) => {
    if (!BULK_EDITABLE_COLUMNS.includes(columnId)) return;
    e.stopPropagation();

    if (e.shiftKey && lastSelectedIndex !== null && activeColumn === columnId) {
      const start = Math.min(lastSelectedIndex, rowIndex);
      const end = Math.max(lastSelectedIndex, rowIndex);
      const newCells: SelectedCell[] = [];
      for (let i = start; i <= end; i++) {
        newCells.push({ taskId: tasks[i].id, columnId });
      }
      setSelectedCells(newCells);
    } else if (e.ctrlKey || e.metaKey) {
      if (activeColumn && activeColumn !== columnId) {
        setSelectedCells([{ taskId, columnId }]);
        setActiveColumn(columnId);
      } else {
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
      setSelectedCells([{ taskId, columnId }]);
      setActiveColumn(columnId);
      setLastSelectedIndex(rowIndex);
    }
  };

  const clearSelection = () => {
    setSelectedCells([]);
    setActiveColumn(null);
    setLastSelectedIndex(null);
    setBulkEditValue("");
  };

  const getColumnLabel = (colId: string) => ALL_COLUMNS.find(c => c.id === colId)?.label || colId;

  const applyBulkEdit = async () => {
    if (!activeColumn || selectedCells.length === 0 || !bulkEditValue) return;
    const taskIds = [...new Set(selectedCells.map(c => c.taskId))];
    
    const columnToField: Record<string, string> = {
      cadence: "fu_cadence_days",
      status: "status",
      nextStep: "next_step",
    };
    
    const field = columnToField[activeColumn];
    if (!field) {
      console.warn("Bulk edit not implemented for column:", activeColumn);
      clearSelection();
      return;
    }

    const value = activeColumn === "cadence" ? parseInt(bulkEditValue, 10) : bulkEditValue;
    
    const supabase = createClient();
    const updates = taskIds.map(id => 
      supabase.from("tasks").update({ [field]: value }).eq("id", id)
    );
    await Promise.all(updates);
    clearSelection();
    router.refresh();
  };

  // Column visibility toggle
  const toggleColumn = (colId: string) => {
    setVisibleColumnIds(prev => {
      const newVisible = prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId];
      const newColumns = ALL_COLUMNS.filter(c => newVisible.includes(c.id));
      const updatedColumns = newColumns.map(col => {
        const existing = columns.find(c => c.id === col.id);
        return existing ? { ...col, width: existing.width } : col;
      });
      setColumns(updatedColumns);
      markUnsaved();
      return newVisible;
    });
  };

  // Scale change
  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
    markUnsaved();
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: colId, startX: e.clientX, startWidth: currentWidth });
  };

  useEffect(() => {
    if (!resizing) return;
    
    const handleMove = (clientX: number) => {
      const diff = clientX - resizing.startX;
      const col = columns.find((c) => c.id === resizing.id);
      if (!col) return;
      const newWidth = Math.max(col.minWidth, resizing.startWidth + diff);
      setColumns((prev) => prev.map((c) => (c.id === resizing.id ? { ...c, width: newWidth } : c)));
    };
    
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };
    
    const handleUp = () => {
      markUnsaved();
      setResizing(null);
    };
    
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleUp);
    
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleUp);
    };
  }, [resizing, columns, markUnsaved]);

  // Drag handlers for column reorder
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
    if (colId !== draggedCol) setDragOverCol(colId);
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
      markUnsaved();
      return updated;
    });
    setDraggedCol(null);
    setDragOverCol(null);
  };

  // Notes hover - show full update history
  const handleNotesMouseEnter = (e: React.MouseEvent, task: Task) => {
    if (task.notes.length === 0 || editingNoteTaskId === task.id) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPosition({ x: rect.left, y: rect.bottom + 8 });
    setHoveredNotes({ taskId: task.id, notes: task.notes }); // All notes
  };

  const handleNotesMouseLeave = () => setHoveredNotes(null);

  // Inline note editing
  const startEditingNote = (taskId: string) => {
    setEditingNoteTaskId(taskId);
    setEditingNoteValue('');
    setHoveredNotes(null);
    setTimeout(() => noteInputRef.current?.focus(), 50);
  };

  const cancelEditingNote = () => {
    setEditingNoteTaskId(null);
    setEditingNoteValue('');
  };

  const saveNote = async (taskId: string) => {
    if (!editingNoteValue.trim() || savingNote) return;
    
    setSavingNote(true);
    const supabase = createClient();
    const { error } = await supabase.from("task_notes").insert({
      task_id: taskId,
      content: editingNoteValue.trim(),
    });
    
    if (error) {
      console.error("Failed to save note:", error);
      setSavingNote(false);
      return;
    }
    
    setEditingNoteTaskId(null);
    setEditingNoteValue('');
    setSavingNote(false);
    router.refresh();
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveNote(taskId);
    } else if (e.key === 'Escape') {
      cancelEditingNote();
    }
  };
  
  // Row action handlers
  const handleCloseTask = async (taskId: string) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ 
      status: "closed", 
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", taskId);
    setRowMenuOpen(null);
    router.refresh();
  };
  
  const handleReopenTask = async (taskId: string) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ 
      status: "open", 
      closed_at: null,
      updated_at: new Date().toISOString()
    }).eq("id", taskId);
    setRowMenuOpen(null);
    router.refresh();
  };
  
  const handleRequestClose = async (taskId: string) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ 
      status: "close_requested", 
      close_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", taskId);
    setRowMenuOpen(null);
    router.refresh();
  };

  const currentProfile = allProfiles[currentProfileId] || DEFAULT_PROFILE;

  if (!loaded) {
    return <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-lg" />;
  }

  return (
    <div className="relative">
      {/* Update History tooltip */}
      {hoveredNotes && (
        <div 
          className="fixed z-[100] bg-slate-900 text-white rounded-lg shadow-xl p-3 max-w-md min-w-[280px]"
          style={{ left: Math.min(tooltipPosition.x, window.innerWidth - 320), top: tooltipPosition.y }}
        >
          <div className="text-xs font-semibold text-teal-400 mb-2 flex items-center gap-2">
            <span>📋 Update History</span>
            <span className="text-slate-500">({hoveredNotes.notes.length} total)</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {hoveredNotes.notes.map((note, idx) => (
              <div key={note.id} className={`pb-2 ${idx < hoveredNotes.notes.length - 1 ? 'border-b border-slate-700' : ''}`}>
                <div className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-2">
                  <span className="font-medium text-slate-300">{note.profiles?.full_name || note.profiles?.email || 'Unknown'}</span>
                  <span>·</span>
                  <span>{new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="text-xs text-slate-200">{note.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save as dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-80 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Save View Profile</h3>
            <input
              type="text"
              placeholder="Profile name..."
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveAsNewProfile()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowSaveDialog(false); setNewProfileName(''); }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveAsNewProfile}
                disabled={!newProfileName.trim()}
                className="px-4 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk edit action bar */}
      {selectedCells.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-teal-400 font-bold text-lg">{selectedCells.length}</span>
            <span className="text-slate-300">
              cell{selectedCells.length > 1 ? "s" : ""} in <span className="font-semibold text-white">{getColumnLabel(activeColumn!)}</span>
            </span>
          </div>
          <div className="h-6 w-px bg-slate-600" />
          {activeColumn === "status" ? (
            <select value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600">
              <option value="">Set status...</option>
              <option value="open">Open</option>
              <option value="close_requested">Pending Close</option>
              <option value="closed">Closed</option>
            </select>
          ) : activeColumn === "cadence" ? (
            <input type="number" min="1" max="90" placeholder="Days..." value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 w-24" />
          ) : (
            <input type="text" placeholder={`Set ${getColumnLabel(activeColumn!)}...`} value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600 w-48" />
          )}
          <button onClick={applyBulkEdit} disabled={!bulkEditValue} className="bg-teal-500 hover:bg-teal-600 disabled:bg-slate-600 px-4 py-1.5 rounded-lg text-sm font-semibold">Apply</button>
          <button onClick={clearSelection} className="text-slate-400 hover:text-white px-2 py-1 text-sm">✕</button>
        </div>
      )}

      {/* Toolbar - compact */}
      <div className="sticky top-[40px] z-30 bg-white dark:bg-slate-900 flex flex-wrap justify-between items-center gap-1 mb-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            💡 Cmd+click cells (• columns) to bulk edit
          </span>
          {top5Projects.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[10px] text-slate-400">|</span>
              <Link href={`/?filter=${currentFilter}`} className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition ${currentProject === "all" ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-semibold" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700"}`}>
                {currentProject === "all" && "✓ "}All <span className="text-slate-400">({total})</span>
              </Link>
              {top5Projects.map((p) => (
                <Link key={p.id} href={`/?filter=${currentFilter}&project=${p.id}`} className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition ${currentProject === p.id ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-semibold" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700"}`}>
                  {currentProject === p.id && "✓ "}{p.name} <span className="text-slate-400">({p.count})</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Profile selector */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1"
            >
              <span className="text-sm">📋</span>
              <span>{currentProfile.name}</span>
              {hasUnsavedChanges && <span className="text-amber-500">•</span>}
              {defaults[deviceType] === currentProfileId && <span className="text-teal-500">★</span>}
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 min-w-[240px]">
                {/* Device indicator */}
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 rounded-t-lg">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-lg">{isMobile ? '📱' : '💻'}</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {isMobile ? 'Mobile' : 'Desktop'} View
                    </span>
                    {hasUnsavedChanges && (
                      <span className="ml-auto text-amber-500 font-medium">• unsaved</span>
                    )}
                  </div>
                </div>
                
                <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider px-2 mb-1">Saved Profiles</div>
                  {Object.values(allProfiles).map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => switchProfile(profile.id)}
                      className={`w-full flex items-center justify-between px-2 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-left ${currentProfileId === profile.id ? 'bg-teal-50 dark:bg-teal-900/30' : ''}`}
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-200">{profile.name}</span>
                      <span className="flex items-center gap-1.5">
                        {defaults[deviceType] === profile.id && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-200 rounded">
                            {isMobile ? '📱' : '💻'} default
                          </span>
                        )}
                        {currentProfileId === profile.id && <span className="text-teal-500 text-lg">✓</span>}
                      </span>
                    </button>
                  ))}
                </div>
                
                <div className="p-2 space-y-1">
                  {hasUnsavedChanges && (
                    <button onClick={saveCurrentProfile} className="w-full text-left px-2 py-2 text-sm bg-teal-500 text-white hover:bg-teal-600 rounded font-medium">
                      💾 Save to "{currentProfile.name}"
                    </button>
                  )}
                  <button onClick={() => { setShowProfileMenu(false); setShowSaveDialog(true); }} className="w-full text-left px-2 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    ➕ Save as new {isMobile ? 'mobile' : 'desktop'} profile...
                  </button>
                  {defaults[deviceType] !== currentProfileId && (
                    <button onClick={() => { setAsDefault(currentProfileId); setShowProfileMenu(false); }} className="w-full text-left px-2 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                      ★ Set as {isMobile ? 'mobile' : 'desktop'} default
                    </button>
                  )}
                  {currentProfileId !== 'default' && (
                    <button onClick={() => { deleteProfile(currentProfileId); setShowProfileMenu(false); }} className="w-full text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                      🗑 Delete profile
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Column picker */}
          <div className="relative" ref={columnPickerRef}>
            <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1">
              <span className="text-sm">⚙️</span><span>Columns</span>
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-2 min-w-[180px]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1">Show/Hide</div>
                {ALL_COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                    <input type="checkbox" checked={visibleColumnIds.includes(col.id)} onChange={() => toggleColumn(col.id)} className="rounded border-slate-300 text-teal-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{col.label}</span>
                    {BULK_EDITABLE_COLUMNS.includes(col.id) && <span className="text-teal-500 text-xs">•</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
            <button onClick={() => handleScaleChange(Math.max(20, scale - 10))} disabled={scale <= 20} className="w-6 h-6 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30">−</button>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 w-9 text-center">{scale}%</span>
            <button onClick={() => handleScaleChange(Math.min(200, scale + 10))} disabled={scale >= 200} className="w-6 h-6 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30">+</button>
          </div>
          
          {saving && <span className="text-[10px] text-teal-500 animate-pulse">💾</span>}
        </div>
      </div>

      {/* Table */}
      <div 
        ref={tableRef}
        className="card"
        style={scale !== 100 ? { transformOrigin: 'top left', transform: `scale(${scale / 100})`, width: `${100 / (scale / 100)}%` } : undefined}
      >
        <div>
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: columns.reduce((sum, c) => sum + c.width, 0) + 36 }}>
            <colgroup>
              <col style={{ width: 36 }} /> {/* Actions column */}
              {columns.map((col) => <col key={col.id} style={{ width: col.width }} />)}
            </colgroup>
            <thead>
              <tr className="table-header text-left text-xs text-slate-700 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/80">
                <th className="px-1 py-2 w-9 sticky top-[68px] z-20 bg-slate-50 dark:bg-slate-800/80"></th> {/* Actions header - empty */}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    draggable={!isMobile}
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`relative px-3 py-2 font-semibold select-none sticky top-[68px] z-20 bg-slate-50 dark:bg-slate-800/80 ${col.align === "center" ? "text-center" : "text-left"} ${dragOverCol === col.id ? "bg-teal-100 dark:bg-teal-900/30" : ""} ${mobileResizeCol === col.id ? "bg-teal-100 dark:bg-teal-900/50 ring-2 ring-teal-500 z-40 overflow-visible" : "overflow-hidden"}`}
                    style={{ cursor: isMobile ? 'pointer' : (draggedCol ? "grabbing" : "grab") }}
                    title={COLUMN_TOOLTIPS[col.id] || col.label}
                    onClick={isMobile ? () => setMobileResizeCol(mobileResizeCol === col.id ? null : col.id) : undefined}
                  >
                    {/* Mobile resize mode UI - centered with high z-index to overlay adjacent columns when needed */}
                    {isMobile && mobileResizeCol === col.id ? (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-teal-300 dark:border-teal-600 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newWidth = Math.max(col.minWidth, col.width - 20);
                              setColumns(prev => prev.map(c => c.id === col.id ? { ...c, width: newWidth } : c));
                              markUnsaved();
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full text-lg font-bold text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-600"
                          >
                            −
                          </button>
                          <span className="text-xs font-mono text-teal-600 dark:text-teal-400 min-w-[40px] text-center">{col.width}px</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newWidth = col.width + 20;
                              setColumns(prev => prev.map(c => c.id === col.id ? { ...c, width: newWidth } : c));
                              markUnsaved();
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full text-lg font-bold text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="truncate block pr-2">
                          {col.label}
                          {BULK_EDITABLE_COLUMNS.includes(col.id) && <span className="ml-1 text-teal-500 opacity-50">•</span>}
                          {isMobile && <span className="ml-1 text-slate-400 text-[10px]">↔</span>}
                        </span>
                        {/* Desktop resize handle */}
                        {!isMobile && (
                          <div 
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-teal-400/50 active:bg-teal-500/50 transition-colors z-10"
                            onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
                          >
                            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-300 dark:bg-slate-600" />
                          </div>
                        )}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700" onClick={() => mobileResizeCol && setMobileResizeCol(null)}>
              {tasks.length > 0 ? (
                tasks.map((task, index) => {
                  let rowClasses = "table-row";
                  if (task.status === "closed") rowClasses += " bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
                  else if (task.isStale && task.isMyTask) rowClasses += " animate-pulse-urgent bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-slate-800 border-l-4 border-l-red-500";
                  else if (task.isStale) rowClasses += " bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/20 dark:to-slate-800 border-l-4 border-l-amber-400";
                  else if (task.is_blocked) rowClasses += " bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700/30 dark:to-slate-800 border-l-4 border-l-slate-400";
                  else rowClasses += " bg-white dark:bg-slate-800/40";

                  return (
                    <tr key={task.id} className={rowClasses}>
                      {/* Row actions menu (3-dot) */}
                      <td className="px-1 py-2 relative">
                        <div ref={rowMenuOpen === task.id ? rowMenuRef : null}>
                          <button
                            onClick={() => setRowMenuOpen(rowMenuOpen === task.id ? null : task.id)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="8" cy="3" r="1.5" />
                              <circle cx="8" cy="8" r="1.5" />
                              <circle cx="8" cy="13" r="1.5" />
                            </svg>
                          </button>
                          {rowMenuOpen === task.id && (
                            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-[9999] min-w-[160px] py-1 opacity-100">
                              <Link
                                href={`/tasks/${task.id}`}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                onClick={() => setRowMenuOpen(null)}
                              >
                                <span>📝</span> Edit Task
                              </Link>
                              <button
                                onClick={() => startEditingNote(task.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                              >
                                <span>💬</span> Add Note
                              </button>
                              <button
                                onClick={() => setEditingGate({ taskId: task.id, gateIndex: 0, gates: task.gates || [] })}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                              >
                                <span>🚧</span> Edit Gates
                              </button>
                              <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                              {task.status === "closed" ? (
                                <button
                                  onClick={() => handleReopenTask(task.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-left"
                                >
                                  <span>↩️</span> Reopen Task
                                </button>
                              ) : task.status === "close_requested" ? (
                                <button
                                  onClick={() => handleCloseTask(task.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-left"
                                >
                                  <span>✅</span> Approve Close
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleRequestClose(task.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                                  >
                                    <span>🙋</span> Request Close
                                  </button>
                                  <button
                                    onClick={() => handleCloseTask(task.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-left"
                                  >
                                    <span>✅</span> Close Task
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      {columns.map((col) => {
                        const isEditable = BULK_EDITABLE_COLUMNS.includes(col.id);
                        const isSelected = isCellSelected(task.id, col.id);
                        let cellClasses = `px-3 py-2 overflow-hidden ${col.align === "center" ? "text-center" : ""}`;
                        if (isEditable) cellClasses += " cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors";
                        if (isSelected) cellClasses += " ring-2 ring-teal-500 ring-inset bg-teal-100 dark:bg-teal-900/40";

                        // Special handling for notes column with inline editing
                        if (col.id === 'notes') {
                          const isEditing = editingNoteTaskId === task.id;
                          return (
                            <td
                              key={col.id}
                              className={`px-3 py-2 ${isEditing ? 'bg-teal-50 dark:bg-teal-900/30' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                              onClick={() => !isEditing && startEditingNote(task.id)}
                              onMouseEnter={!isEditing ? (e) => handleNotesMouseEnter(e, task) : undefined}
                              onMouseLeave={!isEditing ? handleNotesMouseLeave : undefined}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={noteInputRef}
                                    type="text"
                                    value={editingNoteValue}
                                    onChange={(e) => setEditingNoteValue(e.target.value)}
                                    onKeyDown={(e) => handleNoteKeyDown(e, task.id)}
                                    onBlur={() => editingNoteValue.trim() ? saveNote(task.id) : cancelEditingNote()}
                                    placeholder="Type update, Enter to save..."
                                    className="flex-1 text-xs px-2 py-1 border border-teal-300 rounded bg-white dark:bg-slate-800 dark:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                    disabled={savingNote}
                                  />
                                  {savingNote && <span className="text-xs text-teal-500">💾</span>}
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <span className="text-sm flex-shrink-0">📝</span>
                                  {task.notes.length > 0 ? (
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-slate-800 dark:text-slate-300 line-clamp-2">{task.notes[0].content}</div>
                                      <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5">
                                        {task.notes[0].profiles?.full_name || task.notes[0].profiles?.email || 'Unknown'} · {formatRelativeTime(task.notes[0].created_at)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-600 dark:text-slate-500 italic">Click to add update...</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        }
                        
                        // Special handling for task column - includes note icon and cad/aging gauge
                        if (col.id === 'task') {
                          // Calculate cad/aging colors
                          const agingRatio = task.fu_cadence_days > 0 ? task.daysSinceMovement / task.fu_cadence_days : 0;
                          const agingColor = task.status === "closed" 
                            ? "bg-emerald-500" 
                            : agingRatio > 1 
                              ? "bg-amber-500" 
                              : agingRatio > 0.75 
                                ? "bg-amber-400" 
                                : "bg-emerald-500";
                          
                          return (
                            <td key={col.id} className={cellClasses}>
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Task description */}
                                <Link href={`/tasks/${task.id}`} className="group">
                                  <span className={`group-hover:text-cyan-500 transition text-sm ${task.status === "closed" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white font-medium"}`}>
                                    {task.description}
                                  </span>
                                </Link>
                                
                                {/* Status tags */}
                                {task.isStale && task.status !== "closed" && task.isMyTask && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 animate-pulse">🔥 URGENT</span>
                                )}
                                {task.isStale && task.status !== "closed" && !task.isMyTask && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">STALE</span>
                                )}
                                {task.is_blocked && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">GATED</span>
                                )}
                                
                                {/* Note indicator - small badge if has notes */}
                                {task.notes.length > 0 && (
                                  <span 
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                    onMouseEnter={(e) => handleNotesMouseEnter(e, task)}
                                    onMouseLeave={handleNotesMouseLeave}
                                    title={`${task.notes.length} note${task.notes.length > 1 ? 's' : ''}`}
                                  >
                                    💬 {task.notes.length}
                                  </span>
                                )}
                                
                                {/* Cad/Aging gauge */}
                                <span 
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700"
                                  title={`${task.daysSinceMovement} days since update / ${task.fu_cadence_days} day cadence`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${agingColor}`}></span>
                                  <span className="text-slate-800 dark:text-slate-300">{task.daysSinceMovement}</span>
                                  <span className="text-slate-600 dark:text-slate-400">/</span>
                                  <span className="text-slate-700 dark:text-slate-400">{task.fu_cadence_days}</span>
                                </span>
                              </div>
                            </td>
                          );
                        }
                        
                        // Special handling for gate columns - clickable to open editor
                        if (col.id === 'currentGate' || col.id === 'nextGate') {
                          const gates = task.gates || [];
                          const gateIndex = col.id === 'currentGate' 
                            ? gates.findIndex(g => !g.completed)
                            : (() => {
                                const currentIdx = gates.findIndex(g => !g.completed);
                                return currentIdx >= 0 ? gates.findIndex((g, i) => i > currentIdx && !g.completed) : -1;
                              })();
                          
                          // For currentGate with no incomplete gate, allow adding gate 0
                          // For nextGate with no next gate, allow adding the next gate after current
                          const targetGateIndex = gateIndex >= 0 ? gateIndex : (col.id === 'currentGate' ? 0 : Math.max(0, gates.length));
                          const gate = gateIndex >= 0 ? gates[gateIndex] : null;
                          
                          const isAmber = col.id === 'currentGate';
                          const bgColor = isAmber ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200';
                          const textColor = isAmber ? 'text-amber-800' : 'text-indigo-800';
                          const subColor = isAmber ? 'text-amber-600' : 'text-indigo-600';
                          
                          return (
                            <td
                              key={col.id}
                              className="px-3 py-2 overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                              onClick={() => setEditingGate({ taskId: task.id, gateIndex: targetGateIndex, gates: gates })}
                            >
                              {gate ? (
                                <span className={`inline-flex flex-col px-2 py-0.5 rounded border text-xs max-w-full ${bgColor}`} title={`${gate.owner_name}${gate.task_name ? " / " + gate.task_name : ""} - Click to edit`}>
                                  <span className={`font-semibold break-words ${textColor}`}>{gate.owner_name}</span>
                                  {gate.task_name && <span className={`break-words text-[10px] ${subColor}`}>{gate.task_name}</span>}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs hover:text-teal-500 transition-colors">+ Add gate</span>
                              )}
                            </td>
                          );
                        }
                        
                        // Special handling for owner column - clickable to open editor
                        if (col.id === 'owner') {
                          return (
                            <td
                              key={col.id}
                              className="px-3 py-2 overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                              onClick={() => setEditingOwner({ taskId: task.id, ownerIds: [] })}
                            >
                              {task.ownerNames ? (
                                <span className="text-slate-800 dark:text-slate-300 text-xs truncate block">{task.ownerNames}</span>
                              ) : (
                                <span className="text-slate-400 text-xs hover:text-teal-500 transition-colors">+ Assign</span>
                              )}
                            </td>
                          );
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
                <tr><td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-400">No tasks match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right mt-1">
        {tasks.filter((t) => t.status !== "closed").length} of {total}
      </div>
      
      {/* Gate Editor Modal */}
      {editingGate && (
        <GateEditor
          taskId={editingGate.taskId}
          gateIndex={editingGate.gateIndex}
          gates={editingGate.gates}
          onClose={() => setEditingGate(null)}
          onSave={() => router.refresh()}
        />
      )}
      
      {/* Owner Editor Modal */}
      {editingOwner && (
        <OwnerEditor
          taskId={editingOwner.taskId}
          onClose={() => setEditingOwner(null)}
          onSave={() => router.refresh()}
        />
      )}
    </div>
  );
}

function renderCell(columnId: string, task: Task) {
  switch (columnId) {
    case "task":
      return (
        <>
          <Link href={`/tasks/${task.id}`} className="group">
            <span className={`group-hover:text-cyan-500 transition text-sm ${task.status === "closed" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white font-medium"}`}>{task.description}</span>
          </Link>
          {task.isStale && task.status !== "closed" && task.isMyTask && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 animate-pulse">🔥 URGENT</span>}
          {task.isStale && task.status !== "closed" && !task.isMyTask && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">STALE</span>}
          {task.is_blocked && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">GATED</span>}
        </>
      );
    case "project":
      return <span className="text-slate-700 dark:text-slate-200 break-words text-sm">{task.projects?.name ?? "—"}</span>;
    case "currentGate": {
      const gates = task.gates || [];
      const currentIdx = gates.findIndex(g => !g.completed);
      if (currentIdx === -1) return <span className="text-slate-400 text-xs">—</span>;
      const gate = gates[currentIdx];
      const ownerPart = gate.owner_name || "—";
      const taskPart = gate.task_name || gate.name || "";
      return (
        <span className="inline-flex flex-col px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-xs max-w-full" title={`${ownerPart}${taskPart ? " / " + taskPart : ""}`}>
          <span className="font-semibold text-amber-800 break-words">{ownerPart}</span>
          {taskPart && <span className="text-amber-600 break-words text-[10px]">{taskPart}</span>}
        </span>
      );
    }
    case "nextGate": {
      const gates = task.gates || [];
      const currentIdx = gates.findIndex(g => !g.completed);
      const nextIdx = currentIdx >= 0 ? gates.findIndex((g, i) => i > currentIdx && !g.completed) : -1;
      if (nextIdx === -1) return <span className="text-slate-400 text-xs">—</span>;
      const gate = gates[nextIdx];
      const ownerPart = gate.owner_name || "—";
      const taskPart = gate.task_name || gate.name || "";
      return (
        <span className="inline-flex flex-col px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-xs max-w-full" title={`${ownerPart}${taskPart ? " / " + taskPart : ""}`}>
          <span className="font-semibold text-indigo-800 break-words">{ownerPart}</span>
          {taskPart && <span className="text-indigo-600 break-words text-[10px]">{taskPart}</span>}
        </span>
      );
    }
    case "nextStep":
      return <span className="text-slate-800 dark:text-slate-300 text-xs break-words">{task.next_step || "—"}</span>;
    case "notes":
      // Handled inline in table body for editing capability
      return null;
    case "cadence":
      return <span className="text-slate-700 dark:text-slate-400 text-xs font-medium">{task.fu_cadence_days}d</span>;
    case "aging": {
      // Show days since last update / days since created
      const updateColor = task.status === "closed" ? "text-emerald-500" : task.isStale ? "text-amber-600" : task.daysSinceMovement > task.fu_cadence_days * 0.75 ? "text-amber-500" : "text-emerald-600";
      return (
        <span className="flex flex-col items-center leading-tight" title={`${task.daysSinceMovement}d since update / ${task.daysSinceCreated}d since created`}>
          <span className={`font-bold text-base ${updateColor}`}>{task.daysSinceMovement}</span>
          <span className="text-slate-600 dark:text-slate-400 text-[10px]">/{task.daysSinceCreated}</span>
        </span>
      );
    }
    case "status":
      if (task.status === "closed") return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200">DONE</span>;
      if (task.status === "close_requested") return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-700">PENDING</span>;
      return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700">OPEN</span>;
    case "owner":
      return <span className="text-slate-800 dark:text-slate-300 text-xs truncate">{task.ownerNames || "—"}</span>;
    case "gated": {
      const gates = task.gates || [];
      const hasOpenGate = gates.some(g => !g.completed);
      return hasOpenGate ? <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 text-slate-600">YES</span> : <span className="text-slate-300 text-xs">—</span>;
    }
    case "id":
      return <Link href={`/tasks/${task.id}`} className="text-slate-800 dark:text-slate-300 hover:text-cyan-600 font-mono text-xs font-medium">{task.task_number || "—"}</Link>;
    default:
      return null;
  }
}

// Gate/Stage tracking for tasks
// Each task can have multiple gates that must be passed in sequence

export type Gate = {
  name: string;           // e.g., "Design", "Engineering", "Vendor Quote"
  owner_name: string;     // Person responsible for this gate
  owner_id?: string;      // Optional link to owners table
  completed: boolean;     // Has this gate been passed?
  completed_at?: string;  // When was it completed?
};

export type TaskGates = {
  gates: Gate[];
  // Computed from gates array:
  // - current_gate_index = first non-completed gate
  // - total_gates = gates.length
};

// Helper to get current and next gates
export function getActiveGates(gates: Gate[]): {
  currentGate: { index: number; gate: Gate } | null;
  nextGate: { index: number; gate: Gate } | null;
  totalGates: number;
} {
  const totalGates = gates.length;
  let currentGate: { index: number; gate: Gate } | null = null;
  let nextGate: { index: number; gate: Gate } | null = null;

  for (let i = 0; i < gates.length; i++) {
    if (!gates[i].completed) {
      if (!currentGate) {
        currentGate = { index: i + 1, gate: gates[i] }; // 1-indexed for display
      } else if (!nextGate) {
        nextGate = { index: i + 1, gate: gates[i] };
        break;
      }
    }
  }

  return { currentGate, nextGate, totalGates };
}

// Format gate display: "3/5 Alwin"
export function formatGate(index: number, total: number, ownerName: string): string {
  return `${index}/${total} ${ownerName}`;
}

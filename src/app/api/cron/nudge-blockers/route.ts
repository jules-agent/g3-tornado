import { createClient } from "@supabase/supabase-js";
import { sendNudgeEmail } from "@/lib/email";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type GateEntry = {
  name?: string;
  owner_name?: string;
  completed?: boolean;
};

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find all open, blocked tasks with overdue follow-up
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, task_number, description, blocker_description, gates, fu_cadence_days, last_movement, last_nudge_at")
    .eq("status", "open")
    .eq("is_blocked", true)
    .not("gates", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const nudges: { task_number: string; gate_person: string; email: string }[] = [];
  const errors: { task_number: string; error: string }[] = [];

  for (const task of tasks ?? []) {
    // Check if overdue
    const lastMovement = task.last_movement ? new Date(task.last_movement) : null;
    if (!lastMovement) continue;

    const daysSince = Math.floor((now.getTime() - lastMovement.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= (task.fu_cadence_days || 3)) continue;

    // Check nudge cooldown (3 days)
    if (task.last_nudge_at) {
      const lastNudge = new Date(task.last_nudge_at);
      const daysSinceNudge = Math.floor((now.getTime() - lastNudge.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceNudge < 3) continue;
    }

    // Find incomplete gate entries
    const gates: GateEntry[] = Array.isArray(task.gates) ? task.gates : [];
    const incompleteGates = gates.filter((g) => g.completed === false && g.owner_name);

    for (const gate of incompleteGates) {
      // Look up gate person email from owners table
      const { data: owner } = await supabase
        .from("owners")
        .select("name, email")
        .eq("name", gate.owner_name!)
        .maybeSingle();

      if (!owner?.email) {
        errors.push({ task_number: task.task_number, error: `No email for gate person: ${gate.owner_name}` });
        continue;
      }

      const result = await sendNudgeEmail({
        to: owner.email,
        name: owner.name,
        taskNumber: task.task_number,
        blockerDescription: task.blocker_description || gate.name || "",
        daysOverdue: daysSince,
      });

      if (result.success) {
        nudges.push({ task_number: task.task_number, gate_person: owner.name, email: owner.email });
      } else {
        errors.push({ task_number: task.task_number, error: result.error || "Send failed" });
      }
    }

    // Update last_nudge_at if we sent any nudges for this task
    if (nudges.some((n) => n.task_number === task.task_number)) {
      await supabase.from("tasks").update({ last_nudge_at: now.toISOString() }).eq("id", task.id);
    }
  }

  return NextResponse.json({
    nudges_sent: nudges.length,
    nudges,
    errors,
    checked: tasks?.length ?? 0,
  });
}

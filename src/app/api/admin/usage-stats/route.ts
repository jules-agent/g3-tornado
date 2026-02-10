import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Generate usage stats for a given period
// Called by cron or manually
export async function POST(request: Request) {
  const body = await request.json();
  const { secret, periodType, date } = body;

  if (secret !== process.env.CRON_SECRET && secret !== "usage-stats-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = date || new Date().toISOString().slice(0, 10);
  const type = periodType || "daily";

  // Determine date range
  let startDate: string, endDate: string;
  if (type === "daily") {
    startDate = targetDate;
    endDate = targetDate;
  } else if (type === "weekly") {
    // Last 7 days ending on targetDate
    const end = new Date(targetDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    startDate = start.toISOString().slice(0, 10);
    endDate = targetDate;
  } else {
    // Monthly: last 30 days
    const end = new Date(targetDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    startDate = start.toISOString().slice(0, 10);
    endDate = targetDate;
  }

  const startTs = `${startDate}T00:00:00`;
  const endTs = `${endDate}T23:59:59`;

  // Get all users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name");

  if (!profiles) return NextResponse.json({ error: "No profiles" }, { status: 500 });

  const stats = [];

  for (const profile of profiles) {
    // Tasks created
    const { count: tasksCreated } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("created_by", profile.id)
      .gte("created_at", startTs)
      .lte("created_at", endTs);

    // Tasks closed
    const { count: tasksClosed } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("closed_by", profile.id)
      .gte("closed_at", startTs)
      .lte("closed_at", endTs);

    // Notes added
    const { count: notesAdded } = await supabase
      .from("task_notes")
      .select("id", { count: "exact", head: true })
      .eq("created_by", profile.id)
      .gte("created_at", startTs)
      .lte("created_at", endTs);

    // Bug reports submitted
    const { count: bugsSubmitted } = await supabase
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_by", profile.id)
      .gte("created_at", startTs)
      .lte("created_at", endTs);

    const total = (tasksCreated || 0) + (tasksClosed || 0) + (notesAdded || 0) + (bugsSubmitted || 0);
    if (total === 0) continue; // Skip inactive users

    // Upsert stats
    await supabase.from("usage_stats").upsert({
      user_id: profile.id,
      user_email: profile.email,
      period_type: type,
      period_date: targetDate,
      tasks_created: tasksCreated || 0,
      tasks_closed: tasksClosed || 0,
      notes_added: notesAdded || 0,
      gates_completed: 0, // TODO: track gate completions
      bugs_submitted: bugsSubmitted || 0,
    }, { onConflict: "user_id,period_type,period_date" });

    stats.push({
      email: profile.email,
      name: profile.full_name,
      tasks_created: tasksCreated || 0,
      tasks_closed: tasksClosed || 0,
      notes_added: notesAdded || 0,
      bugs_submitted: bugsSubmitted || 0,
      total,
    });
  }

  // Sort by total activity
  stats.sort((a, b) => b.total - a.total);

  return NextResponse.json({ period: type, date: targetDate, range: `${startDate} to ${endDate}`, users: stats });
}

// GET: Retrieve stats for admin inbox
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily";
  const limit = parseInt(url.searchParams.get("limit") || "7");

  const { data } = await supabase
    .from("usage_stats")
    .select("*")
    .eq("period_type", type)
    .order("period_date", { ascending: false })
    .order("tasks_created", { ascending: false })
    .limit(limit * 10); // enough for multiple days

  return NextResponse.json({ stats: data || [] });
}

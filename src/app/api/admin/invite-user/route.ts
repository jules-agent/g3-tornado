import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, role } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  }

  // For now, we'll create a "pending" profile entry
  // The user will need to sign up with this email, and their profile will be updated
  // In production, you'd use Supabase Admin API to send an actual invite email
  
  // Store in a pending_invites table or just return success with instructions
  // Since we don't have admin API access, we'll just return the invite link

  const signupUrl = `https://www.g3tornado.com/signup?email=${encodeURIComponent(email)}&role=${role}`;

  return NextResponse.json({
    success: true,
    message: `Share this signup link with ${email}`,
    signupUrl,
    note: "User should sign up with this email. Their role will be set on first login.",
  });
}

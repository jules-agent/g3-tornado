import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && user.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { email, password, fullName, role } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create the user in Supabase Auth
  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Update profile with role and full_name
  if (newUser?.user) {
    // Auto-link to owner if email matches
    const { data: matchingOwner } = await serviceClient
      .from("owners")
      .select("id")
      .eq("email", email.toLowerCase())
      .limit(1)
      .maybeSingle();

    await serviceClient
      .from("profiles")
      .update({
        role: role || "user",
        full_name: fullName || email.split("@")[0],
        ...(matchingOwner ? { owner_id: matchingOwner.id } : {}),
      })
      .eq("id", newUser.user.id);
  }

  return NextResponse.json({
    success: true,
    userId: newUser?.user?.id,
    email,
    message: `User ${email} created successfully`,
  });
}

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description, screenshot, type } = await request.json();

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  let screenshot_url: string | null = null;

  // Handle base64 screenshot upload
  if (screenshot && screenshot.startsWith("data:")) {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const matches = screenshot.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      const ext = contentType.split("/")[1] || "png";
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await serviceClient.storage
        .from("bug-screenshots")
        .upload(fileName, buffer, { contentType, upsert: false });

      if (!uploadError) {
        const { data: urlData } = serviceClient.storage
          .from("bug-screenshots")
          .getPublicUrl(fileName);
        screenshot_url = urlData.publicUrl;
      }
    }
  } else if (screenshot) {
    screenshot_url = screenshot;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await serviceClient
    .from("bug_reports")
    .insert({
      description: description.trim(),
      screenshot_url,
      reported_by: user.id,
      reported_by_email: profile?.email || user.email,
      type: type === "feature_request" ? "feature_request" : "bug",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await serviceClient
    .from("bug_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Forward to OpenAI Whisper API
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "Speech service not configured" }, { status: 503 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: whisperForm,
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Whisper API error:", response.status, errBody);
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    const result = await response.json();
    return NextResponse.json({ text: result.text });
  } catch (e) {
    console.error("Speech route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

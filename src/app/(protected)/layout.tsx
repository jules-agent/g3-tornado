import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUser } from "@/lib/impersonation";
import AppHeader from "@/components/AppHeader";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { VoiceCaptureFAB } from "@/components/VoiceCaptureFAB";
import { WebMCPProvider } from "@/components/WebMCPProvider";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const effectiveUser = await getEffectiveUser();

  const headerUser = {
    email: effectiveUser?.email ?? user.email ?? null,
    fullName: effectiveUser?.fullName ?? null,
    role: effectiveUser?.role ?? "user",
  };

  return (
    <WebMCPProvider>
      <div className={`min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-colors ${effectiveUser?.isImpersonating ? "pt-10" : ""}`}>
        <ImpersonationBanner />
        <AppHeader user={headerUser} />
        <main className="w-full px-4 py-2 sm:px-6 lg:px-8">
          {children}
        </main>
        <VoiceCaptureFAB />
      </div>
    </WebMCPProvider>
  );
}

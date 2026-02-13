import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, owner_id")
    .eq("id", user.id)
    .maybeSingle();

  // Get linked owner data if exists
  let owner = null;
  if (profile?.owner_id) {
    const { data } = await supabase
      .from("owners")
      .select("id, name, email, phone, is_up_employee, is_bp_employee, is_upfit_employee, is_bpas_employee, is_third_party_vendor")
      .eq("id", profile.owner_id)
      .maybeSingle();
    owner = data;
  }

  // Get all owners for linking
  const { data: owners } = await supabase
    .from("owners")
    .select("id, name, email")
    .order("name");

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">My Profile</h1>
      <ProfileForm
        profile={profile}
        owner={owner}
        owners={owners ?? []}
        isAdmin={profile?.role === "admin" || user.email === "ben@unpluggedperformance.com"}
      />
    </div>
  );
}

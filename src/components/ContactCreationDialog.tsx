"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst, validateContactAssociations } from "@/lib/utils";
import SpeechInput from "@/components/SpeechInput";

type ContactCreationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onContactCreated: (contactName: string) => void;
};

export function ContactCreationDialog({ isOpen, onClose, onContactCreated }: ContactCreationDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isUp, setIsUp] = useState(false);
  const [isBp, setIsBp] = useState(false);
  const [isUpfit, setIsUpfit] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setName("");
      setEmail("");
      setPhone("");
      setIsUp(false);
      setIsBp(false);
      setIsUpfit(false);
      setIsVendor(false);
      setIsPrivate(false);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    // Validate associations using shared validation function
    const validation = validateContactAssociations({
      is_up: isUp,
      is_bp: isBp,
      is_upfit_employee: isUpfit,
      is_third_party_vendor: isVendor,
      is_private: isPrivate,
    });

    if (!validation.valid) {
      setError(validation.error || "Invalid contact associations");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setSaving(false);
        return;
      }

      // Get user's profile for email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      const { data, error: insertError } = await supabase
        .from("owners")
        .insert({
          name: capitalizeFirst(name.trim()),
          email: email.trim() || null,
          phone: phone.trim() || null,
          is_up_employee: isUp,
          is_bp_employee: isBp,
          is_upfit_employee: isUpfit,
          is_third_party_vendor: isVendor,
          is_internal: isUp || isBp || isUpfit,
          created_by: user.id,
          created_by_email: profile?.email || user.email || null,
          is_private: isPrivate,
          private_owner_id: isPrivate ? user.id : null,
        })
        .select("name")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      if (data) {
        onContactCreated(data.name);
      }
    } catch (err) {
      setError("Failed to create contact");
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasAnyAssociation = isUp || isBp || isUpfit || isVendor || isPrivate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New Contact</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create a contact that can be used in gates
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-base text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter contact name..."
                className="flex-1 px-5 py-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[56px]"
                autoFocus
              />
              <SpeechInput
                onResult={(spoken) => setName(prev => prev ? prev + ' ' + spoken : spoken)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Optional"
                className="w-full px-5 py-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[56px]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Optional"
                className="w-full px-5 py-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[56px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Company Association <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Select at least one
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsUp(!isUp)}
                className={`px-5 py-3 rounded-xl text-sm font-bold border-2 transition min-h-[48px] ${
                  isUp
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 shadow-sm"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300 active:bg-slate-50 dark:active:bg-slate-800"
                }`}
              >
                {isUp ? "✓ " : ""}UP
              </button>
              <button
                type="button"
                onClick={() => setIsBp(!isBp)}
                className={`px-5 py-3 rounded-xl text-sm font-bold border-2 transition min-h-[48px] ${
                  isBp
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300 active:bg-slate-50 dark:active:bg-slate-800"
                }`}
              >
                {isBp ? "✓ " : ""}BP
              </button>
              <button
                type="button"
                onClick={() => setIsUpfit(!isUpfit)}
                className={`px-5 py-3 rounded-xl text-sm font-bold border-2 transition min-h-[48px] ${
                  isUpfit
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-sm"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300 active:bg-slate-50 dark:active:bg-slate-800"
                }`}
              >
                {isUpfit ? "✓ " : ""}UPFIT
              </button>
              <button
                type="button"
                onClick={() => setIsVendor(!isVendor)}
                className={`px-5 py-3 rounded-xl text-sm font-bold border-2 transition min-h-[48px] ${
                  isVendor
                    ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300 active:bg-slate-50 dark:active:bg-slate-800"
                }`}
              >
                {isVendor ? "✓ " : ""}3rd Party
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-2 focus:ring-teal-500 focus:ring-offset-0"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                  🔒 Make Private
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Private contacts are hidden from other members and only visible to your account
                </p>
              </div>
            </label>
          </div>
        </form>

        <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !hasAnyAssociation}
            className="flex-1 rounded-xl bg-teal-500 px-6 py-4 text-base font-semibold text-white hover:bg-teal-600 active:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[56px]"
          >
            {saving ? "Creating..." : "Create Contact"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-6 py-4 text-base font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 disabled:opacity-50 transition min-h-[56px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

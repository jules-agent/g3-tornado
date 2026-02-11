"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst } from "@/lib/utils";

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

    // At least one company association required
    if (!isUp && !isBp && !isUpfit && !isVendor) {
      setError("Please select at least one company association");
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

  const hasCompanyAssociation = isUp || isBp || isUpfit || isVendor;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md"
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Add New Contact</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create a contact that can be used in gates
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter contact name..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Company Association <span className="text-red-500">*</span>
            </label>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
              Select at least one
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsUp(!isUp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                  isUp
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"
                }`}
              >
                {isUp ? "✓ " : ""}UP
              </button>
              <button
                type="button"
                onClick={() => setIsBp(!isBp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                  isBp
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"
                }`}
              >
                {isBp ? "✓ " : ""}BP
              </button>
              <button
                type="button"
                onClick={() => setIsUpfit(!isUpfit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                  isUpfit
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"
                }`}
              >
                {isUpfit ? "✓ " : ""}UPFIT
              </button>
              <button
                type="button"
                onClick={() => setIsVendor(!isVendor)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                  isVendor
                    ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"
                }`}
              >
                {isVendor ? "✓ " : ""}3rd Party Vendor
              </button>
            </div>
          </div>
        </form>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !hasCompanyAssociation}
            className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? "Creating..." : "Create Contact"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

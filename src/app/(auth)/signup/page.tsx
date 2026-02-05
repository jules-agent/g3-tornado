"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    setMessage(
      "Account created. Check your email for a confirmation link if required."
    );
    setIsLoading(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="w-full">
      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Activate
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Bring every FU cadence, owner, and blocker into one view.
          </h1>
          <p className="text-base text-white/70 sm:text-lg">
            Create your account and keep the task movement visible for every
            project.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            <div className="font-semibold text-white">After signup</div>
            <ul className="mt-3 space-y-2">
              <li>• Create tasks with owners + cadence.</li>
              <li>• Add notes to reset FU timers.</li>
              <li>• Request task closure when done.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Create account</h2>
            <p className="text-sm text-white/70">Join the Tornado workspace.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                placeholder="Alex Morgan"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                placeholder="Create a strong password"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/70"
            >
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-white/70">
            Already have access?{" "}
            <Link className="font-semibold text-white hover:underline" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

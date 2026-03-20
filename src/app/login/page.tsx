"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message.includes("Invalid login credentials")
          ? "Kein Benutzer gefunden."
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  const isValid = email.length > 0 && password.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <span className="mb-4 inline-block rounded-lg bg-red px-3 py-2 font-mono text-sm font-extrabold text-white">
            NEF
          </span>
          <h1 className="text-2xl font-extrabold text-text">Willkommen</h1>
          <p className="mt-1 text-sm text-text-muted">
            Melde dich an, um fortzufahren
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red/20 bg-red/5 px-4 py-3 text-sm text-red">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full rounded-lg bg-red py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {loading ? "Laden…" : "Einloggen"}
        </button>
      </form>
    </div>
  );
}

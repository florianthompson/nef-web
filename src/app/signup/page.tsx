"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamFromUrl = searchParams.get("team") ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState(teamFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);

  // Validate team ID on load if provided
  useEffect(() => {
    if (!teamFromUrl) return;
    supabase
      .from("teams")
      .select("name")
      .eq("id", teamFromUrl)
      .single()
      .then(({ data }) => {
        if (data) setTeamName(data.name);
      });
  }, [teamFromUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedTeamId = teamId.trim();

    // Verify team exists
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id")
      .eq("id", trimmedTeamId)
      .single();

    if (teamErr || !team) {
      setError("Team-ID nicht gefunden. Bitte prüfe die ID.");
      setLoading(false);
      return;
    }

    // Sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    if (authError) {
      setError(
        authError.message.includes("already registered")
          ? "Ein Account mit dieser Email existiert bereits."
          : authError.message
      );
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Registrierung fehlgeschlagen.");
      setLoading(false);
      return;
    }

    // Create user profile
    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      team_id: trimmedTeamId,
      role: "member",
    });

    if (profileError) {
      setError("Profil konnte nicht erstellt werden.");
      setLoading(false);
      return;
    }

    router.replace("/app");
  }

  const isValid =
    firstName.trim() && lastName.trim() && email.trim() && password.trim() && teamId.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-lg bg-red px-3 py-2 font-mono text-sm font-extrabold text-white">
            NEF
          </span>
          <h1 className="text-2xl font-extrabold text-text">Account erstellen</h1>
          <p className="mt-1 text-sm text-text-muted">
            Registriere dich, um fortzufahren
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red/20 bg-red/5 px-4 py-3 text-sm text-red">
            {error}
          </div>
        )}

        {teamName && (
          <div className="rounded-lg border border-green/20 bg-green/5 px-4 py-3 text-sm text-green">
            Team: {teamName}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Vorname"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
            />
            <input
              type="text"
              placeholder="Nachname"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
            />
          </div>
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
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
          />
          <input
            type="text"
            placeholder="Team-ID"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            readOnly={!!teamFromUrl}
            className={`w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none ${
              teamFromUrl ? "opacity-60" : ""
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full rounded-lg bg-red py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {loading ? "Laden…" : "Registrieren"}
        </button>

        <p className="text-center text-sm text-text-muted">
          Bereits registriert?{" "}
          <Link href="/login" className="text-red hover:underline">
            Einloggen
          </Link>
        </p>
      </form>
    </div>
  );
}

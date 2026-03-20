"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { CopyIcon, CheckIcon, LinkIcon } from "lucide-react";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
};

export default function TeamPage() {
  const { profile, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;

    async function load() {
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", profile!.teamId)
        .single();

      setTeamName(team?.name ?? "");

      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, role")
        .eq("team_id", profile!.teamId);

      setMembers(
        (data ?? []).map((m: any) => ({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name ?? "",
          role: m.role,
        }))
      );
      setLoading(false);
    }

    load();
  }, [authLoading, profile]);

  function getInviteLink() {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "";
    return `${base}/signup?team=${profile?.teamId}`;
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(getInviteLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Team</h1>
          {teamName && (
            <p className="text-xs text-text-muted">{teamName}</p>
          )}
        </div>
      </div>

      {/* Invite Link */}
      <div className="mb-8 rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-red" />
          <span className="text-sm font-semibold">Einladungslink</span>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Teile diesen Link, um neue Mitglieder in dein Team einzuladen.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={getInviteLink()}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-text-muted"
          />
          <button
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-80"
          >
            {copied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                Kopiert
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                Kopieren
              </>
            )}
          </button>
        </div>
      </div>

      {/* Members List */}
      <h2 className="mb-4 text-sm font-semibold text-text-muted">
        Mitglieder ({members.length})
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
          Laden…
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-sm font-bold text-text-muted">
                  {m.first_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {m.first_name} {m.last_name}
                  </p>
                </div>
              </div>
              {m.role === "admin" && (
                <span className="rounded bg-red/10 px-2 py-0.5 text-[10px] font-semibold text-red">
                  ADMIN
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

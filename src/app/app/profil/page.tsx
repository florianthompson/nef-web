"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { LogOutIcon, ShieldIcon } from "lucide-react";

export default function ProfilPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="px-4 py-6">
      {/* User Card */}
      <div className="mb-6 rounded-lg border border-border p-6 text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-2xl font-bold text-text-muted">
          {profile?.firstName?.charAt(0) ?? "?"}
        </div>
        <h1 className="text-lg font-bold">
          Hallo {profile?.firstName ?? "…"}
        </h1>
        <p className="text-xs text-text-muted">
          {profile?.role === "admin" ? "Administrator" : "Mitglied"}
        </p>
      </div>

      {/* Admin Link */}
      {profile?.role === "admin" && (
        <Link
          href="/dashboard"
          className="mb-3 flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-red"
        >
          <ShieldIcon className="h-5 w-5 text-red" />
          <div>
            <p className="text-sm font-medium">Admin Dashboard</p>
            <p className="text-xs text-text-muted">
              Team verwalten und alle Protokolle einsehen
            </p>
          </div>
        </Link>
      )}

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-red"
      >
        <LogOutIcon className="h-5 w-5 text-text-muted" />
        <span className="text-sm font-medium">Abmelden</span>
      </button>
    </div>
  );
}

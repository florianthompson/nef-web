"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Share,
  SquarePlus,
  EllipsisVertical,
  Check,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Platform = "ios" | "android";

export default function OnboardingClient() {
  const searchParams = useSearchParams();
  const team = searchParams.get("team") ?? "";

  const [teamName, setTeamName] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("ios");

  // Validate the team and show its name (same lookup as signup)
  useEffect(() => {
    if (!team) return;
    supabase
      .from("teams")
      .select("name")
      .eq("id", team)
      .single()
      .then(({ data }) => {
        if (data) setTeamName(data.name);
      });
  }, [team]);

  // Default the home-screen instructions to the user's device
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
  }, []);

  const signupHref = team
    ? `/signup?team=${encodeURIComponent(team)}`
    : "/signup";

  return (
    <div className="min-h-screen bg-bg px-5 py-12 text-text">
      <div className="mx-auto w-full max-w-md space-y-10">
        {/* Header */}
        <header className="text-center">
          <span className="mb-5 inline-block rounded-lg bg-red px-3 py-2 font-mono text-sm font-extrabold text-white">
            NEF
          </span>
          <h1 className="text-2xl font-extrabold">Willkommen bei NEF</h1>
          <p className="mt-2 text-sm text-text-muted">
            In zwei Schritten startklar — Account erstellen und die App auf den
            Home-Bildschirm legen.
          </p>
          {teamName && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/5 px-3 py-1 text-xs font-medium text-green">
              <Check className="h-3.5 w-3.5" />
              Team: {teamName}
            </div>
          )}
        </header>

        {/* Step 1 — Account */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-3">
            <StepBadge n={1} />
            <h2 className="text-base font-semibold">Account erstellen</h2>
          </div>
          <p className="mb-4 text-sm text-text-muted">
            {team
              ? "Dein Team ist bereits hinterlegt. Tippe auf den Button und registriere dich mit Name, Email und Passwort."
              : "Tippe auf den Button und registriere dich mit Name, Email und Passwort."}
          </p>
          <Link
            href={signupHref}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Account erstellen
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* Step 2 — Add to Home Screen */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-3">
            <StepBadge n={2} />
            <h2 className="text-base font-semibold">
              Zum Home-Bildschirm hinzufügen
            </h2>
          </div>
          <p className="mb-4 text-sm text-text-muted">
            So legst du NEF wie eine echte App auf deinen Startbildschirm — mit
            eigenem Icon und Vollbild.
          </p>

          {/* Platform toggle */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1">
            <TabButton
              active={platform === "ios"}
              onClick={() => setPlatform("ios")}
            >
              iPhone / iPad
            </TabButton>
            <TabButton
              active={platform === "android"}
              onClick={() => setPlatform("android")}
            >
              Android
            </TabButton>
          </div>

          {platform === "ios" ? (
            <ol className="space-y-4">
              <Instruction n={1}>
                Öffne diese Seite in <strong className="text-text">Safari</strong>{" "}
                (nicht in einer anderen App oder im In-App-Browser).
              </Instruction>
              <Instruction
                n={2}
                icon={<Share className="h-4 w-4 text-text" />}
              >
                Tippe unten in der Leiste auf das{" "}
                <strong className="text-text">Teilen-Symbol</strong> (Quadrat mit
                Pfeil nach oben).
              </Instruction>
              <Instruction
                n={3}
                icon={<SquarePlus className="h-4 w-4 text-text" />}
              >
                Wähle{" "}
                <strong className="text-text">
                  „Zum Home-Bildschirm"
                </strong>
                .
              </Instruction>
              <Instruction n={4}>
                Tippe oben rechts auf{" "}
                <strong className="text-text">„Hinzufügen"</strong> — fertig.
              </Instruction>
            </ol>
          ) : (
            <ol className="space-y-4">
              <Instruction n={1}>
                Öffne diese Seite in{" "}
                <strong className="text-text">Chrome</strong>.
              </Instruction>
              <Instruction
                n={2}
                icon={<EllipsisVertical className="h-4 w-4 text-text" />}
              >
                Tippe oben rechts auf das{" "}
                <strong className="text-text">Menü</strong> (drei Punkte).
              </Instruction>
              <Instruction
                n={3}
                icon={<SquarePlus className="h-4 w-4 text-text" />}
              >
                Wähle{" "}
                <strong className="text-text">
                  „Zum Startbildschirm hinzufügen"
                </strong>{" "}
                bzw. „App installieren".
              </Instruction>
              <Instruction n={4}>
                Bestätige mit{" "}
                <strong className="text-text">„Hinzufügen"</strong> /
                „Installieren" — fertig.
              </Instruction>
            </ol>
          )}
        </section>

        <p className="text-center text-sm text-text-muted">
          Bereits registriert?{" "}
          <Link href="/login" className="text-red hover:underline">
            Einloggen
          </Link>
        </p>
      </div>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red text-sm font-bold text-white">
      {n}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md py-2 text-sm font-medium transition-colors ${
        active ? "bg-red text-white" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Instruction({
  n,
  icon,
  children,
}: {
  n: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-text-muted">
        {n}
      </span>
      <div className="flex-1 text-sm text-text-muted">
        {children}
        {icon && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface2 px-2 py-1 text-xs">
            {icon}
            <span className="text-text-muted">so sieht das Symbol aus</span>
          </span>
        )}
      </div>
    </li>
  );
}

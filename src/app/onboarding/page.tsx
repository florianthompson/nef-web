import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import OnboardingClient from "./onboarding-client";

async function getTeamName(team?: string): Promise<string | null> {
  if (!team) return null;
  const { data } = await supabase
    .from("teams")
    .select("name")
    .eq("id", team)
    .single();
  return data?.name ?? null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}): Promise<Metadata> {
  const { team } = await searchParams;
  const teamName = await getTeamName(team);

  const title = teamName
    ? `Erstelle deinen Account für ${teamName}`
    : "Erstelle deinen NEF-Account";
  const description = teamName
    ? `Tritt ${teamName} auf NEF bei — in zwei Schritten startklar: Account erstellen und die App auf den Home-Bildschirm legen.`
    : "In zwei Schritten startklar mit NEF — Account erstellen und die App auf den Home-Bildschirm legen.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ["/icon-512.png"],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/icon-512.png"],
    },
  };
}

export default function OnboardingPage() {
  return <OnboardingClient />;
}

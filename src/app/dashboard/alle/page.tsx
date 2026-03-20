"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { SubmissionsTable } from "../page";

type Submission = {
  id: string;
  created_at: string;
  vehicle_name: string | null;
  user_first_name: string;
  user_last_name: string;
};

export default function AlleProtokollePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) return;

    // Redirect non-admins
    if (profile.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    async function load() {
      // Get all team members
      const { data: teamMembers } = await supabase
        .from("users")
        .select("id")
        .eq("team_id", profile!.teamId);

      const teamUserIds = (teamMembers ?? []).map((m: any) => m.id);

      // Fetch all team submissions
      const { data: protocols, error } = await supabase
        .from("user_protocols")
        .select("id, created_at, vehicle_id, user_id")
        .in("user_id", teamUserIds.length > 0 ? teamUserIds : ["__none__"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching submissions:", error);
        setLoading(false);
        return;
      }

      const userIds = [
        ...new Set(
          (protocols ?? []).map((p: any) => p.user_id).filter(Boolean)
        ),
      ];
      const vehicleIds = [
        ...new Set(
          (protocols ?? []).map((p: any) => p.vehicle_id).filter(Boolean)
        ),
      ];

      const { data: usersData } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .in("id", userIds.length > 0 ? userIds : ["__none__"]);

      const usersMap = new Map(
        (usersData ?? []).map((u: any) => [u.id, u])
      );

      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("id, name")
        .in("id", vehicleIds.length > 0 ? vehicleIds : ["__none__"]);

      const vehiclesMap = new Map(
        (vehiclesData ?? []).map((v: any) => [v.id, v])
      );

      const mapped: Submission[] = (protocols ?? []).map((row: any) => {
        const u = usersMap.get(row.user_id);
        const v = vehiclesMap.get(row.vehicle_id);
        return {
          id: row.id,
          created_at: row.created_at,
          vehicle_name: v?.name ?? null,
          user_first_name: u?.first_name ?? "–",
          user_last_name: u?.last_name ?? "",
        };
      });

      setSubmissions(mapped);
      setLoading(false);
    }

    load();
  }, [authLoading, user, profile, router]);

  return (
    <SubmissionsTable
      submissions={submissions}
      loading={loading}
      title="Alle Protokolle"
    />
  );
}

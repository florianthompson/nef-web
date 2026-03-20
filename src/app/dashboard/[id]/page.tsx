"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { ArrowLeftIcon } from "lucide-react";

type ProtocolItem = {
  id: string;
  title: string;
  is_completed: boolean;
  type: string;
  position: number;
  parent_item_id: string | null;
};

type ProtocolCategory = {
  id: string;
  title: string;
  position: number;
  type: string;
  items: ProtocolItem[];
};

type ProtocolDetail = {
  id: string;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  vehicle_name: string | null;
  categories: ProtocolCategory[];
};

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<ProtocolDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !authUser) return;

    async function load() {
      const { data: up, error: upErr } = await supabase
        .from("user_protocols")
        .select("id, created_at, vehicle_id, user_id")
        .eq("id", id)
        .single();

      if (upErr || !up) {
        console.error("Error fetching submission:", upErr);
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", (up as any).user_id)
        .single();

      const { data: vehicleData } = (up as any).vehicle_id
        ? await supabase
            .from("vehicles")
            .select("name")
            .eq("id", (up as any).vehicle_id)
            .single()
        : { data: null };

      const { data: cats, error: catsErr } = await supabase
        .from("user_protocol_categories")
        .select("*")
        .eq("user_protocol_id", id)
        .order("position");

      if (catsErr) {
        setLoading(false);
        return;
      }

      const catIds = (cats ?? []).map((c: any) => c.id);
      const { data: allItems, error: itemsErr } = await supabase
        .from("user_protocol_items")
        .select("*")
        .in("user_protocol_category_id", catIds.length > 0 ? catIds : ["__none__"])
        .order("position");

      if (itemsErr) {
        setLoading(false);
        return;
      }

      const categories: ProtocolCategory[] = (cats ?? []).map((cat: any) => {
        const items = (allItems ?? []).filter(
          (item: any) => item.user_protocol_category_id === cat.id
        );
        return {
          id: cat.id,
          title: cat.title,
          position: cat.position,
          type: cat.type,
          items: items.map((item: any) => ({
            id: item.id,
            title: item.title,
            is_completed: item.is_completed,
            type: item.type,
            position: item.position,
            parent_item_id: item.parent_item_id,
          })),
        };
      });

      setDetail({
        id: up.id,
        created_at: up.created_at,
        user_first_name: userData?.first_name ?? "–",
        user_last_name: userData?.last_name ?? "",
        vehicle_name: vehicleData?.name ?? null,
        categories,
      });
      setLoading(false);
    }

    load();
  }, [id, authLoading, authUser]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
        Lade Protokoll…
      </div>
    );
  }

  if (!detail) {
    return <p className="text-text-muted">Protokoll nicht gefunden.</p>;
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-red"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Zurück
      </Link>

      {/* Meta info */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          label="Person"
          value={`${detail.user_first_name} ${detail.user_last_name}`}
        />
        <InfoCard label="Datum" value={formatDate(detail.created_at)} />
        <InfoCard label="Fahrzeug" value={detail.vehicle_name ?? "–"} />
      </div>

      {/* Categories & Items */}
      <div className="space-y-6">
        {detail.categories.map((cat) => {
          const topLevel = cat.items.filter((i) => !i.parent_item_id);
          const completedCount = cat.items.filter((i) => i.is_completed).length;
          const totalCount = cat.items.length;

          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
                <h2 className="text-sm font-semibold">{cat.title}</h2>
                <span className="font-mono text-xs text-text-muted">
                  {completedCount}/{totalCount}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {topLevel.map((item) => {
                  const subItems = cat.items.filter(
                    (i) => i.parent_item_id === item.id
                  );
                  return (
                    <li key={item.id}>
                      <ItemRow item={item} />
                      {subItems.length > 0 && (
                        <ul className="border-t border-border bg-surface2">
                          {subItems.map((sub) => (
                            <ItemRow key={sub.id} item={sub} indent />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-1 text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function ItemRow({ item, indent }: { item: ProtocolItem; indent?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${
        indent ? "pl-10" : ""
      }`}
    >
      <span
        className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs font-bold ${
          item.is_completed ? "bg-green/15 text-green" : "bg-red/10 text-red"
        }`}
      >
        {item.is_completed ? "\u2713" : "\u2717"}
      </span>
      <span
        className={`text-sm ${
          item.is_completed ? "text-text" : "text-text-muted"
        }`}
      >
        {item.title}
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

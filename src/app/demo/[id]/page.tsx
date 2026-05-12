"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { DEMO_PROTOCOL, type DemoItem } from "@/lib/demo-data";

export default function DemoSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (id !== DEMO_PROTOCOL.id) notFound();

  const detail = DEMO_PROTOCOL;

  return (
    <div>
      <Link
        href="/demo"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-red"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Zurück
      </Link>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          label="Person"
          value={`${detail.user_first_name} ${detail.user_last_name}`}
        />
        <InfoCard label="Datum" value={formatDate(detail.created_at)} />
        <InfoCard label="Fahrzeug" value={detail.vehicle_name} />
      </div>

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

function ItemRow({ item, indent }: { item: DemoItem; indent?: boolean }) {
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
        {item.is_completed ? "✓" : "✗"}
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

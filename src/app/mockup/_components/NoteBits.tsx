"use client";

import { AlertTriangleIcon, CheckIcon, ImageIcon } from "lucide-react";
import { ME, type Note, type NoteItem } from "../_data";
import { firstName, initials, isOverdue, isDueToday, dueLabel, itemTitle, reasonLabel, vehicleName } from "../_lib";

export function Avatar({ id, size = "md" }: { id: string | null | undefined; size?: "sm" | "md" }) {
  const own = id === ME;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-mono font-bold ${
        size === "sm" ? "h-5 w-5 text-[8px]" : "h-8 w-8 text-[10px]"
      } ${own ? "border-red/30 bg-red/15 text-red" : "border-border bg-surface2 text-text-muted"}`}
    >
      {initials(id)}
    </span>
  );
}

export function PhotoPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-red/10 ${className}`}
    >
      <ImageIcon className="h-6 w-6 text-text-muted" />
    </div>
  );
}

const REASON_STYLE = {
  used: "border-amber/25 bg-amber/10 text-amber",
  missing: "border-red/25 bg-red/10 text-red",
  damaged: "border-red/25 bg-red/10 text-red",
  restocked: "border-green/25 bg-green/10 text-green",
} as const;

export function ItemChip({ link }: { link: NoteItem }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${REASON_STYLE[link.reason]}`}>
      {itemTitle(link.itemId)} · {reasonLabel(link.reason, link.quantity)}
    </span>
  );
}

export function VehicleChip({ id, onClick }: { id: string | null; onClick?: () => void }) {
  const cls =
    "inline-flex items-center rounded border border-border bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted";
  if (!onClick) return <span className={cls}>{vehicleName(id)}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`${cls} transition-colors hover:text-text`}
    >
      {vehicleName(id)}
    </button>
  );
}

export function CriticalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-red px-1.5 py-0.5 text-[10px] font-bold text-white">
      <AlertTriangleIcon className="h-2.5 w-2.5" />
      Kritisch
    </span>
  );
}

export function statusText(n: Note): { label: string; tone: "amber" | "green" | "muted" | "red" } {
  const last = (t: string) => [...n.events].reverse().find((e) => e.type === t);
  switch (n.status) {
    case "in_progress":
      return { label: `Übernommen von ${firstName(last("started")?.by ?? n.assigneeId)}`, tone: "amber" };
    case "done":
      return { label: `Erledigt von ${firstName(last("completed")?.by)}`, tone: "green" };
    case "dismissed":
      return { label: "Verworfen", tone: "muted" };
    case "posted":
      return { label: "Info", tone: "muted" };
    default:
      return { label: "Offen", tone: "red" };
  }
}

const TONE = {
  amber: "border-amber/25 bg-amber/10 text-amber",
  green: "border-green/25 bg-green/10 text-green",
  red: "border-red/25 bg-red/10 text-red",
  muted: "border-border bg-surface2 text-text-muted",
} as const;

export function StatusPill({ note }: { note: Note }) {
  const s = statusText(note);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE[s.tone]}`}>
      {note.status === "done" && <CheckIcon className="h-2.5 w-2.5" />}
      {s.label}
    </span>
  );
}

export function DueBadge({ note }: { note: Note }) {
  if (!note.dueAt) return null;
  const open = note.status === "open" || note.status === "in_progress";
  const overdue = isOverdue(note);
  const today = isDueToday(note);
  const tone = !open ? "muted" : overdue ? "red" : today ? "amber" : "muted";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${TONE[tone]}`}>
      {dueLabel(note.dueAt, new Date(), open)}
    </span>
  );
}

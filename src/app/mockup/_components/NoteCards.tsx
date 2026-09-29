"use client";

import { ClipboardCheckIcon, MessageCircleIcon } from "lucide-react";
import { ME, type Comment, type Note } from "../_data";
import { firstName, memberName, timeLabel } from "../_lib";
import { Avatar, CriticalBadge, DueBadge, ItemChip, PhotoPlaceholder, StatusPill, VehicleChip } from "./NoteBits";

type Props = { note: Note; comments: Comment[]; onOpen: () => void; onVehicle: (id: string) => void };

export function InfoBubble({ note, onOpen, onVehicle }: Props) {
  const own = note.authorId === ME;
  return (
    <div className={`flex gap-2 ${own ? "flex-row-reverse" : ""}`}>
      {!own && <Avatar id={note.authorId} />}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className={`max-w-[82%] cursor-pointer rounded-2xl border px-3.5 py-2.5 ${
          own ? "rounded-tr-sm border-red/20 bg-red/10" : "rounded-tl-sm border-border bg-surface"
        } ${note.priority === "critical" ? "ring-1 ring-red/50" : ""}`}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <span className={`font-semibold ${own ? "text-red" : "text-text"}`}>{own ? "Du" : memberName(note.authorId)}</span>
          <span className="font-mono text-text-muted">{timeLabel(note.createdAt)}</span>
          {note.priority === "critical" && <CriticalBadge />}
        </div>
        <p className="text-sm leading-snug">{note.body}</p>
        {note.photo && <PhotoPlaceholder className="mt-2 h-28 w-full" />}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <VehicleChip id={note.vehicleId} onClick={note.vehicleId ? () => onVehicle(note.vehicleId!) : undefined} />
          {note.items.map((l) => (
            <ItemChip key={l.itemId} link={l} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TaskCard({ note, comments, onOpen, onVehicle }: Props) {
  const critical = note.priority === "critical";
  const done = note.status === "done";
  const count = comments.filter((c) => c.noteId === note.id).length;
  const stripe = critical ? "bg-red" : note.status === "in_progress" ? "bg-amber" : done ? "bg-green/40" : "bg-white/15";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`relative cursor-pointer overflow-hidden rounded-lg border border-border bg-surface py-3 pl-5 pr-4 ${
        done ? "opacity-60" : ""
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${stripe}`} />
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          <ClipboardCheckIcon className="h-3 w-3" /> Aufgabe
        </span>
        <StatusPill note={note} />
        {critical && <CriticalBadge />}
        <span className="ml-auto font-mono text-[10px] text-text-muted">{timeLabel(note.createdAt)}</span>
      </div>
      <p className={`text-sm leading-snug ${done ? "line-through decoration-white/20" : ""}`}>{note.body}</p>
      {note.photo && <PhotoPlaceholder className="mt-2 h-24 w-full" />}
      {note.items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {note.items.map((l) => (
            <ItemChip key={l.itemId} link={l} />
          ))}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <DueBadge note={note} />
        <VehicleChip id={note.vehicleId} onClick={note.vehicleId ? () => onVehicle(note.vehicleId!) : undefined} />
        <span className="ml-auto flex items-center gap-3 text-[11px] text-text-muted">
          <span>von {firstName(note.authorId)}</span>
          {note.assigneeId && (
            <span className="flex items-center gap-1">
              <Avatar id={note.assigneeId} size="sm" />
              {firstName(note.assigneeId)}
            </span>
          )}
          {count > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircleIcon className="h-3.5 w-3.5" />
              {count}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

import {
  CHECKLIST,
  ME,
  TEAM,
  VEHICLES,
  type ChecklistItem,
  type ItemReason,
  type Note,
  type NoteItem,
} from "./_data";

const DAY = 24 * 60 * 60_000;

export const isOpenTask = (n: Note) =>
  n.kind === "task" && (n.status === "open" || n.status === "in_progress");

export function isOverdue(n: Note, now = new Date()) {
  return isOpenTask(n) && !!n.dueAt && new Date(n.dueAt).getTime() < now.getTime();
}

export function isDueToday(n: Note, now = new Date()) {
  return isOpenTask(n) && !!n.dueAt && !isOverdue(n, now) && sameDay(new Date(n.dueAt), now);
}

// critical > overdue > due asc > no due last > newest
export function sortTasks(tasks: Note[], now = new Date()): Note[] {
  const rank = (n: Note) => (n.priority === "critical" ? 0 : isOverdue(n, now) ? 1 : 2);
  return [...tasks].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.dueAt && b.dueAt) {
      const d = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (d !== 0) return d;
    } else if (a.dueAt || b.dueAt) {
      return a.dueAt ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const sameDay = (a: Date, b: Date) => startOfDay(a) === startOfDay(b);
const dayDiff = (d: Date, now: Date) => Math.round((startOfDay(d) - startOfDay(now)) / DAY);
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function dueLabel(iso: string, now = new Date(), open = true): string {
  const d = new Date(iso);
  if (open && d.getTime() < now.getTime()) {
    const days = Math.floor((now.getTime() - d.getTime()) / DAY);
    if (days >= 1) return `Überfällig seit ${days} T`;
    const hours = Math.max(1, Math.floor((now.getTime() - d.getTime()) / 3_600_000));
    return `Überfällig seit ${hours} Std`;
  }
  const diff = dayDiff(d, now);
  if (diff === 0) return `Heute ${hhmm(d)}`;
  if (diff === 1) return "Morgen";
  return `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

export function timeLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = dayDiff(d, now);
  if (diff === 0) return hhmm(d);
  if (diff === -1) return `Gestern ${hhmm(d)}`;
  if (diff > -7) return `${WEEKDAYS[d.getDay()]} ${hhmm(d)}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${hhmm(d)}`;
}

export function relativeLabel(iso: string, now = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  if (min < 24 * 60) return `vor ${Math.floor(min / 60)} Std`;
  const days = Math.floor(min / (24 * 60));
  return days === 1 ? "gestern" : `vor ${days} T`;
}

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = dayDiff(d, now);
  if (diff === 0) return "Heute";
  if (diff === -1) return "Gestern";
  return `${WEEKDAYS_LONG[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

export const dayKey = (iso: string) => startOfDay(new Date(iso));

export function reasonLabel(r: ItemReason, quantity?: number): string {
  const base = { used: "Verbraucht", missing: "Fehlt", damaged: "Beschädigt", restocked: "Aufgefüllt" }[r];
  return quantity && quantity > 1 ? `${base} ${quantity}×` : base;
}
export const REASONS: ItemReason[] = ["used", "missing", "damaged", "restocked"];

export const member = (id: string | null | undefined) => TEAM.find((m) => m.id === id);
export const memberName = (id: string | null | undefined) => {
  const m = member(id);
  return m ? `${m.firstName} ${m.lastName}` : "Unbekannt";
};
export const firstName = (id: string | null | undefined) => member(id)?.firstName ?? "Unbekannt";
export const initials = (id: string | null | undefined) => {
  const m = member(id);
  return m ? `${m.firstName[0]}${m.lastName[0]}` : "?";
};
export const vehicleName = (id: string | null) =>
  id ? (VEHICLES.find((v) => v.id === id)?.name ?? "Fahrzeug") : "Allgemein";

// ---- Checklist lookups ------------------------------------------------------

type ItemInfo = { item: ChecklistItem; category: string; parent?: string };
export const ITEM_INDEX: Record<string, ItemInfo> = {};
for (const cat of CHECKLIST) {
  for (const it of cat.items) {
    ITEM_INDEX[it.id] = { item: it, category: cat.title };
    for (const sub of it.subItems ?? []) {
      ITEM_INDEX[sub.id] = { item: sub, category: cat.title, parent: it.title };
    }
  }
}
export const itemTitle = (id: string) => ITEM_INDEX[id]?.item.title ?? id;

// ---- Item flags (§4.2 flag rule) -----------------------------------------------

export type Flag = { note: Note; link: NoteItem };

/** itemId -> flags for a vehicle. Task: while open/in progress. Info: until the next protocol. */
export function flagsFor(
  vehicleId: string,
  notes: Note[],
  lastHandover: Record<string, string>
): Record<string, Flag[]> {
  const out: Record<string, Flag[]> = {};
  const since = lastHandover[vehicleId] ? new Date(lastHandover[vehicleId]).getTime() : 0;
  for (const n of notes) {
    if (n.vehicleId !== vehicleId || n.items.length === 0) continue;
    const active =
      n.kind === "task" ? isOpenTask(n) : n.status === "posted" && new Date(n.createdAt).getTime() > since;
    if (!active) continue;
    for (const link of n.items) (out[link.itemId] ??= []).push({ note: n, link });
  }
  return out;
}

/** Notes shown in the protocol block for a vehicle. */
export function protocolNotes(vehicleId: string, notes: Note[], lastHandover: Record<string, string>) {
  const since = lastHandover[vehicleId] ? new Date(lastHandover[vehicleId]).getTime() : 0;
  const mine = (n: Note) => n.vehicleId === null || n.vehicleId === vehicleId;
  const tasks = sortTasks(notes.filter((n) => mine(n) && isOpenTask(n)));
  const infos = notes
    .filter((n) => mine(n) && n.kind === "info" && n.status === "posted" && new Date(n.createdAt).getTime() > since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { tasks, infos };
}

/** Mock unread badge: others' notes from the last 6 hours. */
export function unreadCount(notes: Note[], now = new Date()) {
  return notes.filter(
    (n) => n.authorId !== ME && n.status !== "dismissed" && now.getTime() - new Date(n.createdAt).getTime() < 6 * 3_600_000
  ).length;
}

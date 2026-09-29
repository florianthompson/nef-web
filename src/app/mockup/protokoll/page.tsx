"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CarIcon,
  CheckIcon,
  ChevronDownIcon,
  CrossIcon,
  FlagIcon,
  LockIcon,
  PackageIcon,
  SendIcon,
  StickyNoteIcon,
  WrenchIcon,
} from "lucide-react";
import { CHECKLIST, DEFAULT_VEHICLE, ME, VEHICLES, type ChecklistItem, type Note, type NoteItem } from "../_data";
import {
  flagsFor,
  firstName,
  isOpenTask,
  protocolNotes,
  reasonLabel,
  relativeLabel,
  vehicleName,
  type Flag,
} from "../_lib";
import { CriticalBadge, DueBadge, ItemChip } from "../_components/NoteBits";
import { ItemPicker } from "../_components/ItemPicker";
import { newId, useMock } from "../_components/MockStore";

const SECTION_ICONS = [CarIcon, WrenchIcon, CrossIcon, LockIcon];

const leavesOf = (it: ChecklistItem) => (it.subItems?.length ? it.subItems : [it]);
const ALL_LEAVES = CHECKLIST.flatMap((c) => c.items.flatMap(leavesOf)).map((i) => i.id);
const TOTAL = CHECKLIST.reduce((s, c) => s + c.items.reduce((t, i) => t + 1 + (i.subItems?.length ?? 0), 0), 0);

function Checkbox({ on, tone = "green" }: { on: boolean; tone?: "green" | "red" }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
        on ? (tone === "green" ? "border-green bg-green/15 text-green" : "border-red bg-red/15 text-red") : "border-border"
      }`}
    >
      {on && "✓"}
    </span>
  );
}

function ProtocolRun({
  vehicleId,
  demo,
  onVehicle,
  onReset,
}: {
  vehicleId: string;
  demo: string | null;
  onVehicle: (id: string) => void;
  onReset: () => void;
}) {
  const { notes, lastHandover, ackedIds, setAck, completeNotes, markHandover, addNote, toast } = useMock();
  const ready = demo === "ready" || demo === "confirm";

  const [dropdown, setDropdown] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(ready ? ALL_LEAVES : []));
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [popover, setPopover] = useState<string | null>(null);
  const [shiftNote, setShiftNote] = useState("");
  const [infoOnly, setInfoOnly] = useState(false);
  const [shiftItems, setShiftItems] = useState<NoteItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ackLocal, setAckLocal] = useState<Set<string>>(() =>
    ready
      ? new Set(
          protocolNotes(vehicleId, notes, lastHandover)
            .tasks.concat(protocolNotes(vehicleId, notes, lastHandover).infos)
            .filter((n) => n.priority === "critical")
            .map((n) => n.id)
        )
      : new Set()
  );
  const [confirm, setConfirm] = useState<Set<string> | null>(() => {
    if (demo !== "confirm") return null;
    return new Set(
      notes.filter((n) => n.vehicleId === vehicleId && isOpenTask(n) && n.items.length > 0 && !n.items.some((l) => l.reason === "damaged")).map((n) => n.id)
    );
  });
  const [submitted, setSubmitted] = useState<{ done: Note[]; checked: number } | null>(null);

  const flags = useMemo(() => flagsFor(vehicleId, notes, lastHandover), [vehicleId, notes, lastHandover]);
  const { tasks, infos } = useMemo(() => protocolNotes(vehicleId, notes, lastHandover), [vehicleId, notes, lastHandover]);
  const criticals = [...tasks, ...infos].filter((n) => n.priority === "critical");
  const isAcked = (id: string) => ackLocal.has(id) || ackedIds.includes(id);
  const unacked = criticals.filter((n) => !isAcked(n.id));

  const isFlagged = (id: string) => !!flags[id];
  const flaggedIds = ALL_LEAVES.filter(isFlagged);
  const isChecked = (it: ChecklistItem) => (it.subItems?.length ? it.subItems.every((s) => checked.has(s.id)) : checked.has(it.id));
  const checkedCount = CHECKLIST.reduce(
    (s, c) => s + c.items.reduce((t, i) => t + (isChecked(i) ? 1 : 0) + (i.subItems?.filter((x) => checked.has(x.id)).length ?? 0), 0),
    0
  );

  function toggleLeaf(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // Bulk actions skip flagged items
  function toggleParent(it: ChecklistItem) {
    const targets = (it.subItems ?? []).filter((s) => !isFlagged(s.id));
    const allOn = targets.every((s) => checked.has(s.id));
    setChecked((prev) => {
      const next = new Set(prev);
      for (const s of targets) {
        if (allOn) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });
  }
  function markAllOk(catId: string) {
    const cat = CHECKLIST.find((c) => c.id === catId)!;
    setChecked((prev) => {
      const next = new Set(prev);
      for (const it of cat.items) for (const l of leavesOf(it)) if (!isFlagged(l.id)) next.add(l.id);
      return next;
    });
  }
  function toggleAck(id: string) {
    if (isAcked(id)) {
      setAckLocal((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setAck(id, false);
    } else {
      setAckLocal((s) => new Set(s).add(id));
    }
  }

  // Open task notes whose linked items were ALL checked in this run
  const candidates = notes.filter(
    (n) => n.vehicleId === vehicleId && isOpenTask(n) && n.items.length > 0 && n.items.every((l) => checked.has(l.itemId))
  );
  const defaultSelection = () => new Set(candidates.filter((n) => !n.items.some((l) => l.reason === "damaged")).map((n) => n.id));
  const missing = CHECKLIST.flatMap((c) => c.items.flatMap(leavesOf)).filter((i) => !checked.has(i.id));

  function submit() {
    const sel = confirm ?? new Set<string>();
    const done = candidates.filter((n) => sel.has(n.id));
    completeNotes(done.map((n) => n.id));
    if (shiftNote.trim()) {
      addNote({
        id: newId("n"),
        kind: infoOnly ? "info" : "task",
        status: infoOnly ? "posted" : "open",
        priority: "normal",
        body: shiftNote.trim(),
        authorId: ME,
        vehicleId,
        createdAt: new Date().toISOString(),
        dueAt: null,
        assigneeId: null,
        photo: false,
        items: shiftItems,
        events: [],
      });
    }
    markHandover(vehicleId);
    setSubmitted({ done, checked: checkedCount });
    setConfirm(null);
    toast("Protokoll gespeichert");
  }

  function scrollToFlag() {
    const first = ALL_LEAVES.find(isFlagged);
    if (!first) return;
    const cat = CHECKLIST.find((c) => c.items.some((i) => leavesOf(i).some((l) => l.id === first)))!;
    setOpenMap((m) => ({ ...m, [cat.id]: true }));
    setTimeout(() => document.querySelector(`[data-flagged="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  if (submitted) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green/10">
          <CheckIcon className="h-8 w-8 text-green" />
        </div>
        <h1 className="mb-2 text-xl font-bold">Protokoll gespeichert</h1>
        <p className="mb-1 text-sm text-text-muted">
          {vehicleName(vehicleId)} — {new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="mb-6 font-mono text-sm">
          <span className="text-green">{submitted.checked} geprüft</span>
          {TOTAL - submitted.checked > 0 && <span className="text-red"> · {TOTAL - submitted.checked} fehlend</span>}
        </p>
        {submitted.done.length > 0 && (
          <div className="mb-6 rounded-lg border border-border p-4 text-left">
            <p className="mb-2 text-xs font-medium text-text-muted">Erledigte Aufgaben:</p>
            {submitted.done.map((n) => (
              <p key={n.id} className="text-sm text-green">
                ✓ {n.body}
              </p>
            ))}
          </div>
        )}
        <div className="flex justify-center gap-3">
          <Link href="/mockup/notizen" className="rounded-lg border border-border px-5 py-3 text-sm font-medium">
            Zu den Notizen
          </Link>
          <button onClick={onReset} className="rounded-lg bg-red px-6 py-3 text-sm font-semibold text-white">
            Neues Protokoll
          </button>
        </div>
      </div>
    );
  }

  function FlagBadges({ id }: { id: string }) {
    const fl = flags[id];
    if (!fl) return null;
    const crit = fl.some((f: Flag) => f.note.priority === "critical");
    return (
      <span className="flex shrink-0 flex-wrap justify-end gap-1">
        {fl.slice(0, 2).map((f) => (
          <button
            key={f.note.id}
            onClick={() => setPopover(popover === `${id}:${f.note.id}` ? null : `${id}:${f.note.id}`)}
            className={`rounded border px-1.5 py-1 font-mono text-[9.5px] font-bold ${
              crit ? "border-red/30 bg-red/15 text-red" : "border-amber/30 bg-amber/15 text-amber"
            }`}
          >
            {reasonLabel(f.link.reason, f.link.quantity)}
          </button>
        ))}
      </span>
    );
  }

  function Popover({ id }: { id: string }) {
    const f = flags[id]?.find((x) => popover === `${id}:${x.note.id}`);
    if (!f) return null;
    return (
      <div className="mx-4 mb-2 rounded-lg border border-border bg-surface p-3 shadow-lg">
        <p className="text-xs leading-snug">{f.note.body}</p>
        <p className="mt-1.5 text-[11px] text-text-muted">
          {firstName(f.note.authorId)} · {relativeLabel(f.note.createdAt)}
        </p>
        <Link href={`/mockup/notizen/${f.note.id}`} className="mt-1.5 inline-block text-xs font-semibold text-red">
          Notiz öffnen ›
        </Link>
      </div>
    );
  }

  function Row({ it, indent }: { it: ChecklistItem; indent: boolean }) {
    const flagged = isFlagged(it.id);
    const crit = flags[it.id]?.some((f) => f.note.priority === "critical");
    const on = checked.has(it.id);
    return (
      <div>
        <div
          data-flagged={flagged ? it.id : undefined}
          className={`flex items-center gap-2 border-l-2 pr-4 ${indent ? "pl-[2.25rem]" : "pl-[0.875rem]"} ${
            flagged ? (crit ? "border-red bg-red/5" : "border-amber bg-amber/5") : "border-transparent"
          }`}
        >
          <button onClick={() => toggleLeaf(it.id)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
            <Checkbox on={on} />
            <span className={`text-sm ${on ? "text-text-muted" : ""}`}>{it.title}</span>
          </button>
          <FlagBadges id={it.id} />
        </div>
        <Popover id={it.id} />
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-4">
      <div className="mb-6 text-center">
        <span className="mb-2 inline-block rounded-lg bg-red px-2.5 py-1.5 font-mono text-xs font-bold text-white">NEF</span>
        <h1 className="text-lg font-bold">Schichtprotokoll</h1>
        <p className="text-xs text-text-muted">Fahrzeug-Übergabecheck</p>
      </div>

      {/* Vehicle Selector */}
      <div className="relative mb-6">
        <button
          onClick={() => setDropdown(!dropdown)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
        >
          <span>{vehicleName(vehicleId)}</span>
          <ChevronDownIcon className={`h-4 w-4 text-text-muted transition-transform ${dropdown ? "rotate-180" : ""}`} />
        </button>
        {dropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
            {VEHICLES.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setDropdown(false);
                  onVehicle(v.id);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface2 ${v.id === vehicleId ? "text-red" : ""}`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes for this vehicle */}
      <div className="mb-6 rounded-lg border border-amber/20 bg-amber/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <StickyNoteIcon className="h-4 w-4 text-amber" />
          <span className="text-xs font-semibold text-amber">Notizen zu diesem Fahrzeug ({tasks.length + infos.length})</span>
        </div>
        {tasks.length + infos.length === 0 && <p className="text-xs text-text-muted">Keine offenen Notizen.</p>}
        {[
          { label: null, list: tasks },
          { label: "Seit der letzten Übergabe", list: infos },
        ].map(
          (sec) =>
            sec.list.length > 0 && (
              <div key={sec.label ?? "tasks"}>
                {sec.label && (
                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{sec.label}</p>
                )}
                {sec.list.map((n) => (
                  <div key={n.id} className="border-t border-amber/10 py-2.5 first:border-t-0 first:pt-1">
                    <Link href={`/mockup/notizen/${n.id}`} className="block">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-semibold">{firstName(n.authorId)}</span>
                        <span className="text-text-muted">{relativeLabel(n.createdAt)}</span>
                        {n.priority === "critical" && <CriticalBadge />}
                        <DueBadge note={n} />
                      </div>
                      <p className="text-xs leading-snug">{n.body}</p>
                    </Link>
                    {n.items.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {n.items.map((l) => (
                          <ItemChip key={l.itemId} link={l} />
                        ))}
                      </div>
                    )}
                    {n.priority === "critical" && (
                      <button onClick={() => toggleAck(n.id)} className="mt-2 flex items-center gap-2 text-xs font-medium text-red">
                        <Checkbox on={isAcked(n.id)} tone="red" />
                        Zur Kenntnis genommen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
        )}
        <Link href={`/mockup/notizen?vehicle=${vehicleId}`} className="mt-3 block text-xs font-semibold text-amber">
          Alle Notizen zu {vehicleName(vehicleId)} ›
        </Link>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-text-muted">Fortschritt</span>
          <span className="font-mono">
            {checkedCount}/{TOTAL}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(checkedCount / TOTAL) * 100}%`,
              backgroundColor: checkedCount === TOTAL ? "#22c55e" : checkedCount > TOTAL * 0.5 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
        {flaggedIds.length > 0 && (
          <button onClick={scrollToFlag} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber">
            <FlagIcon className="h-3.5 w-3.5" />
            {flaggedIds.length} markierte Position{flaggedIds.length > 1 ? "en" : ""} prüfen / auffüllen
          </button>
        )}
      </div>

      {/* Checklist */}
      <div className="mb-6 space-y-3">
        {CHECKLIST.map((cat, idx) => {
          const leaves = cat.items.flatMap(leavesOf);
          const flaggedN = leaves.filter((l) => isFlagged(l.id)).length;
          const total = cat.items.reduce((s, i) => s + 1 + (i.subItems?.length ?? 0), 0);
          const done = cat.items.reduce(
            (s, i) => s + (isChecked(i) ? 1 : 0) + (i.subItems?.filter((x) => checked.has(x.id)).length ?? 0),
            0
          );
          const isOpen = openMap[cat.id] ?? flaggedN > 0;
          const complete = done === total;
          const Icon = SECTION_ICONS[idx % SECTION_ICONS.length];
          const openLeft = leaves.filter((l) => !isFlagged(l.id) && !checked.has(l.id)).length;
          return (
            <div key={cat.id} className="overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setOpenMap((m) => ({ ...m, [cat.id]: !isOpen }))}
                className="flex w-full items-center gap-3 bg-surface px-4 py-3"
              >
                <Icon className={`h-4 w-4 ${complete ? "text-green" : "text-text-muted"}`} />
                <span className="flex-1 text-left text-sm font-medium">{cat.title}</span>
                {flaggedN > 0 && <span className="font-mono text-xs font-bold text-amber">⚑ {flaggedN}</span>}
                <span className={`font-mono text-xs ${complete ? "text-green" : "text-text-muted"}`}>
                  {done}/{total}
                </span>
                <ChevronDownIcon className={`h-4 w-4 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border">
                  {cat.narcotics ? (
                    <div className="border-b border-border bg-amber/5 px-4 py-2 text-center text-xs font-medium text-amber">
                      Einzeln prüfen
                    </div>
                  ) : (
                    <>
                      {openLeft > 0 && (
                        <button
                          onClick={() => markAllOk(cat.id)}
                          className="w-full border-b border-border bg-green/5 px-4 py-2 text-center text-xs font-semibold text-green transition-colors hover:bg-green/10"
                        >
                          Alles OK
                        </button>
                      )}
                      {flaggedN > 0 && (
                        <div className="border-b border-border bg-amber/5 px-4 py-1.5 text-center text-[11px] text-amber">
                          {flaggedN} markierte Position{flaggedN > 1 ? "en" : ""} einzeln prüfen
                        </div>
                      )}
                    </>
                  )}
                  {cat.items.map((it) =>
                    it.subItems?.length ? (
                      <div key={it.id}>
                        <button
                          onClick={() => toggleParent(it)}
                          className="flex w-full items-center gap-3 bg-surface2 px-4 py-2 text-left"
                        >
                          <span className={`text-xs font-medium ${isChecked(it) ? "text-green" : "text-text-muted"}`}>{it.title}</span>
                          {it.subItems.some((s) => isFlagged(s.id)) && (
                            <span className="font-mono text-[10px] font-bold text-amber">
                              ⚑ {it.subItems.filter((s) => isFlagged(s.id)).length}
                            </span>
                          )}
                          <span className="ml-auto font-mono text-[10px] text-text-muted">
                            {it.subItems.filter((s) => checked.has(s.id)).length}/{it.subItems.length}
                          </span>
                        </button>
                        {it.subItems.map((s) => (
                          <Row key={s.id} it={s} indent />
                        ))}
                      </div>
                    ) : (
                      <Row key={it.id} it={it} indent={false} />
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shift Notes */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-medium text-text-muted">Übergabe-Notizen (optional)</label>
        <textarea
          value={shiftNote}
          onChange={(e) => setShiftNote(e.target.value)}
          placeholder="Hinweise für die nächste Schicht…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <button onClick={() => setInfoOnly(!infoOnly)} className="flex items-center gap-2 text-xs text-text-muted">
            <Checkbox on={infoOnly} />
            Nur Info (keine Aufgabe)
          </button>
          <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-red">
            <PackageIcon className="h-3.5 w-3.5" />
            Material markieren
          </button>
        </div>
        {shiftItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shiftItems.map((l) => (
              <ItemChip key={l.itemId} link={l} />
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={() => setConfirm(defaultSelection())}
        disabled={unacked.length > 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
      >
        <SendIcon className="h-4 w-4" />
        Protokoll abschließen ({checkedCount}/{TOTAL})
      </button>
      {unacked.length > 0 && <p className="mt-2 text-center text-xs text-red">Bitte kritische Notizen bestätigen</p>}

      <ItemPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={shiftItems}
        onChange={setShiftItems}
        defaultReason={infoOnly ? "restocked" : "missing"}
      />

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-bg p-6">
            <h2 className="mb-2 text-lg font-bold">Protokoll absenden?</h2>
            <p className="mb-1 text-sm text-text-muted">{vehicleName(vehicleId)}</p>
            <p className="mb-2 font-mono text-sm">
              <span className="text-green">{checkedCount} geprüft</span>
              {missing.length > 0 && <span className="text-red"> · {missing.length} fehlend</span>}
            </p>
            {missing.length > 0 && (
              <p className="mb-4 text-xs text-red/80">
                Fehlend: {missing.slice(0, 4).map((m) => m.title).join(", ")}
                {missing.length > 4 ? ` +${missing.length - 4}` : ""}
              </p>
            )}
            {shiftNote.trim() && <p className="mb-4 rounded-lg bg-surface p-3 text-xs text-text-muted">{shiftNote}</p>}

            {candidates.length > 0 && (
              <div className="mb-4 rounded-lg border border-green/20 bg-green/5 p-3">
                <p className="text-sm font-semibold">Aufgabe erledigen?</p>
                <p className="mb-2 text-xs text-text-muted">Alle markierten Positionen wurden geprüft.</p>
                {candidates.map((n) => {
                  const on = confirm.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() =>
                        setConfirm((s) => {
                          const next = new Set(s);
                          if (on) next.delete(n.id);
                          else next.add(n.id);
                          return next;
                        })
                      }
                      className="flex w-full items-start gap-3 border-t border-green/10 py-2 text-left first:border-t-0"
                    >
                      <span className="mt-0.5">
                        <Checkbox on={on} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs leading-snug">{n.body}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {n.items.map((l) => (
                            <ItemChip key={l.itemId} link={l} />
                          ))}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium">
                Abbrechen
              </button>
              <button onClick={submit} className="flex-1 rounded-lg bg-red py-2.5 text-sm font-semibold text-white">
                Abschließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Protokoll() {
  const demo = useSearchParams().get("demo");
  const [vehicleId, setVehicleId] = useState(DEFAULT_VEHICLE);
  const [run, setRun] = useState(0);
  return (
    <ProtocolRun
      key={`${vehicleId}-${run}`}
      vehicleId={vehicleId}
      demo={run === 0 ? demo : null}
      onVehicle={setVehicleId}
      onReset={() => setRun((r) => r + 1)}
    />
  );
}

export default function ProtokollPage() {
  return (
    <Suspense fallback={null}>
      <Protokoll />
    </Suspense>
  );
}

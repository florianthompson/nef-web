"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CarIcon,
  WrenchIcon,
  CrossIcon,
  LockIcon,
  ChevronRightIcon,
  CheckIcon,
  ArrowUpCircleIcon,
  Trash2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ZapIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  FileTextIcon,
} from "lucide-react";
import {
  DEMO_CATEGORIES,
  DEMO_NOTES,
  DEMO_VEHICLES,
  type DemoCategory,
  type DemoItem,
  type DemoNote,
  type DemoSubItem,
  type DemoVehicle,
} from "@/lib/demo-data";

const SECTION_ICONS = [CarIcon, WrenchIcon, CrossIcon, LockIcon];

function isNarcotic(cat: DemoCategory): boolean {
  return cat.type === "narcotics";
}

function flatten(cat: DemoCategory): Array<DemoItem | DemoSubItem> {
  const flat: Array<DemoItem | DemoSubItem> = [];
  cat.items.forEach((item) => {
    if (item.subItems.length > 0) item.subItems.forEach((s) => flat.push(s));
    else flat.push(item);
  });
  return flat;
}

function formatExpiry(d: string): string {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function isExpired(d: string): boolean {
  return new Date(d) < new Date();
}

function isCloseToExpiry(d: string, days = 30): boolean {
  const diff = new Date(d).getTime() - Date.now();
  return diff >= 0 && diff <= days * 86400000;
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} – ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DemoHomePage() {
  const [categories, setCategories] = useState<DemoCategory[]>(DEMO_CATEGORIES);
  const [vehicles] = useState<DemoVehicle[]>(DEMO_VEHICLES);
  const [selectedVehicle, setSelectedVehicle] = useState<DemoVehicle>(
    DEMO_VEHICLES.find((v) => v.isDefault) ?? DEMO_VEHICLES[0]
  );
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [notes, setNotes] = useState<DemoNote[]>(DEMO_NOTES);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    0: true,
  });
  const [shiftNote, setShiftNote] = useState("");
  const [verifiedNotes, setVerifiedNotes] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const allFlat = useMemo(
    () => categories.flatMap(flatten),
    [categories]
  );
  const totalItems = allFlat.length;
  const checkedCount = allFlat.filter((i) => i.is_completed).length;
  const progress = totalItems > 0 ? checkedCount / totalItems : 0;
  const allChecked = checkedCount === totalItems;

  const notesForVehicle = useMemo(
    () => notes.filter((n) => n.vehicleId === selectedVehicle.id),
    [notes, selectedVehicle.id]
  );
  const openNoteCount = notesForVehicle.length;

  function sectionProgress(idx: number) {
    const cat = categories[idx];
    if (!cat) return { done: 0, total: 0 };
    const flat = flatten(cat);
    return {
      done: flat.filter((i) => i.is_completed).length,
      total: flat.length,
    };
  }

  function toggleItem(catIdx: number, itemId: string) {
    setCategories((prev) =>
      prev.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          items: cat.items.map((it) =>
            it.id === itemId ? { ...it, is_completed: !it.is_completed } : it
          ),
        };
      })
    );
  }

  function toggleSubItem(catIdx: number, itemId: string, subId: string) {
    setCategories((prev) =>
      prev.map((cat, ci) => {
        if (ci !== catIdx) return cat;
        return {
          ...cat,
          items: cat.items.map((it) => {
            if (it.id !== itemId) return it;
            const newSubs = it.subItems.map((s) =>
              s.id === subId ? { ...s, is_completed: !s.is_completed } : s
            );
            return {
              ...it,
              subItems: newSubs,
              is_completed: newSubs.every((s) => s.is_completed),
            };
          }),
        };
      })
    );
  }

  function markSectionComplete(catIdx: number) {
    setCategories((prev) =>
      prev.map((cat, ci) => {
        if (ci !== catIdx || isNarcotic(cat)) return cat;
        return {
          ...cat,
          items: cat.items.map((it) => ({
            ...it,
            is_completed: true,
            subItems: it.subItems.map((s) => ({ ...s, is_completed: true })),
          })),
        };
      })
    );
  }

  function completeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setVerifiedNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function submitComment(noteId: string) {
    const text = (commentTexts[noteId] ?? "").trim();
    if (!text) return;
    setCommentTexts((p) => ({ ...p, [noteId]: "" }));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              comments: [
                ...n.comments,
                {
                  id: `c-${Date.now()}`,
                  authorName: "Max",
                  value: text,
                },
              ],
            }
          : n
      )
    );
  }

  function reset() {
    setCategories(DEMO_CATEGORIES.map((c) => ({
      ...c,
      items: c.items.map((i) => ({
        ...i,
        is_completed: false,
        subItems: i.subItems.map((s) => ({ ...s, is_completed: false })),
      })),
    })));
    setNotes(DEMO_NOTES);
    setVerifiedNotes({});
    setCommentTexts({});
    setShiftNote("");
    setOpenSections({ 0: true });
    setSubmitted(false);
  }

  const missing = categories.flatMap((cat) =>
    flatten(cat)
      .filter((i) => !i.is_completed)
      .map((i) => ({ itemId: i.id, section: cat.title, item: i.title }))
  );

  if (submitted) {
    const successTime = now ?? new Date();
    return (
      <div className="px-6 pb-10 pt-20 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green/10">
          <CheckCircle2Icon className="h-12 w-12 text-green" />
        </div>
        <h1 className="mb-2 text-2xl font-extrabold text-white">
          Protokoll übermittelt
        </h1>
        <div className="mb-8 flex items-center justify-center gap-2 text-sm">
          <span className="font-bold text-text-muted">
            {selectedVehicle.name}
          </span>
          <span className="text-text-muted">·</span>
          <span className="font-mono text-text-muted">
            {successTime.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="mb-8 flex items-stretch justify-center gap-8 rounded-2xl border border-border bg-surface px-8 py-5">
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-3xl font-extrabold text-green">
              {checkedCount}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Geprüft
            </span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col items-center gap-1">
            <span
              className={`font-mono text-3xl font-extrabold ${
                missing.length > 0 ? "text-red" : "text-green"
              }`}
            >
              {missing.length}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Fehlend
            </span>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="mb-4 rounded-2xl border border-red/20 bg-red/10 p-4 text-left">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircleIcon className="h-[18px] w-[18px] text-red" />
              <span className="text-xs font-bold uppercase tracking-wider text-red">
                Fehlend
              </span>
            </div>
            {missing.map((u, i) => (
              <div
                key={i}
                className="border-b border-white/[0.04] py-2 last:border-0"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {u.section}
                </p>
                <p className="text-sm text-white/70">{u.item}</p>
              </div>
            ))}
          </div>
        )}

        {shiftNote && (
          <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-left">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Notiz
            </p>
            <p className="text-sm text-white/70">{shiftNote}</p>
          </div>
        )}

        <button
          onClick={reset}
          className="rounded-xl border border-white/10 bg-white/[0.06] px-8 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
        >
          Neues Protokoll
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-5 pb-1.5 pt-4">
        <span className="font-mono text-[13px] font-semibold text-text-muted">
          {now
            ? now.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--"}
        </span>
        {openNoteCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber/10 px-2.5 py-1">
            <FileTextIcon className="h-[13px] w-[13px] text-amber" />
            <span className="text-[11px] font-semibold text-amber">
              {openNoteCount} offen
            </span>
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3.5 px-5 pb-3 pt-4">
        <div className="rounded-[10px] bg-red px-[11px] py-2.5">
          <span className="font-mono text-[13px] font-extrabold tracking-wider text-white">
            NEF
          </span>
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white">
            Schichtprotokoll
          </h1>
          <p className="text-[13px] font-medium text-text-muted">
            Fahrzeug-Übergabecheck
          </p>
        </div>
      </div>

      <div className="px-4 pb-8">
        {/* Vehicle Selector */}
        <div className="mb-4">
          <label className="mb-2 block pl-0.5 text-[11px] font-bold uppercase tracking-widest text-text-muted">
            Fahrzeug
          </label>
          <button
            type="button"
            onClick={() => setVehicleDropdownOpen((v) => !v)}
            className={`flex w-full items-center justify-between rounded-xl border bg-surface2 px-4 py-3.5 text-left transition-colors ${
              vehicleDropdownOpen ? "border-red" : "border-white/10"
            }`}
          >
            <span className="text-[15px] font-bold text-white">
              {selectedVehicle.name}
            </span>
            <ChevronRightIcon
              className={`h-4 w-4 text-text-muted transition-transform ${
                vehicleDropdownOpen ? "rotate-90" : ""
              }`}
            />
          </button>
          {vehicleDropdownOpen && (
            <div className="mt-1.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#151517]">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVehicle(v);
                    setVehicleDropdownOpen(false);
                  }}
                  className={`w-full border-b border-white/[0.04] px-4 py-3 text-left text-sm font-bold last:border-0 ${
                    v.id === selectedVehicle.id ? "bg-red/15 text-white" : "text-white"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Open Notes */}
        {notesForVehicle.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface2">
            <button
              type="button"
              onClick={() => setNotesExpanded((v) => !v)}
              className="flex w-full items-center justify-between p-3.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/10">
                  <FileTextIcon className="h-[15px] w-[15px] text-amber" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Offene Notizen</p>
                  <p className="text-[11px] font-semibold text-text-muted">
                    {openNoteCount} offen
                  </p>
                </div>
              </div>
              <ChevronRightIcon
                className={`h-4 w-4 text-text-muted transition-transform ${
                  notesExpanded ? "rotate-90" : ""
                }`}
              />
            </button>

            {notesExpanded && (
              <div className="px-3.5 pb-3.5">
                {notesForVehicle.map((note) => {
                  const verified = !!verifiedNotes[note.id];
                  return (
                    <div
                      key={note.id}
                      className="mb-2 rounded-xl border-l-[3px] border-amber bg-white/[0.03] px-3.5 py-3 last:mb-0"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-white/60">
                          {note.authorName}
                        </span>
                        <span className="font-mono text-[11px] font-medium text-white/25">
                          {formatNoteDate(note.createdAt)}
                        </span>
                      </div>
                      <p
                        className={`mb-2.5 text-[13px] font-medium leading-snug text-white/80 ${
                          verified ? "opacity-50 line-through" : ""
                        }`}
                      >
                        {note.value}
                      </p>

                      {note.comments.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {note.comments.map((c) => (
                            <div key={c.id} className="flex gap-1.5 pl-0.5">
                              <span className="text-xs font-semibold text-white/45">
                                {c.authorName}:
                              </span>
                              <span className="flex-1 text-xs text-white/60">
                                {c.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mb-2.5 flex items-center gap-1.5">
                        <input
                          value={commentTexts[note.id] ?? ""}
                          onChange={(e) =>
                            setCommentTexts((p) => ({
                              ...p,
                              [note.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitComment(note.id);
                          }}
                          placeholder="Kommentar…"
                          className="h-8 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 text-xs text-white placeholder:text-white/25 focus:border-red focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => submitComment(note.id)}
                          disabled={!(commentTexts[note.id] ?? "").trim()}
                          className="p-0.5 transition-opacity disabled:opacity-30"
                        >
                          <ArrowUpCircleIcon className="h-6 w-6 text-red" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {!verified ? (
                          <button
                            type="button"
                            onClick={() =>
                              setVerifiedNotes((p) => ({ ...p, [note.id]: true }))
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5"
                          >
                            <CheckCircle2Icon className="h-4 w-4 text-white/50" />
                            <span className="text-xs font-semibold text-white/50">
                              Erledigt
                            </span>
                          </button>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 rounded-lg border border-green/30 bg-green/15 px-3 py-1.5">
                              <CheckCircle2Icon className="h-4 w-4 text-green" />
                              <span className="text-xs font-semibold text-green">
                                Erledigt
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => completeNote(note.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-red/30 bg-red/10 px-3 py-1.5"
                            >
                              <Trash2Icon className="h-3.5 w-3.5 text-red" />
                              <span className="text-xs font-semibold text-red">
                                Löschen
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="mb-5 px-0.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Fortschritt
            </span>
            <span className="text-sm">
              <span
                className={`font-bold ${
                  allChecked ? "text-green" : "text-red"
                }`}
              >
                {checkedCount}
              </span>
              <span className="text-text-muted"> / {totalItems}</span>
            </span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: allChecked
                  ? "#22c55e"
                  : progress > 0.6
                    ? "#f59e0b"
                    : "#ef4444",
              }}
            />
          </div>
        </div>

        {/* Sections */}
        {categories.map((cat, si) => {
          const sp = sectionProgress(si);
          const open = !!openSections[si];
          const complete = sp.done === sp.total && sp.total > 0;
          const narcotic = isNarcotic(cat);
          const Icon = SECTION_ICONS[si % SECTION_ICONS.length];

          return (
            <div
              key={cat.id}
              className="mb-2 overflow-hidden rounded-2xl border border-white/[0.05] bg-surface2"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenSections((p) => ({ ...p, [si]: !p[si] }))
                }
                className="flex w-full items-center justify-between p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                    <Icon className="h-[18px] w-[18px] text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {cat.title}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      complete ? "text-green" : "text-text-muted"
                    }`}
                  >
                    {sp.done}/{sp.total}
                    {complete && " ✓"}
                  </span>
                  <div className="h-[3px] w-10 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:
                          sp.total > 0 ? `${(sp.done / sp.total) * 100}%` : "0%",
                        backgroundColor: complete ? "#22c55e" : "#ef4444",
                      }}
                    />
                  </div>
                  <ChevronRightIcon
                    className={`h-4 w-4 text-text-muted transition-transform ${
                      open ? "rotate-90" : ""
                    }`}
                  />
                </div>
              </button>

              {open && (
                <div className="border-t border-white/[0.04]">
                  {!narcotic && !complete && (
                    <button
                      type="button"
                      onClick={() => markSectionComplete(si)}
                      className="flex w-full items-center justify-center gap-2 border-b border-white/[0.04] py-2.5"
                    >
                      <ZapIcon className="h-4 w-4 text-[#0a84ff]" />
                      <span className="text-[13px] font-bold text-[#0a84ff]">
                        Alles OK
                      </span>
                    </button>
                  )}
                  {narcotic && (
                    <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-3.5 py-2">
                      <ShieldCheckIcon className="h-3.5 w-3.5 text-amber" />
                      <span className="text-[11px] font-semibold text-amber">
                        Einzeln prüfen
                      </span>
                    </div>
                  )}

                  {cat.items.map((item) => {
                    const hasSubs = item.subItems.length > 0;
                    if (hasSubs) {
                      return (
                        <div key={item.id}>
                          <div className="px-3.5 pb-1 pt-2.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/30">
                              {item.title}
                            </p>
                          </div>
                          {item.subItems.map((sub) => (
                            <SubItemRow
                              key={sub.id}
                              sub={sub}
                              onToggle={() =>
                                toggleSubItem(si, item.id, sub.id)
                              }
                            />
                          ))}
                        </div>
                      );
                    }
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => toggleItem(si, item.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Shift Notes */}
        <div className="mb-4 mt-4">
          <label className="mb-2 block pl-0.5 text-[11px] font-bold uppercase tracking-widest text-text-muted">
            Schichtnotizen{" "}
            <span className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-text-muted">
              Optional
            </span>
          </label>
          <textarea
            value={shiftNote}
            onChange={(e) => setShiftNote(e.target.value)}
            placeholder="Fehlende Artikel, Schäden, Nachbestellungen oder Hinweise für die nächste Schicht…"
            rows={4}
            className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-surface2 px-4 py-3.5 text-sm leading-relaxed text-text placeholder:text-text-muted focus:border-red focus:outline-none"
          />
        </div>

        {/* Submit */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="flex w-full flex-col items-center gap-0.5 rounded-2xl bg-red py-4 transition-opacity hover:opacity-90"
          >
            <span className="text-base font-extrabold tracking-tight text-white">
              Protokoll absenden
            </span>
            <span className="font-mono text-xs font-semibold text-white/60">
              {checkedCount}/{totalItems} geprüft
            </span>
          </button>
          {!allChecked && (
            <p className="mt-2.5 text-center text-xs font-medium text-amber/80">
              ⚠ {totalItems - checkedCount} fehlende Position
              {totalItems - checkedCount !== 1 ? "en" : ""} — wird bei Abgabe als fehlend markiert
            </p>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="mb-5 w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#1a1a1d] p-6 pt-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2.5 text-[19px] font-extrabold text-white">
              Protokoll bestätigen
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-white/55">
              Schichtprotokoll für{" "}
              <span className="font-bold text-white">{selectedVehicle.name}</span>{" "}
              mit{" "}
              <span
                className={`font-bold ${
                  allChecked ? "text-green" : "text-amber"
                }`}
              >
                {checkedCount}/{totalItems}
              </span>{" "}
              geprüften Positionen absenden.
            </p>

            {shiftNote && (
              <div className="mb-3.5 rounded-xl border-l-[3px] border-white/15 bg-white/[0.04] px-3.5 py-2.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
                  Notiz
                </p>
                <p className="text-[13px] leading-snug text-white/60">
                  {shiftNote}
                </p>
              </div>
            )}

            {!allChecked && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red/20 bg-red/10 px-3.5 py-3">
                <AlertCircleIcon className="h-[18px] w-[18px] flex-shrink-0 text-red" />
                <span className="flex-1 text-[13px] font-semibold text-red">
                  {totalItems - checkedCount} Position
                  {totalItems - checkedCount !== 1 ? "en werden" : " wird"} als
                  fehlend markiert
                </span>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] py-3 text-sm font-bold text-text"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setSubmitted(true);
                }}
                className="flex-1 rounded-xl bg-red py-3 text-sm font-bold text-white"
              >
                Bestätigen & Senden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
}: {
  item: DemoItem;
  onToggle: () => void;
}) {
  const on = item.is_completed;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 border-b border-white/[0.03] px-3.5 py-3 text-left transition-colors last:border-0 ${
        on ? "bg-green/[0.06]" : ""
      }`}
    >
      <span
        className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[6px] border-2 ${
          on ? "border-green bg-green" : "border-white/20"
        }`}
      >
        {on && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      <span
        className={`flex-1 text-[13.5px] font-medium leading-snug text-text ${
          on ? "opacity-50" : ""
        }`}
      >
        {item.title}
      </span>
    </button>
  );
}

function SubItemRow({
  sub,
  onToggle,
}: {
  sub: DemoSubItem;
  onToggle: () => void;
}) {
  const on = sub.is_completed;
  const hasExpiry = !!sub.expiryDate;
  const expired = hasExpiry && isExpired(sub.expiryDate!);
  const close = hasExpiry && !expired && isCloseToExpiry(sub.expiryDate!);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 border-b border-white/[0.03] px-3.5 py-3 pl-7 text-left transition-colors last:border-0 ${
        on ? "bg-green/[0.06]" : ""
      }`}
    >
      <span
        className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[6px] border-2 ${
          on ? "border-green bg-green" : "border-white/20"
        }`}
      >
        {on && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      <span className="flex-1">
        <span
          className={`block text-[13.5px] font-medium leading-snug text-text ${
            on ? "opacity-50" : ""
          }`}
        >
          {sub.title}
        </span>
        {hasExpiry && (
          <span
            className={`mt-0.5 block text-[11px] ${
              expired
                ? "font-semibold text-red"
                : close
                  ? "text-amber"
                  : "text-text-muted"
            }`}
          >
            MHD: {formatExpiry(sub.expiryDate!)}
          </span>
        )}
      </span>
      {expired && (
        <AlertCircleIcon className="h-4 w-4 flex-shrink-0 text-red" />
      )}
      {close && (
        <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber" />
      )}
    </button>
  );
}

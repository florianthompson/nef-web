"use client";

import { useState } from "react";
import { CalendarIcon, CameraIcon, PackageIcon, UserIcon, XIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DEFAULT_VEHICLE, ME, TEAM, VEHICLES, type Note, type NoteItem, type NoteKind } from "../_data";
import { firstName, itemTitle } from "../_lib";
import { ItemChip, PhotoPlaceholder } from "./NoteBits";
import { ItemPicker } from "./ItemPicker";
import { newId, useMock } from "./MockStore";

const chip = (on: boolean, danger = false) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
    on
      ? danger
        ? "border-red bg-red text-white"
        : "border-red/40 bg-red/15 text-red"
      : "border-border bg-surface text-text-muted"
  }`;

function iso(dayOffset: number, h: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
}

function Form() {
  const { sheet, addNote, closeAddNote, toast } = useMock();
  const material = sheet.preset === "material";
  const [kind, setKind] = useState<NoteKind>(material ? "task" : "info");
  const [body, setBody] = useState("");
  const [vehicleId, setVehicleId] = useState<string | null>(sheet.vehicleId ?? DEFAULT_VEHICLE);
  const [critical, setCritical] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [items, setItems] = useState<NoteItem[]>(
    material
      ? [
          { itemId: "o2-2", reason: "missing" },
          { itemId: "absaug", reason: "damaged" },
        ]
      : []
  );
  const [pickerOpen, setPickerOpen] = useState(material);
  const [due, setDue] = useState<"today" | "tomorrow" | "date" | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);

  function selectVehicle(id: string | null) {
    setVehicleId(id);
    if (id === null) setItems([]);
  }

  function post() {
    if (!body.trim()) return;
    let dueAt: string | null = null;
    if (kind === "task") {
      if (due === "today") dueAt = iso(0, 18);
      if (due === "tomorrow") dueAt = iso(1, 12);
      if (due === "date" && dateValue) dueAt = new Date(`${dateValue}T12:00:00`).toISOString();
    }
    const n: Note = {
      id: newId("n"),
      kind,
      status: kind === "info" ? "posted" : "open",
      priority: critical ? "critical" : "normal",
      body: body.trim(),
      authorId: ME,
      vehicleId,
      createdAt: new Date().toISOString(),
      dueAt,
      assigneeId: kind === "task" ? assignee : null,
      photo,
      items,
      events: [],
    };
    addNote(n);
    closeAddNote();
    toast("Notiz gepostet");
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <SheetTitle className="text-base font-bold">Notiz hinzufügen</SheetTitle>
        <button onClick={closeAddNote} aria-label="Schließen" className="text-text-muted">
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 rounded-lg border border-border bg-surface2 p-1">
          {(["info", "task"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                kind === k ? "bg-surface text-text shadow-sm ring-1 ring-white/10" : "text-text-muted"
              }`}
            >
              {k === "info" ? "Info" : "Aufgabe"}
            </button>
          ))}
        </div>

        <textarea
          autoFocus={!material}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Was gibt's? z. B. Reifen hinten links abgefahren"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
        />

        <div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {VEHICLES.map((v) => (
              <button key={v.id} onClick={() => selectVehicle(v.id)} className={chip(vehicleId === v.id)}>
                {v.name}
              </button>
            ))}
            <button onClick={() => selectVehicle(null)} className={chip(vehicleId === null)}>
              Allgemein
            </button>
          </div>
        </div>

        <button
          onClick={() => setCritical(!critical)}
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors ${
            critical ? "border-red/40 bg-red/10 text-red" : "border-border bg-surface text-text-muted"
          }`}
        >
          <span className="font-medium">Kritisch</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${critical ? "bg-red" : "bg-white/10"}`}>
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${critical ? "left-[18px]" : "left-0.5"}`}
            />
          </span>
        </button>

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setPhoto(!photo)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium ${
                photo ? "border-red/40 bg-red/10 text-red" : "border-border bg-surface text-text-muted"
              }`}
            >
              <CameraIcon className="h-4 w-4" />
              Foto
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              disabled={vehicleId === null}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2.5 text-xs font-medium text-text-muted disabled:opacity-40"
            >
              <PackageIcon className="h-4 w-4" />
              Material markieren
            </button>
          </div>
          {vehicleId === null && (
            <p className="text-[11px] text-text-muted">Für „Material markieren“ bitte ein Fahrzeug wählen.</p>
          )}
        </div>

        {photo && (
          <div className="relative w-24">
            <PhotoPlaceholder className="h-24 w-24" />
            <button
              onClick={() => setPhoto(false)}
              aria-label="Foto entfernen"
              className="absolute -right-2 -top-2 rounded-full border border-border bg-bg p-0.5"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {items.map((l) => (
              <button key={l.itemId} onClick={() => setPickerOpen(true)} aria-label={itemTitle(l.itemId)}>
                <ItemChip link={l} />
              </button>
            ))}
          </div>
        )}

        {kind === "task" && (
          <>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <CalendarIcon className="h-3.5 w-3.5" /> Fällig
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setDue(due === "today" ? null : "today")} className={chip(due === "today")}>
                  Heute 18:00
                </button>
                <button onClick={() => setDue(due === "tomorrow" ? null : "tomorrow")} className={chip(due === "tomorrow")}>
                  Morgen
                </button>
                <button onClick={() => setDue(due === "date" ? null : "date")} className={chip(due === "date")}>
                  Datum…
                </button>
              </div>
              {due === "date" && (
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-red focus:outline-none [color-scheme:dark]"
                />
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <UserIcon className="h-3.5 w-3.5" /> Zuweisen
              </div>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TEAM.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setAssignee(assignee === m.id ? null : m.id)}
                    className={chip(assignee === m.id)}
                  >
                    {m.id === ME ? "Ich" : firstName(m.id)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <button
          onClick={post}
          disabled={!body.trim()}
          className="w-full rounded-lg bg-red py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        >
          Posten
        </button>
      </div>

      <ItemPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={items}
        onChange={setItems}
        defaultReason={kind === "task" ? "missing" : "restocked"}
      />
    </>
  );
}

export function AddNoteSheet() {
  const { sheet, closeAddNote } = useMock();
  return (
    <Sheet open={sheet.open} onOpenChange={(o) => !o && closeAddNote()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[92dvh] max-w-lg gap-0 rounded-t-2xl border-border bg-bg p-0"
      >
        <Form key={sheet.nonce} />
      </SheetContent>
    </Sheet>
  );
}

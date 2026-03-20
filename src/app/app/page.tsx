"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  CarIcon,
  WrenchIcon,
  CrossIcon,
  LockIcon,
  ChevronDownIcon,
  CheckIcon,
  SendIcon,
  StickyNoteIcon,
} from "lucide-react";

type Item = {
  id: string;
  title: string;
  is_completed: boolean;
  position: number;
  type: string;
  can_override: boolean;
  is_required: boolean;
  text_value: string;
  show_category_title: boolean;
  expiry_date: string | null;
  subItems: Item[];
};

type Category = {
  id: string;
  title: string;
  position: number;
  type: string;
  is_required: boolean;
  items: Item[];
};

type Protocol = {
  id: string;
  title: string;
  version: number;
  categories: Category[];
  vehicleId?: string;
};

type Vehicle = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Note = {
  id: string;
  author_name: string;
  value: string;
  created_at: string;
  vehicle_id: string | null;
};

const SECTION_ICONS = [CarIcon, WrenchIcon, CrossIcon, LockIcon];

export default function AppHomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [shiftNote, setShiftNote] = useState("");
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;

    // Fetch protocol
    const { data: protocolData } = await supabase
      .from("protocols")
      .select("*")
      .eq("team_id", profile.teamId)
      .single();

    if (!protocolData) {
      setLoading(false);
      return;
    }

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("protocol_id", protocolData.id)
      .order("position");

    const categories: Category[] = [];
    for (const cat of categoriesData ?? []) {
      const { data: itemsData } = await supabase
        .from("items")
        .select("*")
        .eq("category_id", cat.id)
        .is("parent_item_id", null)
        .order("position");

      const items: Item[] = [];
      for (const item of itemsData ?? []) {
        const { data: subData } = await supabase
          .from("items")
          .select("*")
          .eq("parent_item_id", item.id)
          .order("position");

        const subItems = (subData ?? [])
          .map((s: any) => ({
            id: s.id,
            title: s.title,
            is_completed: false,
            position: s.position,
            type: s.type,
            can_override: s.can_override,
            is_required: s.is_required,
            text_value: s.text_value ?? "",
            show_category_title: s.show_category_title ?? true,
            expiry_date: s.expiry_date ?? null,
            subItems: [],
          }))
          .sort((a: Item, b: Item) =>
            a.title.toLowerCase().localeCompare(b.title.toLowerCase())
          );

        items.push({
          id: item.id,
          title: item.title,
          is_completed: false,
          position: item.position,
          type: item.type,
          can_override: item.can_override,
          is_required: item.is_required,
          text_value: item.text_value ?? "",
          show_category_title: item.show_category_title ?? true,
          expiry_date: item.expiry_date ?? null,
          subItems,
        });
      }

      categories.push({
        id: cat.id,
        title: cat.title,
        position: cat.position,
        type: cat.type,
        is_required: cat.is_required,
        items,
      });
    }

    setProtocol({
      id: protocolData.id,
      title: protocolData.title,
      version: protocolData.version,
      categories,
    });

    // Fetch vehicles
    const { data: vehiclesData } = await supabase
      .from("vehicles")
      .select("*")
      .eq("team_id", profile.teamId);

    const vList: Vehicle[] = (vehiclesData ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      isDefault: v.is_default,
    }));
    vList.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0));
    setVehicles(vList);
    if (vList.length > 0) setSelectedVehicle(vList[0]);

    // Fetch notes
    const { data: notesData } = await supabase
      .from("notes")
      .select("*")
      .eq("team_id", profile.teamId)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false });

    setNotes(
      (notesData ?? []).map((n: any) => ({
        id: n.id,
        author_name: n.author_name,
        value: n.value,
        created_at: n.created_at,
        vehicle_id: n.vehicle_id,
      }))
    );

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (authLoading || !profile) return;
    loadData();
  }, [authLoading, profile, loadData]);

  // Filter categories (exclude 'text' type for section display)
  const visibleCategories = (protocol?.categories ?? []).filter(
    (c) => c.type !== "text"
  );

  const totalItems = visibleCategories.reduce(
    (sum, c) =>
      sum + c.items.reduce((s, i) => s + 1 + i.subItems.length, 0),
    0
  );
  const checkedItems = visibleCategories.reduce(
    (sum, c) =>
      sum +
      c.items.reduce(
        (s, i) =>
          s +
          (i.is_completed ? 1 : 0) +
          i.subItems.filter((si) => si.is_completed).length,
        0
      ),
    0
  );

  const vehicleNotes = notes.filter(
    (n) => !n.vehicle_id || n.vehicle_id === selectedVehicle?.id
  );

  function toggleItem(catIdx: number, itemIdx: number) {
    if (!protocol) return;
    const updated = { ...protocol };
    const cat = { ...updated.categories[catIdx] };
    const item = { ...cat.items[itemIdx] };
    item.is_completed = !item.is_completed;
    // If toggling parent, toggle all sub-items too
    if (item.subItems.length > 0) {
      item.subItems = item.subItems.map((si) => ({
        ...si,
        is_completed: item.is_completed,
      }));
    }
    cat.items = [...cat.items];
    cat.items[itemIdx] = item;
    updated.categories = [...updated.categories];
    updated.categories[catIdx] = cat;
    setProtocol(updated);
  }

  function toggleSubItem(catIdx: number, itemIdx: number, subIdx: number) {
    if (!protocol) return;
    const updated = { ...protocol };
    const cat = { ...updated.categories[catIdx] };
    const item = { ...cat.items[itemIdx] };
    const sub = { ...item.subItems[subIdx] };
    sub.is_completed = !sub.is_completed;
    item.subItems = [...item.subItems];
    item.subItems[subIdx] = sub;
    // Auto-complete parent if all subs checked
    item.is_completed = item.subItems.every((si) => si.is_completed);
    cat.items = [...cat.items];
    cat.items[itemIdx] = item;
    updated.categories = [...updated.categories];
    updated.categories[catIdx] = cat;
    setProtocol(updated);
  }

  function markAllOk(catIdx: number) {
    if (!protocol) return;
    const updated = { ...protocol };
    const cat = { ...updated.categories[catIdx] };
    cat.items = cat.items.map((item) => ({
      ...item,
      is_completed: true,
      subItems: item.subItems.map((si) => ({ ...si, is_completed: true })),
    }));
    updated.categories = [...updated.categories];
    updated.categories[catIdx] = cat;
    setProtocol(updated);
  }

  function toggleSection(idx: number) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function getCategoryProgress(cat: Category) {
    const total = cat.items.reduce((s, i) => s + 1 + i.subItems.length, 0);
    const checked = cat.items.reduce(
      (s, i) =>
        s +
        (i.is_completed ? 1 : 0) +
        i.subItems.filter((si) => si.is_completed).length,
      0
    );
    return { total, checked };
  }

  // Check if category is narcotics (position 3 = Betäubungsmittel)
  function isNarcotics(cat: Category) {
    return cat.title.toLowerCase().includes("betäubungsmittel");
  }

  async function handleSubmit() {
    if (!protocol || !user || !selectedVehicle || !profile) return;
    setSubmitting(true);
    setShowConfirm(false);

    try {
      const res = await fetch("/api/submit-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolId: protocol.id,
          userId: user.id,
          vehicleId: selectedVehicle.id,
          categories: protocol.categories,
          shiftNote,
          teamId: profile.teamId,
          authorName: profile.firstName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Submit error:", err);
        setSubmitting(false);
        return;
      }
    } catch (e) {
      console.error("Submit error:", e);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  function resetProtocol() {
    setSubmitted(false);
    setShiftNote("");
    setLoading(true);
    loadData();
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center px-6 py-20">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
        <span className="ml-2 text-text-muted">Lade Protokoll…</span>
      </div>
    );
  }

  if (submitted) {
    const unchecked = visibleCategories.flatMap((c) =>
      c.items
        .filter((i) => !i.is_completed)
        .map((i) => ({ title: i.title, category: c.title }))
    );
    return (
      <div className="px-6 py-10 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green/10">
          <CheckIcon className="h-8 w-8 text-green" />
        </div>
        <h1 className="mb-2 text-xl font-bold">Protokoll übermittelt</h1>
        <p className="mb-1 text-sm text-text-muted">
          {selectedVehicle?.name} — {new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="mb-6 font-mono text-sm">
          <span className="text-green">{checkedItems} geprüft</span>
          {totalItems - checkedItems > 0 && (
            <span className="text-red"> · {totalItems - checkedItems} offen</span>
          )}
        </p>
        {unchecked.length > 0 && (
          <div className="mb-6 rounded-lg border border-border p-4 text-left">
            <p className="mb-2 text-xs font-medium text-text-muted">Nicht geprüft:</p>
            {unchecked.map((u, i) => (
              <p key={i} className="text-sm text-red">
                {u.category} → {u.title}
              </p>
            ))}
          </div>
        )}
        <button
          onClick={resetProtocol}
          className="rounded-lg bg-red px-6 py-3 text-sm font-semibold text-white"
        >
          Neues Protokoll
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <span className="mb-2 inline-block rounded-lg bg-red px-2.5 py-1.5 font-mono text-xs font-bold text-white">
          NEF
        </span>
        <h1 className="text-lg font-bold">Schichtprotokoll</h1>
        <p className="text-xs text-text-muted">Fahrzeug-Übergabecheck</p>
      </div>

      {/* Vehicle Selector */}
      <div className="relative mb-6">
        <button
          onClick={() => setVehicleDropdownOpen(!vehicleDropdownOpen)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
        >
          <span>{selectedVehicle?.name ?? "Fahrzeug wählen"}</span>
          <ChevronDownIcon
            className={`h-4 w-4 text-text-muted transition-transform ${
              vehicleDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {vehicleDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVehicle(v);
                  setVehicleDropdownOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface2 ${
                  v.id === selectedVehicle?.id ? "text-red" : ""
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Open Notes */}
      {vehicleNotes.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber/20 bg-amber/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <StickyNoteIcon className="h-4 w-4 text-amber" />
            <span className="text-xs font-semibold text-amber">
              {vehicleNotes.length} offene Notiz{vehicleNotes.length > 1 ? "en" : ""}
            </span>
          </div>
          {vehicleNotes.map((n) => (
            <div key={n.id} className="mb-1 last:mb-0">
              <span className="text-xs text-text-muted">{n.author_name}: </span>
              <span className="text-xs">{n.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-text-muted">Fortschritt</span>
          <span className="font-mono">
            {checkedItems}/{totalItems}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${totalItems > 0 ? (checkedItems / totalItems) * 100 : 0}%`,
              backgroundColor:
                checkedItems === totalItems
                  ? "#22c55e"
                  : checkedItems > totalItems * 0.5
                    ? "#f59e0b"
                    : "#ef4444",
            }}
          />
        </div>
      </div>

      {/* Checklist Sections */}
      <div className="mb-6 space-y-3">
        {visibleCategories.map((cat, catIdx) => {
          const { total, checked } = getCategoryProgress(cat);
          const isOpen = openSections.has(catIdx);
          const Icon = SECTION_ICONS[catIdx % SECTION_ICONS.length];
          const isComplete = checked === total;
          const isNarc = isNarcotics(cat);

          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-lg border border-border"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(catIdx)}
                className="flex w-full items-center gap-3 bg-surface px-4 py-3"
              >
                <Icon
                  className={`h-4 w-4 ${
                    isComplete ? "text-green" : "text-text-muted"
                  }`}
                />
                <span className="flex-1 text-left text-sm font-medium">
                  {cat.title}
                </span>
                <span
                  className={`font-mono text-xs ${
                    isComplete ? "text-green" : "text-text-muted"
                  }`}
                >
                  {checked}/{total}
                </span>
                <ChevronDownIcon
                  className={`h-4 w-4 text-text-muted transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Section Content */}
              {isOpen && (
                <div className="border-t border-border">
                  {/* Alles OK button (not for narcotics) */}
                  {!isNarc && !isComplete && (
                    <button
                      onClick={() => markAllOk(catIdx)}
                      className="w-full border-b border-border bg-green/5 px-4 py-2 text-center text-xs font-semibold text-green transition-colors hover:bg-green/10"
                    >
                      Alles OK
                    </button>
                  )}
                  {isNarc && (
                    <div className="border-b border-border bg-amber/5 px-4 py-2 text-center text-xs font-medium text-amber">
                      Einzeln prüfen
                    </div>
                  )}

                  {/* Items */}
                  {cat.items.map((item, itemIdx) => (
                    <div key={item.id}>
                      {/* Parent item */}
                      {item.subItems.length === 0 ? (
                        <button
                          onClick={() => toggleItem(catIdx, itemIdx)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface2"
                        >
                          <span
                            className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border text-xs ${
                              item.is_completed
                                ? "border-green bg-green/15 text-green"
                                : "border-border"
                            }`}
                          >
                            {item.is_completed && "✓"}
                          </span>
                          <span
                            className={`text-sm ${
                              item.is_completed ? "text-text-muted" : ""
                            }`}
                          >
                            {item.title}
                          </span>
                        </button>
                      ) : (
                        <div>
                          <div className="flex items-center gap-3 bg-surface2 px-4 py-2">
                            <span
                              className={`text-xs font-medium ${
                                item.is_completed
                                  ? "text-green"
                                  : "text-text-muted"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="ml-auto font-mono text-[10px] text-text-muted">
                              {item.subItems.filter((s) => s.is_completed).length}/
                              {item.subItems.length}
                            </span>
                          </div>
                          {/* Sub-items */}
                          {item.subItems.map((sub, subIdx) => (
                            <button
                              key={sub.id}
                              onClick={() =>
                                toggleSubItem(catIdx, itemIdx, subIdx)
                              }
                              className="flex w-full items-center gap-3 py-2 pl-10 pr-4 text-left transition-colors hover:bg-surface2"
                            >
                              <span
                                className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border text-xs ${
                                  sub.is_completed
                                    ? "border-green bg-green/15 text-green"
                                    : "border-border"
                                }`}
                              >
                                {sub.is_completed && "✓"}
                              </span>
                              <span
                                className={`text-sm ${
                                  sub.is_completed ? "text-text-muted" : ""
                                }`}
                              >
                                {sub.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shift Notes */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-medium text-text-muted">
          Übergabe-Notizen (optional)
        </label>
        <textarea
          value={shiftNote}
          onChange={(e) => setShiftNote(e.target.value)}
          placeholder="Hinweise für die nächste Schicht…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={!selectedVehicle || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
      >
        <SendIcon className="h-4 w-4" />
        Protokoll absenden ({checkedItems}/{totalItems})
      </button>

      {/* Submitting Overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-bg/90">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-red" />
          <p className="text-sm font-medium">Protokoll wird gesendet…</p>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-bg p-6">
            <h2 className="mb-2 text-lg font-bold">Protokoll absenden?</h2>
            <p className="mb-1 text-sm text-text-muted">
              {selectedVehicle?.name}
            </p>
            <p className="mb-4 font-mono text-sm">
              <span className="text-green">{checkedItems} geprüft</span>
              {totalItems - checkedItems > 0 && (
                <span className="text-red">
                  {" "}· {totalItems - checkedItems} nicht geprüft
                </span>
              )}
            </p>
            {shiftNote.trim() && (
              <p className="mb-4 rounded-lg bg-surface p-3 text-xs text-text-muted">
                {shiftNote}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-red py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Sende…" : "Absenden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

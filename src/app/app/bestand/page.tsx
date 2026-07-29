"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { canSeeBestand } from "@/lib/featureFlags";
import {
  categoryTracksExpiry,
  expiryStatus,
  formatDate,
  relativeExpiry,
  type ExpiryStatus,
} from "@/lib/expiry";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

type Med = { id: string; title: string };
type Vehicle = { id: string; name: string; isDefault: boolean };
type EventRow = {
  expiry_date: string;
  reason: string | null;
  changed_by_name: string;
  changed_at: string;
};
// itemId -> latest expiry date for the selected vehicle
type ExpiryMap = Record<string, string>;

const REASONS = ["Verbraucht", "Abgelaufen", "Ergänzt"];

const STATUS_STRIPE: Record<ExpiryStatus, string> = {
  expired: "bg-red",
  soon: "bg-amber",
  ok: "bg-green",
  none: "bg-white/10",
};

export default function BestandPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [meds, setMeds] = useState<Med[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryMap>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheetMed, setSheetMed] = useState<Med | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Redirect anyone outside the rollout who navigates here directly.
  useEffect(() => {
    if (!authLoading && !canSeeBestand(user?.id)) router.replace("/app");
  }, [authLoading, user, router]);

  // Load medications (leaf items in expiry-tracking categories) + vehicles once.
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: protocol } = await supabase
        .from("protocols")
        .select("id")
        .eq("team_id", profile.teamId)
        .single();

      if (protocol) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, title")
          .eq("protocol_id", protocol.id);

        const trackedIds = (cats ?? [])
          .filter((c) => categoryTracksExpiry(c.title))
          .map((c) => c.id);

        if (trackedIds.length) {
          const { data: items } = await supabase
            .from("items")
            .select("id, title, parent_item_id")
            .in("category_id", trackedIds)
            .not("parent_item_id", "is", null); // leaf medications only

          setMeds(
            (items ?? [])
              .map((i) => ({ id: i.id, title: i.title }))
              .sort((a, b) => a.title.localeCompare(b.title, "de"))
          );
        }
      }

      const { data: vData } = await supabase
        .from("vehicles")
        .select("id, name, is_default")
        .eq("team_id", profile.teamId);

      const vList: Vehicle[] = (vData ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        isDefault: v.is_default,
      }));
      vList.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0));
      setVehicles(vList);
      setSelectedVehicle((cur) => cur ?? vList[0] ?? null);
      setLoading(false);
    })();
  }, [profile]);

  // Latest event per medication for the selected vehicle. Degrades to empty if
  // the item_expiry_events table doesn't exist yet (pre-migration). Re-runs on
  // vehicle change and after a save (reloadKey).
  useEffect(() => {
    if (!selectedVehicle) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("item_expiry_events")
        .select("item_id, expiry_date, changed_at")
        .eq("vehicle_id", selectedVehicle.id)
        .order("changed_at", { ascending: false });
      if (!active) return;
      const map: ExpiryMap = {};
      for (const e of data ?? []) {
        if (!(e.item_id in map)) map[e.item_id] = e.expiry_date;
      }
      setExpiry(map);
    })();
    return () => {
      active = false;
    };
  }, [selectedVehicle, reloadKey]);

  const counts = useMemo(() => {
    const c = { expired: 0, soon: 0, ok: 0, none: 0 };
    for (const m of meds) c[expiryStatus(expiry[m.id] ?? null)]++;
    return c;
  }, [meds, expiry]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? meds.filter((m) => m.title.toLowerCase().includes(q)) : meds;
  }, [meds, search]);

  const expired = useMemo(
    () =>
      filtered
        .filter((m) => expiryStatus(expiry[m.id] ?? null) === "expired")
        .sort((a, b) => (expiry[a.id] < expiry[b.id] ? -1 : 1)),
    [filtered, expiry]
  );

  if (authLoading || loading || !canSeeBestand(user?.id)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-text-muted border-t-red" />
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
        <h1 className="text-lg font-bold">Bestand</h1>
        <p className="text-xs text-text-muted">Haltbarkeit &amp; Austausch</p>
      </div>

      {/* Vehicle selector */}
      <div className="relative mb-4">
        <button
          onClick={() => setVehicleOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
        >
          <span>{selectedVehicle?.name ?? "Fahrzeug wählen"}</span>
          <ChevronDownIcon
            className={`h-4 w-4 text-text-muted transition-transform ${
              vehicleOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {vehicleOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVehicle(v);
                  setVehicleOpen(false);
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

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2.5">
        <SearchIcon className="h-4 w-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Medikament suchen…"
          className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {/* Tallies */}
      <div className="mb-6 grid grid-cols-4 gap-1.5">
        {(
          [
            ["expired", "abgelaufen", "text-red"],
            ["soon", "< 60 Tage", "text-amber"],
            ["ok", "gültig", "text-green"],
            ["none", "ohne MHD", "text-text-muted"],
          ] as const
        ).map(([key, label, color]) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface py-2"
          >
            <span className={`font-mono text-base font-bold tabular-nums ${color}`}>
              {counts[key]}
            </span>
            <span className="text-[8.5px] text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      {/* Expired first */}
      {expired.length > 0 && (
        <>
          <p className="mb-1.5 px-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
            Sofort tauschen
          </p>
          <div className="mb-5 space-y-1.5">
            {expired.map((m) => (
              <MedRow
                key={m.id}
                med={m}
                date={expiry[m.id] ?? null}
                onClick={() => setSheetMed(m)}
              />
            ))}
          </div>
        </>
      )}

      {/* All medications, A–Z */}
      <p className="mb-1.5 px-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
        Alle Medikamente · A–Z
      </p>
      <div className="space-y-1.5">
        {filtered.map((m) => (
          <MedRow
            key={m.id}
            med={m}
            date={expiry[m.id] ?? null}
            onClick={() => setSheetMed(m)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            Kein Medikament gefunden.
          </p>
        )}
      </div>

      {sheetMed && selectedVehicle && user && profile && (
        <EditSheet
          med={sheetMed}
          vehicle={selectedVehicle}
          currentDate={expiry[sheetMed.id] ?? null}
          authorId={user.id}
          authorName={profile.firstName}
          onClose={() => setSheetMed(null)}
          onSaved={() => {
            setSheetMed(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function MedRow({
  med,
  date,
  onClick,
}: {
  med: Med;
  date: string | null;
  onClick: () => void;
}) {
  const status = expiryStatus(date);
  return (
    <button
      onClick={onClick}
      className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg border border-border bg-surface py-2.5 pl-2.5 pr-3 text-left transition-colors hover:bg-surface2"
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${STATUS_STRIPE[status]}`} />
      <div className="min-w-0 flex-1 pl-1.5">
        <p className="truncate text-[13px] font-medium">{med.title}</p>
        {date ? (
          <p
            className={`font-mono text-[10px] tabular-nums ${
              status === "expired" ? "text-red" : "text-text-muted"
            }`}
          >
            {formatDate(date)} · {relativeExpiry(date)}
          </p>
        ) : (
          <p className="font-mono text-[10px] text-text-muted">Noch kein MHD erfasst</p>
        )}
      </div>
      <StatusPill status={status} />
    </button>
  );
}

function StatusPill({ status }: { status: ExpiryStatus }) {
  const map: Record<ExpiryStatus, [string, string]> = {
    expired: ["Abgelaufen", "bg-red/15 text-red"],
    soon: ["Bald", "bg-amber/15 text-amber"],
    ok: ["Gültig", "bg-green/15 text-green"],
    none: ["Eintragen", "bg-white/5 text-text-muted"],
  };
  const [label, cls] = map[status];
  return (
    <span className={`rounded px-1.5 py-1 text-[9.5px] font-bold ${cls}`}>{label}</span>
  );
}

function EditSheet({
  med,
  vehicle,
  currentDate,
  authorId,
  authorName,
  onClose,
  onSaved,
}: {
  med: Med;
  vehicle: Vehicle;
  currentDate: string | null;
  authorId: string;
  authorName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [history, setHistory] = useState<EventRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("item_expiry_events")
        .select("expiry_date, reason, changed_by_name, changed_at")
        .eq("item_id", med.id)
        .eq("vehicle_id", vehicle.id)
        .order("changed_at", { ascending: false });
      setHistory((data as EventRow[]) ?? []);
    })();
  }, [med.id, vehicle.id]);

  async function save() {
    if (!date) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("item_expiry_events").insert({
      item_id: med.id,
      vehicle_id: vehicle.id,
      expiry_date: date,
      reason,
      changed_by: authorId,
      changed_by_name: authorName,
    });
    if (error) {
      setError("Speichern fehlgeschlagen. Ist die Bestand-Migration ausgeführt?");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border border-border bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
              {vehicle.name} · Medikamente
            </p>
            <h2 className="mt-1 text-lg font-bold">{med.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Current state */}
        <div
          className={`mb-4 rounded-lg border p-3 text-xs ${
            currentDate
              ? "border-border bg-surface"
              : "border-red/20 bg-red/5"
          }`}
        >
          {currentDate ? (
            <>Bisheriges MHD <b>{formatDate(currentDate)}</b></>
          ) : (
            <>Kein MHD hinterlegt — wird als Ersteintrag protokolliert.</>
          )}
        </div>

        {/* Date */}
        <label className="mb-1.5 block text-[10.5px] text-text-muted">Neues MHD</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-1.5 w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm text-text focus:border-red focus:outline-none"
        />
        <p className="mb-4 text-[10px] leading-snug text-text-muted">
          Liegen mehrere Packungen im Fahrzeug: das Datum der Packung eintragen, die
          zuerst abläuft.
        </p>

        {/* Reason */}
        <label className="mb-1.5 block text-[10.5px] text-text-muted">
          Grund <span className="opacity-60">(optional)</span>
        </label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason((cur) => (cur === r ? null : r))}
              className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                reason === r
                  ? "border-red/40 bg-red/10 font-semibold text-red"
                  : "border-border bg-surface2 text-text-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Signer */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-[11px]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red/15 text-[10px] font-bold text-red">
            {authorName.charAt(0)}
          </span>
          <span>
            {authorName} <span className="text-text-muted">· wird protokolliert</span>
          </span>
        </div>

        {error && <p className="mb-3 text-xs text-red">{error}</p>}

        <button
          onClick={save}
          disabled={!date || saving}
          className="w-full rounded-lg bg-red py-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-40"
        >
          {saving ? "Speichern…" : "Austausch speichern"}
        </button>

        {/* History */}
        {history.length > 0 && (
          <>
            <p className="mb-2 mt-5 px-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
              Verlauf
            </p>
            <div className="ml-1 border-l border-border pl-3.5">
              {history.map((h, i) => (
                <div key={i} className="py-1.5">
                  <p className="font-mono text-[10px] tabular-nums text-text-muted">
                    {formatDate(h.changed_at.slice(0, 10))}
                  </p>
                  <p className="text-[11.5px]">
                    MHD {formatDate(h.expiry_date)}
                    {h.reason && ` · ${h.reason}`}
                  </p>
                  <p className="text-[10.5px] text-text-muted">{h.changed_by_name}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

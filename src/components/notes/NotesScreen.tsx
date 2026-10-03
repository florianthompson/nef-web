"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  applyDraft,
  clearDraft,
  isCurrentShift,
  loadMySubmissions,
  loadTeamProtocol,
  markCategoryOk,
  persistDraft,
  resetChecks,
  sectionsFromProtocol,
  SHIFT_WINDOW_MS,
  tally,
  toggleLeaf,
  uncheckedOf,
  type Protocol,
  type Submission,
  type Vehicle,
} from "@/lib/protocol";
import { shortAuthor } from "./format";
import { AvatarMenu } from "@/components/app/AvatarMenu";
import { Checklist } from "./Checklist";
import { Feed } from "./Feed";
import { HistoryDetail, HistoryList } from "./HistoryView";
import { ProtocolCard } from "./ProtocolCard";
import { SubmitSheet } from "./SubmitSheet";
import { Tour } from "./Tour";

export function NotesScreen() {
  const { user, profile, loading: authLoading } = useAuth();
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [shiftNote, setShiftNote] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"feed" | "check" | "history" | "detail">("feed");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openNotes, setOpenNotes] = useState(0);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [editingNew, setEditingNew] = useState(false);

  const teamId = profile?.teamId;

  const load = useCallback(async () => {
    if (!profile || !user) return;
    const [{ protocol: proto, vehicles: vlist }, subs] = await Promise.all([
      loadTeamProtocol(profile.teamId),
      loadMySubmissions(user.id),
    ]);
    if (proto) {
      const draft = applyDraft(proto, user.id);
      setShiftNote(draft.shiftNote);
      const picked = vlist.find((v) => v.id === draft.vehicleId) ?? vlist[0] ?? null;
      setVehicle(picked);
    } else {
      setVehicle(vlist[0] ?? null);
    }
    setProtocol(proto);
    setVehicles(vlist);
    setSubmissions(subs);
    setReady(true);
  }, [profile, user]);

  useEffect(() => {
    if (authLoading || !profile || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, profile, user, load]);

  useEffect(() => {
    if (!teamId) return;
    let live = true;
    supabase
      .from("notes")
      .select("item_id")
      .eq("team_id", teamId)
      .eq("is_resolved", false)
      .is("deleted_at", null)
      .then(({ data }) => {
        if (!live) return;
        const map: Record<string, number> = {};
        for (const row of (data ?? []) as { item_id: string | null }[]) {
          if (!row.item_id) continue;
          map[row.item_id] = (map[row.item_id] ?? 0) + 1;
        }
        setNoteCounts(map);
      });
    return () => {
      live = false;
    };
  }, [teamId, view, submitOpen]);

  const latest = submissions[0] ?? null;

  useEffect(() => {
    if (!latest) return;
    const at = new Date(latest.createdAt).getTime();
    if (Number.isNaN(at)) return;
    const left = at + SHIFT_WINDOW_MS - Date.now();
    if (left <= 0) return;
    const id = window.setTimeout(() => setNow(Date.now()), left);
    return () => window.clearTimeout(id);
  }, [latest]);

  const done = !!(latest && isCurrentShift(latest.createdAt, now));
  const checklistLocked = done && !editingNew;

  useEffect(() => {
    if (!protocol || !user || !ready || checklistLocked) return;
    persistDraft(user.id, protocol, vehicle?.id ?? null, shiftNote);
  }, [protocol, vehicle, shiftNote, user, ready, checklistLocked]);

  const progress = protocol ? tally(protocol) : { checked: 0, total: 0 };
  const sections = useMemo(() => {
    if (checklistLocked && latest) return latest.sections;
    return protocol ? sectionsFromProtocol(protocol) : [];
  }, [checklistLocked, latest, protocol]);

  const onStats = useCallback((stats: { open: number }) => setOpenNotes(stats.open), []);
  const consumeItem = useCallback(() => setOpenItemId(null), []);

  function startNewShift() {
    if (user) clearDraft(user.id);
    setProtocol((p) => (p ? resetChecks(p) : p));
    setShiftNote("");
    setEditingNew(true);
    setSubmitOpen(false);
    setView("check");
  }

  async function submit() {
    if (!protocol || !user || !profile || !vehicle || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolId: protocol.id,
          userId: user.id,
          vehicleId: vehicle.id,
          categories: protocol.categories,
          shiftNote,
          teamId: profile.teamId,
          authorName: profile.firstName,
        }),
      });
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitting(false);
      return;
    }
    clearDraft(user.id);
    setEditingNew(false);
    setNow(Date.now());
    setSubmitting(false);
    setSubmitOpen(false);
    setView("feed");
    const subs = await loadMySubmissions(user.id);
    setSubmissions(subs);
  }

  const card = (protocol || done) && (
    <ProtocolCard
      checked={done && latest ? latest.checked : progress.checked}
      total={done && latest ? latest.total : progress.total}
      submitted={
        done && latest
          ? {
              at: latest.createdAt,
              by: latest.author || shortAuthor(`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`),
            }
          : null
      }
      onOpen={() => setView("check")}
      onHistory={() => setView("history")}
      onNewShift={startNewShift}
    />
  );

  const detail = submissions.find((s) => s.id === detailId) ?? null;

  return (
    <div className="v19">
      <header className="fh">
        <h1>Notizen</h1>
        {vehicles.length > 0 && (
          <div className="veh-wrap">
            <button type="button" className="veh" onClick={() => vehicles.length > 1 && setVehicleOpen((v) => !v)}>
              {vehicle?.name ?? "Fahrzeug"}
            </button>
            {vehicleOpen && (
              <div className="veh-pop">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={v.id === vehicle?.id ? "on" : undefined}
                    onClick={() => {
                      setVehicle(v);
                      setVehicleOpen(false);
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button type="button" className="veh tbtn" aria-label="Tour starten" onClick={() => setTour(true)}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="8,5 19,12 8,19" />
          </svg>
          Tour starten
        </button>
        <AvatarMenu />
      </header>

      {card && <div className="protocol-pin">{card}</div>}

      <Feed openItemId={openItemId} onOpenItemConsumed={consumeItem} onStats={onStats} />

      {view === "check" && (
        <Checklist
          sections={sections}
          locked={checklistLocked}
          lockedBy={latest?.author}
          lockedAt={latest?.createdAt}
          noteCounts={noteCounts}
          onBack={() => setView("feed")}
          onToggle={(id) => {
            if (checklistLocked) return;
            setProtocol((p) => (p ? toggleLeaf(p, id) : p));
          }}
          onAllOk={(id) => {
            if (checklistLocked) return;
            setProtocol((p) => (p ? markCategoryOk(p, id) : p));
          }}
          onOpenItem={(id) => {
            setOpenItemId(id);
            setView("feed");
          }}
          onSubmit={() => setSubmitOpen(true)}
          onNewShift={startNewShift}
        />
      )}

      {view === "history" && (
        <HistoryList
          submissions={submissions}
          onBack={() => setView("feed")}
          onOpen={(id) => {
            setDetailId(id);
            setView("detail");
          }}
        />
      )}

      {view === "detail" && detail && (
        <HistoryDetail submission={detail} onBack={() => setView("history")} />
      )}

      {submitOpen && protocol && (
        <SubmitSheet
          checked={progress.checked}
          total={progress.total}
          unchecked={uncheckedOf(protocol)}
          openNotes={openNotes}
          busy={submitting}
          onClose={() => setSubmitOpen(false)}
          onConfirm={() => void submit()}
        />
      )}

      {tour && <Tour onClose={() => setTour(false)} />}
    </div>
  );
}

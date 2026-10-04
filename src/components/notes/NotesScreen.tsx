"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { legacyNoteVehicleId } from "@/lib/vehicleNotes.mjs";
import { createOverlayNav, makeOrigin, restoreTop } from "@/lib/overlayHistory.mjs";
import { shortAuthor } from "./format";
import { AvatarMenu } from "@/components/app/AvatarMenu";
import { Checklist } from "./Checklist";
import { Feed } from "./Feed";
import { HistoryDetail, HistoryList } from "./HistoryView";
import { ProtocolCard } from "./ProtocolCard";
import { SubmitSheet } from "./SubmitSheet";

const NO_COUNTS: Record<string, number> = {};

const CHECK_SCROLL = "#checklist .nv-b";

function checkScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(CHECK_SCROLL);
}

function anchorTopOf(id: string | null): number | null {
  const sc = checkScroller();
  const el = id ? sc?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`) : null;
  return sc && el ? el.getBoundingClientRect().top - sc.getBoundingClientRect().top : null;
}

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
  const [counts, setCounts] = useState<{ vehicleId: string | null; map: Record<string, number> } | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editingNew, setEditingNew] = useState(false);

  const teamId = profile?.teamId;

  const userId = user?.id;
  // legacy notes (no vehicle_id) show under this vehicle only, see legacyNoteVehicleId
  const legacyVehicleId = legacyNoteVehicleId(vehicles);
  // undefined until the vehicles are loaded, null when the team has none
  const feedVehicleId = ready ? (vehicle?.id ?? null) : undefined;
  const load = useCallback(async () => {
    if (!teamId || !userId) return;
    // Only the latest submission decides the shift state; the full history follows once the page is usable.
    const [{ protocol: proto, vehicles: vlist }, subs] = await Promise.all([
      loadTeamProtocol(teamId),
      loadMySubmissions(userId, 1),
    ]);
    if (proto) {
      const draft = applyDraft(proto, userId);
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
    void loadMySubmissions(userId).then(setSubmissions);
  }, [teamId, userId]);

  useEffect(() => {
    if (authLoading || !teamId || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, teamId, userId, load]);

  useEffect(() => {
    if (!teamId || feedVehicleId === undefined) return;
    let live = true;
    const q = supabase
      .from("notes")
      .select("item_id")
      .eq("team_id", teamId)
      .eq("is_resolved", false)
      .is("deleted_at", null);
    // the checklist counts belong to the selected vehicle, like the feed
    (feedVehicleId === null
      ? q
      : feedVehicleId === legacyVehicleId
        ? q.or(`vehicle_id.eq.${feedVehicleId},vehicle_id.is.null`)
        : q.eq("vehicle_id", feedVehicleId)
    ).then(({ data }) => {
      if (!live) return;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { item_id: string | null }[]) {
        if (!row.item_id) continue;
        map[row.item_id] = (map[row.item_id] ?? 0) + 1;
      }
      setCounts({ vehicleId: feedVehicleId, map });
    });
    return () => {
      live = false;
    };
  }, [teamId, view, submitOpen, feedVehicleId, legacyVehicleId]);

  // counts of another vehicle are never shown
  const noteCounts = counts && counts.vehicleId === feedVehicleId ? counts.map : NO_COUNTS;

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

  // Item or note opened from the Protokoll: the Protokoll stays mounted underneath, one shallow
  // history entry is pushed, and in-app back and browser/swipe back both end in popstate.
  const navRef = useRef<ReturnType<typeof createOverlayNav> | null>(null);
  useEffect(() => {
    const nav = createOverlayNav(window.history);
    navRef.current = nav;
    nav.sanitize();
    const onPop = () => {
      const from = nav.handlePopState();
      if (!from) return;
      setOpenItemId(null);
      // restore by anchor after layout (the Protokoll never unmounted, so this is normally a no-op)
      requestAnimationFrame(() => {
        const sc = checkScroller();
        if (!sc) return;
        const top = restoreTop(from, sc.scrollTop, anchorTopOf(from.anchorId));
        if (Math.abs(top - sc.scrollTop) > 1) sc.scrollTop = top;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      navRef.current = null;
    };
  }, []);
  const requestOverlayClose = useCallback(() => {
    if (!navRef.current?.requestClose()) setOpenItemId(null);
  }, []);
  const openFromCheck = useCallback((id: string) => {
    const sc = checkScroller();
    const anchor = anchorTopOf(id);
    navRef.current?.open(
      makeOrigin({ view: "check", scrollTop: sc?.scrollTop ?? 0, anchorId: anchor === null ? null : id, anchorOffset: anchor ?? 0 }),
    );
    setOpenItemId(id);
  }, []);

  // a vehicle switch closes the Feed overlay, so the history entry goes with it
  const vehicleKey = vehicle?.id;
  useEffect(() => {
    if (navRef.current?.isOpen) navRef.current.requestClose();
  }, [vehicleKey]);

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
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch("/api/submit-protocol", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
        },
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
        <AvatarMenu />
      </header>

      {card && <div className="protocol-pin">{card}</div>}

      <Feed
        vehicleId={feedVehicleId}
        legacyVehicleId={legacyVehicleId}
        openItemId={openItemId}
        onRequestClose={requestOverlayClose}
        onStats={onStats}
      />

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
          onOpenItem={openFromCheck}
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
    </div>
  );
}

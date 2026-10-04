"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  applyCheckedIds,
  clearDraft,
  collectChecked,
  isCurrentShift,
  loadMySubmissions,
  loadTeamProtocol,
  markCategoryOk,
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
import { loadDraft } from "@/lib/protocolDraft";
import { createDraftSync, draftKey } from "@/lib/draftSync.mjs";
import { checkedIdsOf } from "@/lib/draftModel.mjs";
import { createHttpTransport } from "@/lib/draftTransport.mjs";
import { createOverlayNav, makeOrigin, restoreTop } from "@/lib/overlayHistory.mjs";
import { shortAuthor } from "./format";
import { AvatarMenu } from "@/components/app/AvatarMenu";
import { Checklist } from "./Checklist";
import { Feed } from "./Feed";
import { HistoryDetail, HistoryList } from "./HistoryView";
import { ProtocolCard } from "./ProtocolCard";
import { SubmitSheet } from "./SubmitSheet";

const NO_COUNTS: Record<string, number> = {};

const vehiclePrefKey = (userId: string) => `nef:protocol-vehicle:${userId}`;

type ScrollAnchor = { anchorId: string | null; offset: number };

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
  const [openCats, setOpenCats] = useState<string[]>([]);
  const [restore, setRestore] = useState<{ anchorId: string | null; offset: number; nonce: number } | null>(null);
  // the draft key the protocol state currently belongs to; nothing is saved while it differs
  const [draftReady, setDraftReady] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollAnchor | null>(null);
  const [drafts] = useState(() => {
    if (typeof window === "undefined") return null;
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const mem = new Map<string, string>();
    return createDraftSync({
      storage: storage ?? {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
        key: (i: number) => [...mem.keys()][i] ?? null,
        get length() {
          return mem.size;
        },
      },
      transport: createHttpTransport({
        fetchImpl: (input: string, init?: RequestInit) => fetch(input, init),
        getToken: () => tokenRef.current,
      }),
    });
  });

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
      let pref: string | null = null;
      try {
        pref = localStorage.getItem(vehiclePrefKey(userId)) ?? loadDraft(userId, proto.id)?.vehicleId ?? null;
      } catch {
        pref = null;
      }
      const picked = vlist.find((v) => v.id === pref) ?? vlist[0] ?? null;
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

  const protocolId = protocol?.id;
  const draftCtx = useMemo(
    () => (userId && vehicle?.id && protocolId ? { userId, vehicleId: vehicle.id, protocolId } : null),
    [userId, vehicle?.id, protocolId],
  );
  const curKey = draftCtx ? draftKey(draftCtx.userId, draftCtx.vehicleId, draftCtx.protocolId) : null;

  // keep the access token where a keepalive request on pagehide can read it without awaiting
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      tokenRef.current = session?.access_token ?? null;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // pagehide / visibilitychange hidden flush, online / focus sync
  useEffect(() => {
    if (!drafts || !userId) return;
    const detach = drafts.attachLifecycle(window, document, userId);
    drafts.syncAll(userId);
    return detach;
  }, [drafts, userId]);

  // Open and vehicle switch: merge server draft and local queue, then restore checks, shift note,
  // open categories, step and scroll. Everything below only saves once this finished for the key.
  useEffect(() => {
    if (!drafts || !draftCtx || !ready || checklistLocked) return;
    let live = true;
    setDraftReady(null);
    setProtocol((p) => (p ? resetChecks(p) : p));
    const ctx = draftCtx;
    void (async () => {
      let legacy = null;
      try {
        legacy = loadDraft(ctx.userId, ctx.protocolId);
      } catch {
        legacy = null;
      }
      if (legacy && drafts.migrateLegacy(ctx, legacy)) clearDraft(ctx.userId);
      const d = await drafts.resume(ctx);
      if (!live) return;
      setProtocol((p) => (p ? applyCheckedIds(p, checkedIdsOf(d)) : p));
      setShiftNote(d.shiftNote?.value ?? "");
      setOpenCats(d.openCats?.value ?? []);
      scrollRef.current = d.scroll?.value ?? null;
      if (d.step?.value === "check") {
        setView((v) => (v === "feed" ? "check" : v));
        if (d.scroll) setRestore({ ...d.scroll.value, nonce: Date.now() });
      }
      setDraftReady(draftKey(ctx.userId, ctx.vehicleId, ctx.protocolId));
    })();
    return () => {
      live = false;
    };
  }, [drafts, draftCtx, ready, checklistLocked]);

  useEffect(() => {
    if (!user) return;
    try {
      if (vehicle?.id) localStorage.setItem(vehiclePrefKey(user.id), vehicle.id);
    } catch {
      // best effort
    }
  }, [user, vehicle?.id]);

  const snapshotRef = useRef<{
    checkedIds: string[];
    shiftNote: string;
    step: string | null;
    openCats: string[];
  } | null>(null);
  useEffect(() => {
    if (!drafts || !draftCtx || !protocol || checklistLocked || draftReady !== curKey) return;
    const snap = {
      checkedIds: collectChecked(protocol),
      shiftNote,
      step: view === "check" ? "check" : null,
      openCats,
    };
    snapshotRef.current = snap;
    drafts.update(draftCtx, { ...snap, scroll: scrollRef.current });
  }, [drafts, draftCtx, curKey, draftReady, protocol, shiftNote, view, openCats, checklistLocked]);

  const onScrollAnchor = useCallback(
    (a: ScrollAnchor) => {
      scrollRef.current = a;
      if (drafts && draftCtx && snapshotRef.current && draftReady === curKey) drafts.update(draftCtx, { ...snapshotRef.current, scroll: a });
    },
    [drafts, draftCtx, curKey, draftReady],
  );

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

  async function startNewShift() {
    if (user) clearDraft(user.id);
    // the old draft must be gone before the resume effect looks at the server again
    if (drafts && draftCtx) await drafts.clear(draftCtx);
    setOpenCats([]);
    scrollRef.current = null;
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
    // successful submit only: the server draft and this vehicle's local queue go, a failed submit returned above
    if (drafts && draftCtx) void drafts.clear(draftCtx);
    // the Protokoll starts empty, so the next autosave snapshot is blank and writes nothing
    setProtocol((p) => (p ? resetChecks(p) : p));
    setShiftNote("");
    setOpenCats([]);
    scrollRef.current = null;
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
      onNewShift={() => void startNewShift()}
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
          onNewShift={() => void startNewShift()}
          open={openCats}
          onOpenChange={setOpenCats}
          onScrollAnchor={onScrollAnchor}
          restore={restore}
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

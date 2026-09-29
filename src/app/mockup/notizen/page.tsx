"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheckIcon } from "lucide-react";
import { ME, VEHICLES } from "../_data";
import { dayKey, dayLabel, isOpenTask, sortTasks } from "../_lib";
import { InfoBubble, TaskCard } from "../_components/NoteCards";
import { useMock } from "../_components/MockStore";

const FILTERS = [
  { key: "alle", label: "Alle" },
  { key: "offen", label: "Offene Aufgaben" },
] as const;

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
    on ? "border-red/40 bg-red/15 text-red" : "border-border bg-surface text-text-muted"
  }`;

function Feed() {
  const router = useRouter();
  const params = useSearchParams();
  const { notes, comments } = useMock();
  const vehicle = params.get("vehicle");
  const filter = vehicle ? "vehicle" : (params.get("filter") ?? "alle");

  const visible = useMemo(() => {
    let list = notes.filter((n) => n.status !== "dismissed");
    if (filter === "offen") list = sortTasks(list.filter(isOpenTask));
    else if (filter === "mir") list = sortTasks(list.filter((n) => isOpenTask(n) && n.assigneeId === ME));
    else if (filter === "kritisch") list = list.filter((n) => n.priority === "critical");
    else if (filter === "vehicle") list = list.filter((n) => n.vehicleId === vehicle);
    if (filter === "alle" || filter === "kritisch" || filter === "vehicle") {
      list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return list;
  }, [notes, filter, vehicle]);

  const chatView = filter === "alle" || filter === "kritisch" || filter === "vehicle";

  // Chat view: newest at the bottom, scrolled to the end.
  useEffect(() => {
    if (!chatView) return;
    const el = document.getElementById("mock-scroll");
    el?.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  }, [chatView, filter, vehicle, visible.length]);

  const go = (qs: string) => router.push(`/mockup/notizen${qs}`);
  const open = (id: string) => router.push(`/mockup/notizen/${id}`);
  const onVehicle = (id: string) => go(`?vehicle=${id}`);

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-sm">
        <h1 className="px-4 pb-3 pt-2 text-lg font-bold">Notizen</h1>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => go(f.key === "alle" ? "" : `?filter=${f.key}`)} className={chip(filter === f.key)}>
              {f.label}
            </button>
          ))}
          {VEHICLES.map((v) => (
            <button key={v.id} onClick={() => go(`?vehicle=${v.id}`)} className={chip(vehicle === v.id)}>
              {v.name}
            </button>
          ))}
          <button onClick={() => go("?filter=mir")} className={chip(filter === "mir")}>
            Mir zugewiesen
          </button>
          <button onClick={() => go("?filter=kritisch")} className={chip(filter === "kritisch")}>
            Kritisch
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-24 pt-4">
        {visible.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center text-text-muted">
            <ClipboardCheckIcon className="mb-2 h-8 w-8" />
            <p className="text-sm">Keine Notizen für diesen Filter.</p>
          </div>
        )}
        {visible.map((n, i) => {
          const sep = chatView && (i === 0 || dayKey(n.createdAt) !== dayKey(visible[i - 1].createdAt));
          const props = { note: n, comments, onOpen: () => open(n.id), onVehicle };
          return (
            <div key={n.id} className="space-y-3">
              {sep && (
                <div className="flex justify-center pt-2">
                  <span className="rounded-full bg-surface2 px-3 py-0.5 text-[11px] font-medium text-text-muted">
                    {dayLabel(n.createdAt)}
                  </span>
                </div>
              )}
              {n.kind === "task" ? <TaskCard {...props} /> : <InfoBubble {...props} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NotizenPage() {
  return (
    <Suspense fallback={null}>
      <Feed />
    </Suspense>
  );
}

"use client";

import { useLayoutEffect, useRef } from "react";
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, StickyNoteIcon } from "lucide-react";
import type { CheckSection } from "@/lib/protocol";
import { hm } from "./format";

export function Checklist({
  sections,
  locked,
  lockedBy,
  lockedAt,
  noteCounts,
  onBack,
  onToggle,
  onAllOk,
  onOpenItem,
  onSubmit,
  onNewShift,
  open: openCats,
  onOpenChange,
  onScrollAnchor,
  restore,
}: {
  sections: CheckSection[];
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  noteCounts: Record<string, number>;
  onBack: () => void;
  onToggle: (id: string) => void;
  onAllOk: (sectionId: string) => void;
  onOpenItem: (id: string) => void;
  onSubmit: () => void;
  onNewShift: () => void;
  /** open category ids, owned by the parent so they survive leaving the Protokoll and are saved with the draft */
  open: string[];
  onOpenChange: (next: string[]) => void;
  /** topmost visible item and its offset in the scroll container (raw scrollTop when none), throttled */
  onScrollAnchor?: (a: { anchorId: string | null; offset: number }) => void;
  /** scroll position to restore (draft resume), applied after layout; nonce makes repeats fire */
  restore?: { anchorId: string | null; offset: number; nonce: number } | null;
}) {
  const open = new Set(openCats);
  const bodyRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  function anchorOf(): { anchorId: string | null; offset: number } {
    const sc = bodyRef.current;
    if (!sc) return { anchorId: null, offset: 0 };
    const top = sc.getBoundingClientRect().top;
    for (const el of sc.querySelectorAll<HTMLElement>("[data-item-id]")) {
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 1) return { anchorId: el.dataset.itemId ?? null, offset: Math.round(r.top - top) };
    }
    return { anchorId: null, offset: Math.round(sc.scrollTop) };
  }

  function onScroll() {
    if (!onScrollAnchor || raf.current) return;
    raf.current = window.setTimeout(() => {
      raf.current = 0;
      onScrollAnchor(anchorOf());
    }, 250);
  }

  const restoreNonce = restore?.nonce;
  useLayoutEffect(() => {
    if (!restore) return;
    const apply = () => {
      const sc = bodyRef.current;
      if (!sc) return;
      const el = restore.anchorId ? sc.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(restore.anchorId)}"]`) : null;
      if (el) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - restore.offset;
      else sc.scrollTop = restore.offset;
    };
    apply();
    const id = requestAnimationFrame(apply); // again after fonts and layout settle
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreNonce]);

  const total = sections.reduce((s, c) => s + c.rows.length, 0);
  const checked = sections.reduce((s, c) => s + c.rows.filter((r) => r.done).length, 0);
  const pct = total > 0 ? (checked / total) * 100 : 0;

  return (
    <div className="nv show" id="checklist">
      <div className="nv-h">
        <button type="button" className="back" aria-label="Zurück" onClick={onBack}>
          <ChevronLeftIcon className="ic" style={{ width: 22, height: 22 }} />
        </button>
        <h1>Schichtprotokoll</h1>
      </div>
      <div className="nv-b" ref={bodyRef} onScroll={onScroll}>
        {locked && (
          <div className="banner">
            <CheckIcon className="ic" />
            <span>
              Abgeschlossen
              {lockedBy ? ` · ${lockedBy}` : ""}
              {lockedAt ? ` · ${hm(new Date(lockedAt))}` : ""}
            </span>
            <button type="button" className="bn-new" onClick={onNewShift}>
              Neues Protokoll
            </button>
          </div>
        )}
        <div className="ov">
          <div className="r1">
            <span>Fortschritt</span>
            <span className="mono">
              {checked}/{total}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
        {sections.map((cat) => {
          const n = cat.rows.filter((r) => r.done).length;
          const opn = open.has(cat.id);
          let lastGroup: string | null = null;
          return (
            <div key={cat.id} className={`sec${opn ? " open" : ""}`}>
              <button
                type="button"
                className="sec-h"
                onClick={() =>
                  onOpenChange(opn ? openCats.filter((x) => x !== cat.id) : [...openCats, cat.id])
                }
              >
                <span className="n">{cat.title}</span>
                <span className="c">
                  {n}/{cat.rows.length}
                </span>
                <ChevronDownIcon className="chev" />
              </button>
              {opn && (
                <div className="sec-b">
                  {!cat.noAllOk && !locked && n < cat.rows.length && (
                    <div className="allok">
                      <button
                        type="button"
                        className="btn btn-s"
                        onClick={() => onAllOk(cat.id)}
                      >
                        Alles OK
                      </button>
                    </div>
                  )}
                  {cat.rows.map((row) => {
                    const showGroup = row.group && row.group !== lastGroup;
                    lastGroup = row.group;
                    const cnt = noteCounts[row.id] ?? 0;
                    return (
                      <div key={row.id}>
                        {showGroup && <div className="lbl">{row.group}</div>}
                        <div data-item-id={row.id} className={`it${row.done ? " on" : ""}${cnt ? " has" : ""}`}>
                          <button
                            type="button"
                            className="cb"
                            aria-label="Abhaken"
                            disabled={locked}
                            onClick={() => onToggle(row.id)}
                          >
                            <span>
                              <CheckIcon className="ic" />
                            </span>
                          </button>
                          <div
                            className="row-m tap"
                            onClick={() => onOpenItem(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onOpenItem(row.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="tx">
                              <span className="nm">{row.name}</span>
                              {row.sub && <span className="sub">{row.sub}</span>}
                            </div>
                            {cnt > 0 && (
                              <button
                                type="button"
                                className="nb"
                                aria-label={`${cnt} offene ${cnt === 1 ? "Notiz" : "Notizen"}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenItem(row.id);
                                }}
                              >
                                <StickyNoteIcon className="ic" />
                                {cnt}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="sbar">
          <button type="button" className="btn btn-p" onClick={onSubmit}>
            Protokoll abschließen
          </button>
        </div>
      )}
    </div>
  );
}

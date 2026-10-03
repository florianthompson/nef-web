"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

export function SubmitSheet({
  checked,
  total,
  unchecked,
  openNotes,
  busy,
  onClose,
  onConfirm,
}: {
  checked: number;
  total: number;
  unchecked: { category: string; title: string }[];
  openNotes: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const missing = unchecked.length;
  const groups: { category: string; titles: string[] }[] = [];
  for (const row of unchecked) {
    const last = groups[groups.length - 1];
    if (last && last.category === row.category) last.titles.push(row.title);
    else groups.push({ category: row.category, titles: [row.title] });
  }

  return (
    <>
      <button type="button" className="bd z2 show" aria-label="Schließen" onClick={onClose} />
      <div className="sheet z2 show" role="dialog" aria-label="Protokoll abschließen">
        <div className="grab" />
        <div className="sh-h">
          <div className="tx">
            <h2>Protokoll abschließen?</h2>
          </div>
        </div>
        <div className="sh-b">
          <div className="sm">
            <div className="sm-r c-ok">
              <span>
                <span className="mono">
                  {checked}/{total}
                </span>{" "}
                abgehakt
              </span>
            </div>
            {missing > 0 ? (
              <button
                type="button"
                className="sm-r c-miss"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <span>
                  <span className="mono">{missing}</span> fehlt
                </span>
                <ChevronDownIcon className="chev" />
              </button>
            ) : (
              <div className="sm-r c-miss">
                <span>
                  <span className="mono">0</span> fehlt
                </span>
              </div>
            )}
            {open &&
              groups.map((g) => (
                <div key={g.category} className="ug">
                  <div className="ugh">{g.category}</div>
                  {g.titles.map((t) => (
                    <div key={t} className="ugi">
                      {t}
                    </div>
                  ))}
                </div>
              ))}
            <div className="sm-r">
              <span>
                <span className="mono">{openNotes}</span>{" "}
                {openNotes === 1 ? "offene Notiz" : "offene Notizen"}
              </span>
            </div>
          </div>
          <p className="hint">Nicht abgehakte Einträge werden mit gespeichert.</p>
        </div>
        <div className="sh-f">
          <button type="button" className="btn btn-p" disabled={busy} onClick={onConfirm}>
            {busy ? "Sende…" : "Abschließen"}
          </button>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Zurück
          </button>
        </div>
      </div>
    </>
  );
}

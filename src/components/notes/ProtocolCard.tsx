"use client";

import { CheckIcon } from "lucide-react";
import { dm, hm } from "./format";

export function ProtocolCard({
  checked,
  total,
  submitted,
  onOpen,
  onHistory,
  onNewShift,
}: {
  checked: number;
  total: number;
  submitted: { at: string; by: string } | null;
  onOpen: () => void;
  onHistory: () => void;
  onNewShift: () => void;
}) {
  if (submitted) {
    const sd = new Date(submitted.at);
    const when = `${dm(sd)} ${hm(sd)}`;
    return (
      <div className="pcard done pin">
        <div className="pc-body" onClick={onOpen}>
          <CheckIcon className="ic" />
          <div>
            <b>Bereits abgeschlossen</b>
            <span>
              {when}
              {submitted.by ? ` · ${submitted.by}` : ""}
            </span>
            <em>
              <button
                type="button"
                className="pc-lnk"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewShift();
                }}
              >
                Neues Protokoll
              </button>
            </em>
          </div>
        </div>
        <button type="button" className="pc-vl" onClick={onHistory}>
          Verlauf
        </button>
      </div>
    );
  }

  const pct = total > 0 ? (checked / total) * 100 : 0;
  return (
    <div className="pcard pin">
      <div className="l">
        <div className="r1">
          <span>Schichtprotokoll</span>
          <span className="mono">
            {checked}/{total}
          </span>
        </div>
        <div className="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <button type="button" className="pc-vl" onClick={onHistory}>
          Verlauf
        </button>
      </div>
      <button type="button" className="btn btn-s btn-sm" onClick={onOpen}>
        Protokoll ausfüllen
      </button>
    </div>
  );
}

"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Submission } from "@/lib/protocol";
import { dm, hm } from "./format";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function HistoryList({
  submissions,
  onBack,
  onOpen,
}: {
  submissions: Submission[];
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="nv show" id="history">
      <div className="nv-h">
        <button type="button" className="back" aria-label="Zurück" onClick={onBack}>
          <ChevronLeftIcon className="ic" style={{ width: 22, height: 22 }} />
        </button>
        <h1>Verlauf</h1>
      </div>
      <div className="nv-b">
        {submissions.length === 0 ? (
          <div className="is-empty">Noch keine Protokolle</div>
        ) : (
          <div className="sm">
            {submissions.map((s) => {
              const d = new Date(s.createdAt);
              const shift = `${dm(d)} Tag`;
              return (
                <button key={s.id} type="button" className="hr" onClick={() => onOpen(s.id)}>
                  <div className="hm">
                    <div className="hl">
                      <b>{shift}</b>
                      <span className="mono">
                        {s.checked}/{s.total} · {s.missing} offen
                      </span>
                    </div>
                    <div className="hl s">
                      <span>
                        {firstName(s.author)} · {dm(d)} {hm(d)}
                      </span>
                    </div>
                  </div>
                  <ChevronRightIcon className="ic" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoryDetail({
  submission,
  onBack,
}: {
  submission: Submission;
  onBack: () => void;
}) {
  const d = new Date(submission.createdAt);
  const groups: { category: string; titles: string[] }[] = [];
  for (const row of submission.unchecked) {
    const last = groups[groups.length - 1];
    if (last && last.category === row.category) last.titles.push(row.title);
    else groups.push({ category: row.category, titles: [row.title] });
  }
  return (
    <div className="nv show" id="history-detail">
      <div className="nv-h">
        <button type="button" className="back" aria-label="Zurück" onClick={onBack}>
          <ChevronLeftIcon className="ic" style={{ width: 22, height: 22 }} />
        </button>
        <h1>{dm(d)} Tag</h1>
      </div>
      <div className="nv-b">
        <p className="hd-m">
          {firstName(submission.author)} · {dm(d)} {hm(d)}
          {submission.vehicleName ? ` · ${submission.vehicleName}` : ""}
        </p>
        <div className="sm">
          <div className="sm-r c-ok">
            <span>
              <span className="mono">
                {submission.checked}/{submission.total}
              </span>{" "}
              abgehakt
            </span>
          </div>
          <div className="sm-r c-miss">
            <span>
              <span className="mono">{submission.missing}</span> fehlt
            </span>
          </div>
        </div>
        {submission.missing > 0 && (
          <>
            <div className="hd-l">Nicht abgehakt</div>
            <div className="sm">
              {groups.map((g) => (
                <div key={g.category} className="ug">
                  <div className="ugh">{g.category}</div>
                  {g.titles.map((t) => (
                    <div key={t} className="ugi">
                      {t}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

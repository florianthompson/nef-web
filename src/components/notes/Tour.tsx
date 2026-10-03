"use client";

import { useEffect, useState } from "react";

const STEPS: { n: number; title: string; body: string; target: string }[] = [
  {
    n: 1,
    title: "Willkommen!",
    body: "Neu: Notizen sind jetzt die Hauptansicht, das Protokoll machst du einmal pro Schicht.",
    target: "pcard",
  },
  {
    n: 2,
    title: "Ein Feld für alles",
    body: "Schreib oder sprich einfach, was passiert ist.",
    target: "composer",
  },
  {
    n: 3,
    title: "Einfach sprechen",
    body: "Tippe aufs Mikrofon und sprich. Die Aufnahme läuft direkt im Eingabefeld. Danach steht der erkannte Text im Feld: prüfen, bei Bedarf ändern, mit dem Pfeil senden.",
    target: "mic",
  },
  {
    n: 4,
    title: "Du bestätigst nur",
    body: "Wir teilen das Gesagte in einzelne Notizen und ordnen sie dem Material zu. Das Ergebnis erscheint direkt über dem Eingabefeld, die Liste bleibt sichtbar. Du prüfst und wählst: Senden, Ohne Zuordnung senden oder die Zuordnung antippen.",
    target: "composer",
  },
  {
    n: 5,
    title: "Nach Bereich filtern",
    body: "Medikamente, BTM, Fahrzeug, Ausrüstung, und alles andere landet unter Sonstiges.",
    target: "chips",
  },
  {
    n: 6,
    title: "Antworten und erledigen",
    body: "Tippe auf eine Notiz. Im Eintrag siehst du alle Antworten, kannst selbst antworten und die Notiz als erledigt markieren.",
    target: "chips",
  },
  {
    n: 7,
    title: "Protokoll abschließen",
    body: "Am Ende der Schicht schließt du das Protokoll ab. Nicht Abgehaktes wird mit gespeichert.",
    target: "protocol-open",
  },
  {
    n: 8,
    title: "Fertig!",
    body: "Probier es jetzt selbst aus.",
    target: "",
  },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="tour" role="presentation">
      <div className="t-block" onClick={onClose} />
      <div className="t-tip on" role="dialog" aria-live="polite" style={{ transform: "translate(16px, 96px)" }}>
        <div className="t-top">
          <span className="t-count">
            {step.n}/{STEPS.length}
          </span>
          {!last && (
            <button type="button" className="t-end" onClick={onClose}>
              Beenden
            </button>
          )}
        </div>
        <h3 className="t-title">{step.title}</h3>
        <p className="t-body">{step.body}</p>
        <div className="t-btns">
          <button
            type="button"
            className="t-back"
            style={{ visibility: i === 0 ? "hidden" : "visible" }}
            onClick={() => (last ? onClose() : setI((n) => Math.max(0, n - 1)))}
          >
            {last ? "Schließen" : "Zurück"}
          </button>
          <button
            type="button"
            className="t-next"
            onClick={() => (last ? onClose() : setI((n) => Math.min(STEPS.length - 1, n + 1)))}
          >
            {last ? "Fertig" : "Weiter"}
          </button>
        </div>
      </div>
      <span className="t-probe" data-step={step.target} hidden />
    </div>
  );
}

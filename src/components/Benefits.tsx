const benefits = [
  {
    icon: "\ud83d\udccb",
    bg: "rgba(239,68,68,0.1)",
    title: "Vollständige Checkliste",
    desc: "Alle 91 Prüfpositionen aus dem NEF-Protokoll — Fahrzeug, Ausrüstung, 68 Medikamente und Betäubungsmittel. Nichts wird vergessen.",
  },
  {
    icon: "\ud83d\udcdd",
    bg: "rgba(245,158,11,0.1)",
    title: "Schichtnotizen & Übergabe",
    desc: "Offene Mängel werden der nächsten Schicht angezeigt. Jede Crew sieht sofort, was noch aussteht — mit Bestätigungsfunktion.",
  },
  {
    icon: "\ud83c\udfe2",
    bg: "rgba(139,92,246,0.1)",
    title: "Leitstelle-Zuweisung",
    desc: "Aufgaben die Disposition, Beschaffung oder Werkstatt erfordern, werden direkt an die Leitstelle weitergeleitet — mit Tracking.",
  },
  {
    icon: "\ud83d\ude97",
    bg: "rgba(34,197,94,0.1)",
    title: "Fahrzeug-Zuordnung",
    desc: "Jedes Protokoll wird einem Fahrzeug zugeordnet. Mehrere NEF? Kein Problem — jedes Fahrzeug hat seinen eigenen Status und Historie.",
  },
  {
    icon: "\u26a1",
    bg: "rgba(59,130,246,0.1)",
    title: "Schnelle Erfassung",
    desc: "\u201EAlle ausw\u00E4hlen\u201C pro Kategorie, klare Fortschrittsanzeige und optimiert f\u00FCr den Einsatz auf dem Smartphone \u2014 auch mit Handschuhen.",
  },
  {
    icon: "\ud83d\udd12",
    bg: "rgba(236,72,153,0.1)",
    title: "BTM-Dokumentation",
    desc: "Betäubungsmittel werden separat erfasst — ohne Sammel-Check. Fentanyl, Morphin und Piritramid einzeln verifiziert und dokumentiert.",
  },
];

export default function Benefits() {
  return (
    <section className="max-w-[1100px] mx-auto px-10 py-20 max-md:px-5 max-md:py-[60px]">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-red mb-4 text-center">
        Warum NEF Protokoll
      </div>
      <h2 className="text-[clamp(28px,4vw,42px)] font-extrabold tracking-tight text-white text-center mb-16">
        Schluss mit Papierprotokollen
        <br />
        und vergessenen Checks
      </h2>
      <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
        {benefits.map((b) => (
          <div
            key={b.title}
            className="bg-surface border border-border rounded-[18px] px-7 py-8 transition-all duration-300 hover:border-[rgba(255,255,255,0.12)] hover:-translate-y-1"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] mb-5"
              style={{ background: b.bg }}
            >
              {b.icon}
            </div>
            <h3 className="text-[17px] font-bold text-white mb-2 tracking-tight">
              {b.title}
            </h3>
            <p className="text-sm leading-relaxed text-text-muted font-medium">
              {b.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

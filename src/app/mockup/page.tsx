import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

const SCREENS = [
  { href: "/mockup/notizen", title: "Team-Feed", sub: "Chat-Ansicht aller Notizen" },
  { href: "/mockup/notizen?filter=offen", title: "Offene Aufgaben", sub: "Sortiert: kritisch, überfällig, fällig" },
  { href: "/mockup/notizen?vehicle=v1", title: "Feed nach Fahrzeug", sub: "RK Gmund 76/1" },
  { href: "/mockup/notizen?filter=mir", title: "Mir zugewiesen", sub: "Filter im Feed" },
  { href: "/mockup/notizen?filter=kritisch", title: "Kritisch", sub: "Filter im Feed" },
  { href: "/mockup/notizen?sheet=neu", title: "Notiz hinzufügen", sub: "Bottom-Sheet, Info/Aufgabe" },
  { href: "/mockup/notizen?sheet=material", title: "Material markieren", sub: "Sheet mit Item-Picker und 2 Positionen" },
  { href: "/mockup/notizen/n5", title: "Notiz-Detail: Aufgabe mit Verlauf", sub: "Kritisch, Foto, Kommentare" },
  { href: "/mockup/notizen/n3", title: "Notiz-Detail: kritisch + überfällig", sub: "Reifen hinten links" },
  { href: "/mockup/notizen/n2", title: "Notiz-Detail: Info", sub: "Adrenalin aufgefüllt" },
  { href: "/mockup/protokoll", title: "Protokoll", sub: "Notizen-Block und markierte Positionen" },
  { href: "/mockup/protokoll?demo=ready", title: "Protokoll: fertig ausgefüllt", sub: "Kritische bestätigt, alles geprüft" },
  { href: "/mockup/protokoll?demo=confirm", title: "Protokoll: Abschluss-Dialog", sub: "Inkl. „Aufgabe erledigen?“" },
];

export default function MockupIndex() {
  return (
    <div className="px-4 py-6">
      <div className="mb-6 text-center">
        <span className="mb-2 inline-block rounded-lg bg-red px-2.5 py-1.5 font-mono text-xs font-bold text-white">NEF</span>
        <h1 className="text-lg font-bold">Protokoll-Notizen</h1>
        <p className="text-xs text-text-muted">UI-Mockup – Beispieldaten, nichts wird gespeichert</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 last:border-b-0 hover:bg-surface2"
          >
            <span className="flex-1">
              <span className="block text-sm font-medium">{s.title}</span>
              <span className="block text-xs text-text-muted">{s.sub}</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 text-text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// UI-Mockup: static example data. Nothing here talks to a backend.

export type NoteKind = "info" | "task";
export type NoteStatus = "posted" | "open" | "in_progress" | "done" | "dismissed";
export type NotePriority = "normal" | "critical";
export type ItemReason = "used" | "missing" | "damaged" | "restocked";

export type NoteItem = { itemId: string; reason: ItemReason; quantity?: number };

export type NoteEventType =
  | "started"
  | "completed"
  | "reopened"
  | "dismissed"
  | "to_task"
  | "assigned";

export type NoteEvent = {
  id: string;
  type: NoteEventType;
  by: string; // team member id
  at: string; // ISO
  text?: string; // assignee name / reason
};

export type Note = {
  id: string;
  kind: NoteKind;
  status: NoteStatus;
  priority: NotePriority;
  body: string;
  authorId: string;
  vehicleId: string | null;
  createdAt: string;
  dueAt: string | null;
  assigneeId: string | null;
  photo: boolean;
  items: NoteItem[];
  events: NoteEvent[];
};

export type Comment = {
  id: string;
  noteId: string;
  authorId: string;
  body: string;
  createdAt: string;
  photo?: boolean;
};

export type Vehicle = { id: string; name: string };
export type TeamMember = { id: string; firstName: string; lastName: string };

export type ChecklistItem = { id: string; title: string; subItems?: ChecklistItem[] };
export type ChecklistCategory = {
  id: string;
  title: string;
  narcotics?: boolean;
  items: ChecklistItem[];
};

export const ME = "flo";

export const TEAM: TeamMember[] = [
  { id: "flo", firstName: "Florian", lastName: "Thompson" },
  { id: "max", firstName: "Max", lastName: "Huber" },
  { id: "anna", firstName: "Anna", lastName: "Keller" },
  { id: "jonas", firstName: "Jonas", lastName: "Weber" },
  { id: "lena", firstName: "Lena", lastName: "Brandt" },
];

export const VEHICLES: Vehicle[] = [
  { id: "v1", name: "RK Gmund 76/1" },
  { id: "v2", name: "RK Gmund 83/1" },
  { id: "v3", name: "RK Tegernsee 76/2" },
];
export const DEFAULT_VEHICLE = "v1";

export const CHECKLIST: ChecklistCategory[] = [
  {
    id: "c-o2",
    title: "Sauerstoff",
    items: [
      { id: "o2-10", title: "O2-Flasche 10 L" },
      { id: "o2-2", title: "O2-Flasche 2 L" },
      { id: "o2-maske", title: "Maske Erwachsene" },
    ],
  },
  {
    id: "c-atem",
    title: "Atemwege",
    items: [
      { id: "absaug", title: "Absaugpumpe" },
      { id: "beutel", title: "Beatmungsbeutel" },
      { id: "larynx", title: "Larynxtubus Gr. 4" },
    ],
  },
  {
    id: "c-med",
    title: "Medikamente",
    items: [
      {
        id: "ampull",
        title: "Notfallampullarium",
        subItems: [
          { id: "adrenalin", title: "Adrenalin 1mg" },
          { id: "amiodaron", title: "Amiodaron 150mg" },
          { id: "midazolam", title: "Midazolam 5mg" },
          { id: "glukose", title: "Glukose 40%" },
        ],
      },
    ],
  },
  {
    id: "c-btm",
    title: "Betäubungsmittel",
    narcotics: true,
    items: [
      { id: "morphin", title: "Morphin 10mg" },
      { id: "fentanyl", title: "Fentanyl 0,1mg" },
    ],
  },
  {
    id: "c-kfz",
    title: "Fahrzeug",
    items: [
      { id: "reifen", title: "Reifen / Profil" },
      { id: "blaulicht", title: "Blaulicht / Horn" },
      { id: "tank", title: "Tankfüllstand" },
    ],
  },
  {
    id: "c-defi",
    title: "Defibrillator",
    items: [
      { id: "corpuls", title: "Corpuls" },
      { id: "elektroden", title: "Elektroden" },
    ],
  },
];

// ---- Time helpers for seeding (relative to module load) -------------------

const NOW = new Date();
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const dayAt = (dayOffset: number, h: number, m = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const H = 60;
const D = 24 * 60;
// "Heute 18:00" unless that's (nearly) over already, so "due today" styling always works
const dueToday = NOW.getHours() < 17 ? dayAt(0, 18) : dayAt(0, 23, 30);

function note(n: Partial<Note> & Pick<Note, "id" | "kind" | "body" | "authorId" | "createdAt">): Note {
  return {
    status: n.kind === "info" ? "posted" : "open",
    priority: "normal",
    vehicleId: null,
    dueAt: null,
    assigneeId: null,
    photo: false,
    items: [],
    events: [],
    ...n,
  };
}

export const SEED_NOTES: Note[] = [
  note({
    id: "n13",
    kind: "info",
    priority: "critical",
    authorId: "jonas",
    body: "Achtung: Der Code vom BtM-Schrank wurde geändert. Neuer Code hängt beim Wachleiter.",
    createdAt: ago(4 * D + 3 * H),
  }),
  note({
    id: "n11",
    kind: "info",
    authorId: "lena",
    vehicleId: "v3",
    body: "Kratzer an der Seitentür beim Rangieren, siehe Foto. Schaden ist gemeldet.",
    photo: true,
    createdAt: ago(2 * D + 5 * H),
  }),
  note({
    id: "n8",
    kind: "task",
    status: "done",
    authorId: "jonas",
    vehicleId: "v3",
    body: "Larynxtubus Gr. 4 fehlt im Atemwegsrucksack",
    items: [{ itemId: "larynx", reason: "missing" }],
    createdAt: ago(2 * D + 2 * H),
    events: [{ id: "e8", type: "completed", by: "anna", at: ago(D + 4 * H) }],
  }),
  note({
    id: "n3",
    kind: "task",
    priority: "critical",
    authorId: "max",
    vehicleId: "v1",
    body: "Reifen hinten links abgefahren, Profil unter 2 mm. Bitte vor der nächsten Fahrt tauschen lassen.",
    items: [{ itemId: "reifen", reason: "damaged" }],
    dueAt: dayAt(-2, 12),
    createdAt: ago(3 * D + 2 * H),
  }),
  note({
    id: "n10",
    kind: "task",
    authorId: "anna",
    body: "Neue Desinfektionsmittel-Richtlinie lesen und im Team-Ordner abzeichnen",
    dueAt: dayAt(3, 12),
    createdAt: ago(D + 9 * H),
  }),
  note({
    id: "n12",
    kind: "info",
    authorId: "flo",
    vehicleId: "v1",
    body: "Funkgerät-Akku ist neu geladen, Ersatzakku liegt im Seitenfach.",
    createdAt: ago(D + 2 * H),
  }),
  note({
    id: "n7",
    kind: "task",
    status: "in_progress",
    authorId: "lena",
    vehicleId: "v2",
    body: "Blaulicht vorne rechts flackert",
    items: [{ itemId: "blaulicht", reason: "damaged" }],
    assigneeId: "max",
    createdAt: ago(26 * H),
    events: [{ id: "e7", type: "started", by: "max", at: ago(24 * H) }],
  }),
  note({
    id: "n9",
    kind: "task",
    authorId: "max",
    vehicleId: "v2",
    body: "Verbandkasten-Prüfung für RK Gmund 83/1 bis morgen erledigen",
    assigneeId: "flo",
    dueAt: dayAt(1, 12),
    createdAt: ago(21 * H),
  }),
  note({
    id: "n5",
    kind: "task",
    priority: "critical",
    authorId: "jonas",
    vehicleId: "v1",
    body: "Absaugpumpe defekt, Akku lädt nicht. Handpumpe liegt als Ersatz im Rucksack.",
    items: [{ itemId: "absaug", reason: "damaged" }],
    photo: true,
    createdAt: ago(20 * H),
  }),
  note({
    id: "n4",
    kind: "task",
    authorId: "lena",
    vehicleId: "v1",
    body: "Sauerstoff nachbestellen, nur noch eine 2-L-Flasche voll",
    items: [{ itemId: "o2-2", reason: "missing" }],
    dueAt: dueToday,
    createdAt: ago(5 * H),
  }),
  note({
    id: "n6",
    kind: "task",
    authorId: "anna",
    vehicleId: "v1",
    body: "2× Adrenalin bei Reanimation verbraucht, Nachschub aus der Apotheke holen",
    items: [{ itemId: "adrenalin", reason: "used", quantity: 2 }],
    createdAt: ago(4 * H),
  }),
  note({
    id: "n2",
    kind: "info",
    authorId: "anna",
    vehicleId: "v1",
    body: "Adrenalin 1mg verbraucht, aus Lager aufgefüllt",
    items: [{ itemId: "adrenalin", reason: "restocked" }],
    createdAt: ago(150),
  }),
  note({
    id: "n1",
    kind: "info",
    authorId: "max",
    vehicleId: "v1",
    body: "Fahrzeug steht ab 14 Uhr in der Werkstatt",
    createdAt: ago(35),
  }),
  note({
    id: "n14",
    kind: "info",
    status: "dismissed",
    authorId: "jonas",
    vehicleId: "v2",
    body: "Test-Notiz bitte ignorieren",
    createdAt: ago(3 * D),
    events: [{ id: "e14", type: "dismissed", by: "jonas", at: ago(3 * D - 5), text: "Versehentlich gepostet" }],
  }),
];

export const SEED_COMMENTS: Comment[] = [
  { id: "c1", noteId: "n3", authorId: "anna", body: "Hab's vorhin auch gesehen, Profil ist quasi weg.", createdAt: ago(2 * D + 20 * H) },
  { id: "c2", noteId: "n3", authorId: "flo", body: "Werkstatt hat frühestens Donnerstag einen Termin. Fahren wir bis dahin?", createdAt: ago(D + 8 * H) },
  { id: "c3", noteId: "n5", authorId: "max", body: "Akku lädt an der Ladestation auch nicht, also kein Kabelproblem.", createdAt: ago(18 * H) },
  { id: "c4", noteId: "n5", authorId: "jonas", body: "Foto vom Akkufach hängt an. Ich frag morgen den Hersteller.", createdAt: ago(17 * H), photo: true },
  { id: "c5", noteId: "n5", authorId: "flo", body: "Ersatzgerät kommt aus Tegernsee, ich melde mich.", createdAt: ago(6 * H) },
  { id: "c6", noteId: "n4", authorId: "max", body: "Bestellung ist raus, Lieferung Donnerstag.", createdAt: ago(3 * H) },
  { id: "c7", noteId: "n7", authorId: "max", body: "Vorderes Leuchtmittel getauscht, morgen Funktionstest.", createdAt: ago(23 * H) },
  { id: "c8", noteId: "n10", authorId: "lena", body: "Ist gelesen, bin schon eingetragen.", createdAt: ago(7 * H) },
];

// Last submitted protocol per vehicle (drives "Seit der letzten Übergabe" + info flags)
export const SEED_LAST_HANDOVER: Record<string, string> = {
  v1: ago(20 * H),
  v2: ago(30 * H),
  v3: ago(2 * D + 20 * H),
};

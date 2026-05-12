export type DemoSubItem = {
  id: string;
  title: string;
  is_completed: boolean;
  expiryDate: string | null;
};

export type DemoItem = {
  id: string;
  title: string;
  is_completed: boolean;
  subItems: DemoSubItem[];
};

export type DemoCategory = {
  id: string;
  title: string;
  type: "standard" | "narcotics";
  items: DemoItem[];
};

export type DemoVehicle = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type DemoNoteComment = {
  id: string;
  authorName: string;
  value: string;
};

export type DemoNote = {
  id: string;
  authorName: string;
  value: string;
  createdAt: string;
  vehicleId: string;
  comments: DemoNoteComment[];
};

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const inDays = (d: number) =>
  new Date(Date.now() + d * 86400000).toISOString().split("T")[0];

export const DEMO_VEHICLES: DemoVehicle[] = [
  { id: "v1", name: "NEF 1-83-1", isDefault: true },
  { id: "v2", name: "NEF 1-83-2", isDefault: false },
];

export const DEMO_CATEGORIES: DemoCategory[] = [
  {
    id: "cat-1",
    title: "Fahrerraum",
    type: "standard",
    items: [
      { id: "i-1", title: "Tankfüllung > 75 %", is_completed: false, subItems: [] },
      { id: "i-2", title: "Innenraum sauber & desinfiziert", is_completed: false, subItems: [] },
      { id: "i-3", title: "Funkgerät funktionsfähig", is_completed: false, subItems: [] },
      { id: "i-4", title: "Beleuchtung & Blaulicht geprüft", is_completed: false, subItems: [] },
    ],
  },
  {
    id: "cat-2",
    title: "Notfallausrüstung",
    type: "standard",
    items: [
      {
        id: "i-5",
        title: "Defibrillator",
        is_completed: false,
        subItems: [
          { id: "si-1", title: "Pads vorhanden", is_completed: false, expiryDate: inDays(120) },
          { id: "si-2", title: "Akku geladen", is_completed: false, expiryDate: null },
          { id: "si-3", title: "Selbsttest erfolgreich", is_completed: false, expiryDate: null },
        ],
      },
      { id: "i-6", title: "Beatmungsbeutel", is_completed: false, subItems: [] },
      { id: "i-7", title: "Sauerstoffflasche > 100 bar", is_completed: false, subItems: [] },
      { id: "i-8", title: "Absauggerät", is_completed: false, subItems: [] },
    ],
  },
  {
    id: "cat-3",
    title: "Medikamente",
    type: "standard",
    items: [
      {
        id: "i-9",
        title: "Notfallmedikamente",
        is_completed: false,
        subItems: [
          { id: "si-4", title: "Adrenalin 1:1000", is_completed: false, expiryDate: inDays(220) },
          { id: "si-5", title: "Atropin 0,5 mg", is_completed: false, expiryDate: inDays(15) },
          { id: "si-6", title: "Glukose 40 %", is_completed: false, expiryDate: inDays(400) },
          { id: "si-7", title: "Midazolam 5 mg", is_completed: false, expiryDate: inDays(180) },
        ],
      },
    ],
  },
  {
    id: "cat-4",
    title: "Betäubungsmittel",
    type: "narcotics",
    items: [
      { id: "i-10", title: "Fentanyl 0,5 mg", is_completed: false, subItems: [] },
      { id: "i-11", title: "Morphin 10 mg", is_completed: false, subItems: [] },
      { id: "i-12", title: "Ketamin S 25 mg", is_completed: false, subItems: [] },
    ],
  },
];

export const DEMO_NOTES: DemoNote[] = [
  {
    id: "n-1",
    authorName: "Anna Weber",
    value: "Verbandsschere klein fehlt seit gestern — bitte nachbestellen.",
    createdAt: hoursAgo(20),
    vehicleId: "v1",
    comments: [
      { id: "c-1", authorName: "Zentrale", value: "Ist bestellt, Lieferung morgen." },
    ],
  },
  {
    id: "n-2",
    authorName: "Jonas Becker",
    value: "Tankdeckel klemmt manchmal beim Öffnen.",
    createdAt: hoursAgo(48),
    vehicleId: "v1",
    comments: [],
  },
];

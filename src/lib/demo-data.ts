export type DemoItem = {
  id: string;
  title: string;
  is_completed: boolean;
  parent_item_id: string | null;
};

export type DemoCategory = {
  id: string;
  title: string;
  items: DemoItem[];
};

export type DemoProtocol = {
  id: string;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  vehicle_name: string;
  categories: DemoCategory[];
};

export type DemoNote = {
  id: string;
  author_name: string;
  value: string;
  created_at: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  vehicle_name: string | null;
  delegated: boolean;
};

const now = new Date();
const hoursAgo = (h: number) =>
  new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

export const DEMO_USER = {
  firstName: "Max",
  lastName: "Müller",
} as const;

export const DEMO_PROTOCOL: DemoProtocol = {
  id: "demo-protocol",
  created_at: hoursAgo(3),
  user_first_name: DEMO_USER.firstName,
  user_last_name: DEMO_USER.lastName,
  vehicle_name: "NEF 1-83-1",
  categories: [
    {
      id: "cat-1",
      title: "Fahrerraum",
      items: [
        { id: "i-1", title: "Tankfüllung > 75%", is_completed: true, parent_item_id: null },
        { id: "i-2", title: "Innenraum sauber & desinfiziert", is_completed: false, parent_item_id: null },
        { id: "i-3", title: "Funkgerät funktionsfähig", is_completed: true, parent_item_id: null },
      ],
    },
    {
      id: "cat-2",
      title: "Notfallausrüstung",
      items: [
        { id: "i-4", title: "Defibrillator", is_completed: true, parent_item_id: null },
        { id: "i-5", title: "Pads vorhanden", is_completed: true, parent_item_id: "i-4" },
        { id: "i-6", title: "Akku geladen", is_completed: false, parent_item_id: "i-4" },
        { id: "i-7", title: "Beatmungsbeutel", is_completed: true, parent_item_id: null },
        { id: "i-8", title: "Sauerstoffflasche > 100 bar", is_completed: true, parent_item_id: null },
        { id: "i-9", title: "Absauggerät", is_completed: true, parent_item_id: null },
      ],
    },
    {
      id: "cat-3",
      title: "Medikamente",
      items: [
        { id: "i-10", title: "Adrenalin 1:1000", is_completed: true, parent_item_id: null },
        { id: "i-11", title: "Atropin 0,5 mg", is_completed: true, parent_item_id: null },
        { id: "i-12", title: "Glukose 40%", is_completed: false, parent_item_id: null },
        { id: "i-13", title: "Midazolam", is_completed: true, parent_item_id: null },
      ],
    },
    {
      id: "cat-4",
      title: "Verbandsmaterial",
      items: [
        { id: "i-14", title: "Verbandspäckchen klein", is_completed: true, parent_item_id: null },
        { id: "i-15", title: "Verbandspäckchen groß", is_completed: true, parent_item_id: null },
        { id: "i-16", title: "Rettungsdecke", is_completed: true, parent_item_id: null },
      ],
    },
  ],
};

export const DEMO_NOTES: DemoNote[] = [
  {
    id: "n-1",
    author_name: "Max Müller",
    value: "Akku Defibrillator nur noch bei 30 %. Ersatz aus Reserve eingelegt.",
    created_at: hoursAgo(3),
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    deleted_by: null,
    deleted_at: null,
    vehicle_name: "NEF 1-83-1",
    delegated: false,
  },
  {
    id: "n-2",
    author_name: "Anna Weber",
    value: "Verbandsschere klein fehlt seit gestern. Bitte nachbestellen.",
    created_at: hoursAgo(20),
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    deleted_by: null,
    deleted_at: null,
    vehicle_name: "NEF 1-83-1",
    delegated: true,
  },
  {
    id: "n-3",
    author_name: "Jonas Becker",
    value: "Tankdeckel klemmte beim Tanken — gangbar gemacht.",
    created_at: hoursAgo(48),
    is_resolved: true,
    resolved_by: "Jonas Becker",
    resolved_at: hoursAgo(46),
    deleted_by: null,
    deleted_at: null,
    vehicle_name: "NEF 1-83-1",
    delegated: false,
  },
  {
    id: "n-4",
    author_name: "Lisa Schmidt",
    value: "Funkgerät 2 zeitweise stumm. Werkstatt informiert.",
    created_at: hoursAgo(72),
    is_resolved: true,
    resolved_by: "Zentrale",
    resolved_at: hoursAgo(50),
    deleted_by: null,
    deleted_at: null,
    vehicle_name: "NEF 1-83-1",
    delegated: false,
  },
];

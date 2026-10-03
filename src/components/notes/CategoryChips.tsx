"use client";

export type CategoryFilter =
  | "Alle"
  | "Termine"
  | "Medikamente"
  | "BTM"
  | "Fahrzeug"
  | "Ausrüstung"
  | "Sonstiges";

export const CATEGORY_FILTERS: CategoryFilter[] = [
  "Alle",
  "Termine",
  "Medikamente",
  "BTM",
  "Fahrzeug",
  "Ausrüstung",
  "Sonstiges",
];

export function CategoryChips({
  value,
  onChange,
  counts,
}: {
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
  counts: Record<CategoryFilter, number>;
}) {
  const shown = CATEGORY_FILTERS.filter((c) => c === "Alle" || counts[c] > 0);
  return (
    <div className="chips" data-tour="chips">
      {shown.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            className={`cf${on ? " on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(c)}
          >
            <span>
              {c}
              <b>{counts[c]}</b>
            </span>
          </button>
        );
      })}
    </div>
  );
}

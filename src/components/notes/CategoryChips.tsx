"use client";

export type CategoryFilter = "Alle" | "Medikamente" | "BTM" | "Fahrzeug" | "Ausrüstung" | "Sonstiges";
export const CATEGORY_FILTERS: CategoryFilter[] = [
  "Alle",
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
  return (
    <div className="flex overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CATEGORY_FILTERS.filter((c) => c === "Alle" || counts[c] > 0 || c === value).map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(c)}
            className="flex h-11 shrink-0 items-center px-1"
          >
            <span
              className={`inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium whitespace-nowrap ${
                on
                  ? "border-zinc-50 bg-zinc-50 text-zinc-950"
                  : "border-border bg-surface text-zinc-300"
              }`}
            >
              {c}
              <b className={`font-mono text-[13px] font-medium ${on ? "text-zinc-600" : "text-zinc-400"}`}>
                {counts[c]}
              </b>
            </span>
          </button>
        );
      })}
    </div>
  );
}

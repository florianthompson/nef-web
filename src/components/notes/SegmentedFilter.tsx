"use client";

export type Segment = "open" | "done";

export function SegmentedFilter({
  value,
  onChange,
  counts,
}: {
  value: Segment;
  onChange: (v: Segment) => void;
  counts: Record<Segment, number>;
}) {
  const opts: { k: Segment; label: string }[] = [
    { k: "open", label: "Offen" },
    { k: "done", label: "Erledigt" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Notizen filtern"
      className="mx-4 flex h-11 rounded-lg bg-zinc-900 p-0.5"
    >
      {opts.map((o) => {
        const on = value === o.k;
        return (
          <button
            key={o.k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.k)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
              on ? "bg-zinc-700 text-zinc-50" : "text-zinc-400"
            }`}
          >
            {o.label}
            <span className="font-mono text-xs text-zinc-400">{counts[o.k]}</span>
          </button>
        );
      })}
    </div>
  );
}

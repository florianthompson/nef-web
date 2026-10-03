"use client";

export type Segment = "open" | "done";

export function SegmentedFilter({
  value,
  onChange,
  inset,
}: {
  value: Segment;
  onChange: (v: Segment) => void;
  inset?: boolean;
}) {
  const opts: { k: Segment; label: string }[] = [
    { k: "open", label: "Offen" },
    { k: "done", label: "Erledigt" },
  ];
  return (
    <div className={`segw${inset ? " is" : ""}`}>
      <div className="seg" role="group" aria-label="Notizen">
        {opts.map((o) => {
          const on = value === o.k;
          return (
            <button
              key={o.k}
              type="button"
              className={`sg${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => onChange(o.k)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

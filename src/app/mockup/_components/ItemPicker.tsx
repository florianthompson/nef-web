"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CHECKLIST, type ItemReason, type NoteItem } from "../_data";
import { REASONS, itemTitle, reasonLabel } from "../_lib";

export function ItemPicker({
  open,
  onOpenChange,
  selected,
  onChange,
  defaultReason,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: NoteItem[];
  onChange: (items: NoteItem[]) => void;
  defaultReason: ItemReason;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const has = (id: string) => selected.some((s) => s.itemId === id);

  function toggle(id: string) {
    onChange(has(id) ? selected.filter((s) => s.itemId !== id) : [...selected, { itemId: id, reason: defaultReason }]);
  }
  const patch = (id: string, p: Partial<NoteItem>) =>
    onChange(selected.map((s) => (s.itemId === id ? { ...s, ...p } : s)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[90dvh] max-w-lg gap-0 rounded-t-2xl border-border bg-bg p-0"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <SheetTitle className="text-base font-bold">Material markieren</SheetTitle>
          <button onClick={() => onOpenChange(false)} aria-label="Schließen" className="text-text-muted">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="relative mb-3">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Position suchen…"
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
            />
          </div>

          {selected.length > 0 && (
            <div className="mb-4 space-y-2">
              {selected.map((s) => (
                <div key={s.itemId} className="rounded-lg border border-red/20 bg-red/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{itemTitle(s.itemId)}</span>
                    <button onClick={() => toggle(s.itemId)} aria-label="Entfernen" className="text-text-muted">
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => patch(s.itemId, { reason: r })}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          s.reason === r ? "border-red bg-red text-white" : "border-border text-text-muted"
                        }`}
                      >
                        {reasonLabel(r)}
                      </button>
                    ))}
                    <div className="ml-auto flex items-center gap-1.5 font-mono text-xs">
                      <span className="mr-1 font-sans text-[11px] text-text-muted">Menge</span>
                      <button
                        onClick={() => patch(s.itemId, { quantity: s.quantity && s.quantity > 1 ? s.quantity - 1 : undefined })}
                        aria-label="Weniger"
                        className="flex h-6 w-6 items-center justify-center rounded border border-border"
                      >
                        <MinusIcon className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center">{s.quantity ? `${s.quantity}×` : "–"}</span>
                      <button
                        onClick={() => patch(s.itemId, { quantity: (s.quantity ?? 0) + 1 })}
                        aria-label="Mehr"
                        className="flex h-6 w-6 items-center justify-center rounded border border-border"
                      >
                        <PlusIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {CHECKLIST.map((cat) => {
              const rows = cat.items.flatMap((it) => {
                const subs = it.subItems ?? [];
                const match = (t: string) => !q || t.toLowerCase().includes(q);
                const visibleSubs = subs.filter((s) => match(s.title) || match(it.title));
                if (subs.length === 0) return match(it.title) ? [{ item: it, indent: false, parent: false }] : [];
                if (visibleSubs.length === 0) return [];
                return [
                  { item: it, indent: false, parent: true },
                  ...visibleSubs.map((s) => ({ item: s, indent: true, parent: false })),
                ];
              });
              if (rows.length === 0) return null;
              return (
                <div key={cat.id} className="overflow-hidden rounded-lg border border-border">
                  <div className="bg-surface px-4 py-2 text-xs font-semibold text-text-muted">{cat.title}</div>
                  {rows.map(({ item, indent, parent }) =>
                    parent ? (
                      <div key={item.id} className="bg-surface2 px-4 py-1.5 text-xs font-medium text-text-muted">
                        {item.title}
                      </div>
                    ) : (
                      <button
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        className={`flex w-full items-center gap-3 py-2.5 pr-4 text-left transition-colors hover:bg-surface2 ${
                          indent ? "pl-10" : "pl-4"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                            has(item.id) ? "border-red bg-red/15 text-red" : "border-border"
                          }`}
                        >
                          {has(item.id) && "✓"}
                        </span>
                        <span className="text-sm">{item.title}</span>
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-text-muted">
            Markierte Positionen werden im nächsten Protokoll für dieses Fahrzeug hervorgehoben.
          </p>
        </div>

        <div className="border-t border-border p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-lg bg-red py-3 text-sm font-semibold text-white"
          >
            Fertig{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

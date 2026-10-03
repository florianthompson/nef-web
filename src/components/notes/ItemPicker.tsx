"use client";

import { useMemo, useState } from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import type { ItemOption, NoteCategory } from "@/lib/notes";
import { BottomSheet } from "./BottomSheet";

const nrm = (s: string) =>
  s.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");

export type Pick = { itemId: string | null; category: NoteCategory };

function Row({
  label,
  sub,
  on,
  onSelect,
}: {
  label: string;
  sub?: string | null;
  on: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex min-h-[52px] w-full items-center gap-3 border-t border-border px-4 py-1.5 text-left first:border-t-0 active:bg-surface"
    >
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[17px] font-normal">{label}</b>
        {sub && <small className="block truncate text-[13px] text-text-muted">{sub}</small>}
      </span>
      {on && <CheckIcon className="h-[18px] w-[18px] shrink-0" />}
    </button>
  );
}

function Head({ children }: { children: string }) {
  return <div className="px-4 pt-4 pb-1 text-[13px] font-medium text-zinc-500">{children}</div>;
}

export function ItemPicker({
  open,
  items,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  items: ItemOption[];
  current: Pick;
  onPick: (p: Pick) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const nq = nrm(q).trim();

  const sections = useMemo(() => {
    const hit = (s: string) => !nq || nrm(s).includes(nq);
    const order: NoteCategory[] = ["BTM", "Medikamente", "Fahrzeug", "Ausrüstung"];
    return order
      .map((cat) => {
        const catHit = nq.length >= 3 && nrm(cat).includes(nq);
        return {
          cat,
          general: hit(`${cat} allgemein`),
          rows: items.filter(
            (i) => i.category === cat && (catHit || hit(`${i.title} ${i.parentTitle ?? ""}`))
          ),
        };
      })
      .filter((s) => s.general || s.rows.length);
  }, [items, nq]);

  const none = !nq || nrm("sonstiges allgemein keine zuordnung").includes(nq);
  const select = (p: Pick) => {
    onPick(p);
    setQ("");
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setQ("");
        onClose();
      }}
      title="Zuordnung wählen"
      tall
      z={60}
    >
      <div className="mx-4 mb-2 flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-zinc-500">
        <SearchIcon className="h-4 w-4 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suchen …"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-zinc-500"
        />
      </div>
      {none && (
        <>
          <Head>Sonstiges</Head>
          <Row
            label="Sonstiges"
            sub="Keine Zuordnung"
            on={!current.itemId && current.category === "Sonstiges"}
            onSelect={() => select({ itemId: null, category: "Sonstiges" })}
          />
        </>
      )}
      {sections.map((s) => (
        <div key={s.cat}>
          <Head>{s.cat}</Head>
          {s.general && (
            <Row
              label={`${s.cat} allgemein`}
              sub="Ohne bestimmten Eintrag"
              on={!current.itemId && current.category === s.cat}
              onSelect={() => select({ itemId: null, category: s.cat })}
            />
          )}
          {s.rows.map((i) => (
            <Row
              key={i.id}
              label={i.title}
              sub={i.parentTitle}
              on={current.itemId === i.id}
              onSelect={() => select({ itemId: i.id, category: i.category })}
            />
          ))}
        </div>
      ))}
      {!none && !sections.length && <Head>Nichts gefunden</Head>}
      <div className="h-4" />
    </BottomSheet>
  );
}

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (d: Date, now = new Date()) =>
  Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 864e5);
const p2 = (n: number) => String(n).padStart(2, "0");

export const hm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** "YYYY-MM-DD[THH:MM]" as a local date (a bare date string would otherwise parse as UTC). */
export function parseLocal(s: string): Date {
  const [d, t] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = (t ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, day, h, min);
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = dayDiff(d);
  if (diff === 0) return "Heute";
  if (diff === -1) return "Gestern";
  return `${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${
    d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : ""
  }`;
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  const diff = dayDiff(d);
  const day = diff === 0 ? "Heute" : diff === -1 ? "Gestern" : `${d.getDate()}.${d.getMonth() + 1}.`;
  return `${day}, ${hm(d)}`;
}

/** Date chip: 'heute 14:00', 'morgen', 'Mi, 7.10.', 'Do, 8.10. · 14:00'. */
export function dueLabel(d: Date, hasTime: boolean, rel = true): string {
  const tm = hasTime ? hm(d) : "";
  const diff = dayDiff(d);
  if (rel && diff === 0) return "heute" + (tm ? " " + tm : "");
  if (rel && diff === 1) return "morgen" + (tm ? " " + tm : "");
  return `${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.` + (tm ? " · " + tm : "");
}

export const dueIsHot = (d: Date) => dayDiff(d) <= 0;

export const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

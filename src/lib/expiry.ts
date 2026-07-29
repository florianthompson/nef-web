// Ablaufdaten (MHD) helpers, shared by the Bestand tab and the checklist badges.

export type ExpiryStatus = "expired" | "soon" | "ok" | "none";

// A medication counts as "bald" this many days before it expires.
export const SOON_DAYS = 60;

function daysUntil(date: string, today = new Date()): number {
  const d = new Date(date + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export function expiryStatus(date: string | null, today = new Date()): ExpiryStatus {
  if (!date) return "none";
  const diff = daysUntil(date, today);
  if (diff < 0) return "expired";
  if (diff <= SOON_DAYS) return "soon";
  return "ok";
}

// Only medications carry an MHD. All expiry-relevant drugs live as leaf
// sub-items under the "Medikamente" category; "Betäubungsmittel" is a
// summary checkbox, not a drug list.
export function categoryTracksExpiry(title: string): boolean {
  return title.toLowerCase().includes("medikament");
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export function formatMonthYear(date: string): string {
  const [y, m] = date.split("-");
  return `${m}/${y}`;
}

// "vor 113 Tagen" / "in 11 Monaten"
export function relativeExpiry(date: string, today = new Date()): string {
  const diff = daysUntil(date, today);
  const abs = Math.abs(diff);
  const unit = abs < SOON_DAYS ? `${abs} Tagen` : `${Math.round(abs / 30)} Monaten`;
  return diff < 0 ? `vor ${unit}` : `in ${unit}`;
}

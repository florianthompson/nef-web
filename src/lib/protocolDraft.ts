// Local, per-device draft of an in-progress protocol so a user who starts a
// checklist and then closes the app (e.g. driving to an emergency) can continue
// where they left off. Structure always comes from the live protocol on load;
// this only restores which items were checked, the vehicle, and the shift note.

export type ProtocolDraft = {
  protocolId: string;
  vehicleId: string | null;
  shiftNote: string;
  checkedIds: string[];
  savedAt: number;
};

// Discard drafts older than this, so a previous shift's draft doesn't resurface.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const keyFor = (userId: string) => `nef:protocol-draft:${userId}`;

export function saveDraft(
  userId: string,
  draft: Omit<ProtocolDraft, "savedAt">
): void {
  try {
    localStorage.setItem(
      keyFor(userId),
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
  } catch {
    // localStorage unavailable (private mode / SSR) — draft is best-effort.
  }
}

export function loadDraft(userId: string, protocolId: string): ProtocolDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as ProtocolDraft;
    if (draft.protocolId !== protocolId || Date.now() - draft.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(keyFor(userId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}

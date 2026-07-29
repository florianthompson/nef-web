// Feature flags gated to specific users during rollout.
// Bestand (MHD / Ablaufdaten) — visible only to these users until launch.
const BESTAND_USER_IDS = new Set([
  "6d8b6a96-0fa0-4810-ba7d-1c441ee42562", // Christian Pawlak
  "5d6e6eaa-9499-4b48-80d0-0a14fae86c7f", // Florian Thompson
]);

export function canSeeBestand(userId: string | null | undefined): boolean {
  return !!userId && BESTAND_USER_IDS.has(userId);
}

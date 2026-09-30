// Feature flags gated to specific users during rollout.

// Master switch for the whole MHD / Bestand feature (nav tab, /app/bestand,
// expired-medication banner, checklist MHD badges, item_expiry_events fetch).
// Off by default. To turn it back on, set NEXT_PUBLIC_FEATURE_MHD=true in the
// Vercel env and redeploy (it is inlined at build time). The user allowlist
// below still applies on top.
export const MHD_ENABLED = process.env.NEXT_PUBLIC_FEATURE_MHD === "true";

// Bestand (MHD / Ablaufdaten) — visible only to these users until launch.
const BESTAND_USER_IDS = new Set([
  "6d8b6a96-0fa0-4810-ba7d-1c441ee42562", // Christian Pawlak
  "5d6e6eaa-9499-4b48-80d0-0a14fae86c7f", // Florian Thompson
]);

export function canSeeBestand(userId: string | null | undefined): boolean {
  return MHD_ENABLED && !!userId && BESTAND_USER_IDS.has(userId);
}

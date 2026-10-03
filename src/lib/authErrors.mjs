export const LOGIN_FALLBACK = "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
export const NO_PROFILE_MESSAGE =
  "Für dieses Konto wurde kein Profil gefunden. Bitte wende dich an deinen Administrator.";

/** Maps a Supabase auth error to a German login message. */
export function loginErrorMessage(err) {
  const msg = String(err?.message ?? "").toLowerCase();
  const code = String(err?.code ?? "").toLowerCase();
  const status = err?.status;

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "E-Mail oder Passwort falsch.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }
  if (
    status === 429 ||
    code.includes("rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many")
  ) {
    return "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.";
  }
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    err?.name === "AuthRetryableFetchError"
  ) {
    return "Keine Verbindung. Bitte prüfe dein Netzwerk und versuche es erneut.";
  }
  return LOGIN_FALLBACK;
}

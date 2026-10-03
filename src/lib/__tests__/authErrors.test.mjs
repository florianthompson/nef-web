import { test } from "node:test";
import assert from "node:assert/strict";
import { loginErrorMessage, LOGIN_FALLBACK } from "../authErrors.mjs";

test("wrong credentials", () => {
  assert.equal(loginErrorMessage({ message: "Invalid login credentials", status: 400 }), "E-Mail oder Passwort falsch.");
  assert.equal(loginErrorMessage({ code: "invalid_credentials", message: "x" }), "E-Mail oder Passwort falsch.");
});
test("email not confirmed", () => {
  assert.match(loginErrorMessage({ message: "Email not confirmed" }), /bestätige/);
});
test("rate limit", () => {
  assert.match(loginErrorMessage({ status: 429, message: "x" }), /Zu viele/);
  assert.match(loginErrorMessage({ message: "email rate limit exceeded" }), /Zu viele/);
});
test("network", () => {
  assert.match(loginErrorMessage({ message: "Failed to fetch" }), /Keine Verbindung/);
  assert.match(loginErrorMessage({ name: "AuthRetryableFetchError", message: "" }), /Keine Verbindung/);
});
test("fallback never leaks English", () => {
  assert.equal(loginErrorMessage({ message: "Something odd" }), LOGIN_FALLBACK);
  assert.equal(loginErrorMessage(null), LOGIN_FALLBACK);
});

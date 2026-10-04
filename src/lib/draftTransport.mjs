// HTTP transport for draftSync: the small authenticated /api/protocol-draft route, same bearer
// token pattern as /api/submit-protocol. getToken must be synchronous (a cached access token) so
// the keepalive request on pagehide can start without awaiting anything.

export function createHttpTransport({ fetchImpl, getToken, url = "/api/protocol-draft" }) {
  const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` });
  const qs = (ctx) => `?vehicleId=${encodeURIComponent(ctx.vehicleId)}&protocolId=${encodeURIComponent(ctx.protocolId)}`;

  async function call(input, init) {
    try {
      const res = await fetchImpl(input, init);
      if (res.ok) return { status: "ok", body: await res.json().catch(() => ({})) };
      const body = await res.json().catch(() => ({}));
      // the route answers 503 drafts_unavailable when public.protocol_drafts does not exist yet
      if (res.status === 503 && body?.error === "drafts_unavailable") return { status: "missing" };
      return { status: "error", code: res.status };
    } catch {
      return { status: "error", code: 0 };
    }
  }

  return {
    async get(ctx) {
      const r = await call(url + qs(ctx), { method: "GET", headers: headers() });
      return r.status === "ok" ? { status: "ok", draft: r.body.draft ?? null } : r;
    },
    async put(ctx, draft, { keepalive = false } = {}) {
      return call(url, {
        method: "PUT",
        headers: headers(),
        keepalive,
        body: JSON.stringify({ vehicleId: ctx.vehicleId, protocolId: ctx.protocolId, draft }),
      });
    },
    async del(ctx) {
      return call(url + qs(ctx), { method: "DELETE", headers: headers() });
    },
  };
}

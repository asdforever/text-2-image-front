import assert from "node:assert/strict";
import test from "node:test";
import { planningConversationsApi } from "../src/api/planning-conversations";
import { ApiResultUnknownError } from "../src/api/client";

test("conversation API scopes reads and preserves revision, snapshot and replay key", async () => {
  const original = globalThis.fetch;
  const calls: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (path, init) => { calls.push({ path: String(path), init }); return new Response(JSON.stringify({ data: { id: "s", revision: 4 } })); }) as typeof fetch;
  try {
    await planningConversationsApi.get("p /", "suite", "regular");
    assert.equal(calls[0].path, "/api/projects/p%20%2F/planning-conversations?mode=suite&creationMode=regular");
    const body = { expectedRevision: 4, input: { mode: "suite" }, snapshot: { plan: { id: "old" } }, text: "只改第二张" } as any;
    await planningConversationsApi.send("p", "s", body, "same-key");
    await planningConversationsApi.send("p", "s", body, "same-key");
    assert.equal(new Headers(calls[1].init?.headers).get("Idempotency-Key"), "same-key");
    assert.deepEqual(calls[1].init?.body, calls[2].init?.body);
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), body);
    await planningConversationsApi.apply("p", "s", { ...body, text: undefined, candidatePlanId: "candidate" });
    assert.equal(calls[3].path, "/api/projects/p/planning-conversations/s/apply");
  } finally { globalThis.fetch = original; }
});
test("conversation mutations retain the shared unknown-result error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 202 });
  try { await assert.rejects(planningConversationsApi.send("p", "s", {} as any, "key"), ApiResultUnknownError); }
  finally { globalThis.fetch = original; }
});

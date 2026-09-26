import assert from "node:assert/strict";
import test from "node:test";

import { modulePlanningApi } from "../src/api/client";

test("规划大师客户端提交完整规划上下文并携带幂等键", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (path: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    return new Response(JSON.stringify({ data: { id: "master-1", mode: "hero", status: "completed", summary: "突出便携", modules: [], warnings: [], createdAt: "2026-09-22T00:00:00Z" } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const input = { mode: "hero" as const, sourceAssetIds: ["asset-1"], marketId: "taobao", aspectRatio: "1:1", outputLanguage: "中文", brief: "一款轻量通勤耳机，主打全天佩戴" };
    await modulePlanningApi.plan("project / 1", input, "plan-key");
    await modulePlanningApi.getLatest("project / 1", "suite");
    await modulePlanningApi.get("project / 1", "plan / 1");
    assert.equal(calls[0].path, "/api/projects/project%20%2F%201/module-plans");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), input);
    assert.equal((calls[0].init?.headers as Record<string, string>)["idempotency-key"], "plan-key");
    assert.equal(calls[1].path, "/api/projects/project%20%2F%201/module-plans/latest?mode=suite");
    assert.equal(calls[2].path, "/api/projects/project%20%2F%201/module-plans/plan%20%2F%201");
  } finally { globalThis.fetch = originalFetch; }
});

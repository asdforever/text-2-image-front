import assert from "node:assert/strict";
import test from "node:test";

import { suitePlanningApi } from "../src/api/client";


test("详情页规划客户端覆盖编译、恢复、编辑、排序和确认路径", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (path: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    return new Response(JSON.stringify({ data: { id: "plan-1", modules: [] } }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const input = {
      sourceAssetIds: ["asset-1", "asset-2"], marketId: "taobao",
      modelId: "gpt-image-2", styleId: "minimal", aspectRatio: "3:4",
      resolution: "标准 1K", outputLanguage: "中文",
      modules: [{ moduleId: "suite-hero", resultCount: 2, moduleParameters: [] }],
      references: [{ referenceId: "ref-1", version: "v1" }],
    };
    await suitePlanningApi.compile("project / 1", input, "compile-key");
    await suitePlanningApi.get("project / 1", "plan / 1");
    await suitePlanningApi.getLatest("project / 1");
    await suitePlanningApi.updateModule("project / 1", "plan / 1", "module / 1", {
      expectedPlanRevision: 2, expectedModuleRevision: 1, resultCount: 4,
    });
    await suitePlanningApi.reorder("project / 1", "plan / 1", 3, ["module / 1"]);
    await suitePlanningApi.confirm(
      "project / 1", "plan / 1", 3, { "suite-hero": "确认提示词" }, "confirm-key",
    );

    assert.equal(calls[0].path, "/api/projects/project%20%2F%201/suite-plans/compile");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), input);
    assert.equal((calls[0].init?.headers as Record<string, string>)["idempotency-key"], "compile-key");
    assert.equal(calls[1].path, "/api/projects/project%20%2F%201/suite-plans/plan%20%2F%201");
    assert.equal(calls[2].path, "/api/projects/project%20%2F%201/suite-plans/latest");
    assert.deepEqual(JSON.parse(String(calls[3].init?.body)), {
      expectedPlanRevision: 2, expectedModuleRevision: 1, resultCount: 4,
    });
    assert.deepEqual(JSON.parse(String(calls[4].init?.body)), {
      expectedPlanRevision: 3, moduleIds: ["module / 1"],
    });
    assert.deepEqual(JSON.parse(String(calls[5].init?.body)), {
      expectedPlanRevision: 3, moduleTaskPrompts: { "suite-hero": "确认提示词" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

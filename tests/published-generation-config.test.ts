import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultGenerationConfig } from "../src/lib/generation-config";
import { useGenerationConfigStore } from "../src/store/useGenerationConfigStore";


test("工作台刷新只读取服务端已发布配置", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const content = createDefaultGenerationConfig();
  content.markets[0].label = "服务端已发布淘宝";
  globalThis.fetch = (async (path: string | URL | Request) => {
    calls.push(String(path));
    return new Response(JSON.stringify({ data: {
      id: "version-8",
      version: 8,
      content,
      contentSha256: "a".repeat(64),
      createdAt: "2026-09-14T08:00:00Z",
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    useGenerationConfigStore.getState().resetConfig();
    const { refreshPublishedGenerationConfig } = await import("../src/hooks/usePublishedGenerationConfig");
    const published = await refreshPublishedGenerationConfig();

    assert.deepEqual(calls, ["/api/generation-config"]);
    assert.equal(published.version, 8);
    assert.equal(useGenerationConfigStore.getState().published.markets[0].label, "服务端已发布淘宝");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

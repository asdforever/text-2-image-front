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
      configVersion: 8,
      config: content,
      runtimeModules: { version: "runtime-modules-v1", contentSha256: "b".repeat(64), heroModules: [...content.heroModules, { id: "hero-freeform", label: "自由创意", description: "自由表达", mode: "hero" }], suiteModules: content.suiteModules },
      contentSha256: "a".repeat(64),
      createdAt: "2026-09-14T08:00:00Z",
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    useGenerationConfigStore.getState().resetConfig();
    const { refreshPublishedGenerationConfig } = await import("../src/hooks/usePublishedGenerationConfig");
    const published = await refreshPublishedGenerationConfig();

    assert.deepEqual(calls, ["/api/generation-config/resolve"]);
    assert.equal(published.version, 8);
    assert.equal(useGenerationConfigStore.getState().published.markets[0].label, "服务端已发布淘宝");
    assert.ok(published.heroModules.some(m => m.id === "hero-freeform"));
    assert.equal(useGenerationConfigStore.getState().published.heroModules.some(m => m.id === "hero-freeform"), false);
    useGenerationConfigStore.getState().discardDraft();
    assert.equal(useGenerationConfigStore.getState().draft.heroModules.some(m => m.id === "hero-freeform"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("发布或管理页刷新配置后不能复用旧运行时目录", () => {
  const store = useGenerationConfigStore.getState();
  const first = createDefaultGenerationConfig();
  store.replaceRuntimePublished(first, first);
  store.acceptPublished({ ...first, version: 2 });
  assert.equal(useGenerationConfigStore.getState().runtimePublished, null);
  store.replaceRuntimePublished(first, first);
  store.hydrateRemote({ ...first, version: 3 }, { ...first, version: 3 }, 3);
  assert.equal(useGenerationConfigStore.getState().runtimePublished, null);
});

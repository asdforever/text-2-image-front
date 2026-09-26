import assert from "node:assert/strict";
import test from "node:test";

import { generationConfigApi, toPublishedGenerationConfig } from "../src/api/client";
import { createDefaultGenerationConfig } from "../src/lib/generation-config";


test("生成配置客户端读取发布配置并以幂等请求保存草稿和发布", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const content = createDefaultGenerationConfig();
  globalThis.fetch = (async (path: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    const data = String(path).endsWith("/draft")
      ? { baseVersion: 1, content, updatedAt: "2026-09-14T00:00:00Z" }
      : { id: "version-1", version: 1, content, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" };
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const published = await generationConfigApi.getPublished();
    await generationConfigApi.replaceDraft(1, content);
    await generationConfigApi.publish();

    assert.equal(toPublishedGenerationConfig(published).version, 1);
    assert.equal(calls[0].path, "/api/generation-config");
    assert.equal(calls[1].path, "/api/generation-config/draft");
    assert.equal(calls[1].init?.method, "PUT");
    assert.match(String((calls[1].init?.headers as Record<string, string>)["idempotency-key"]), /\S/);
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { baseVersion: 1, content });
    assert.equal(calls[2].path, "/api/generation-config/publish");
    assert.equal(calls[2].init?.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("生成配置客户端保留服务端错误消息", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ error: { code: "GENERATION_CONFIG_INVALID", message: "风格大类最多 4 个风格" } }),
    { status: 400, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

  try {
    await assert.rejects(() => generationConfigApi.getDraft(), /风格大类最多 4 个风格/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

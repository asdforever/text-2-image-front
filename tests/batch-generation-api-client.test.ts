import assert from "node:assert/strict";
import test from "node:test";

import { batchGenerationApi } from "../src/api/client";


const batch = {
  id: "batch-1",
  projectId: "project / 1",
  sourceAssetId: "source-1",
  status: "awaiting_confirmation",
  createdAt: "2026-09-14T00:00:00Z",
  updatedAt: "2026-09-14T00:00:00Z",
  confirmedAt: null,
  completedAt: null,
} as const;

const detail = {
  ...batch,
  modules: [],
  slots: [],
  progress: {
    total: 0,
    queued: 0,
    leased: 0,
    dispatching: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    needsRetry: 0,
    completed: 0,
  },
} as const;


test("批次生成客户端按项目边界提交、读取、确认、取消和单槽位重试", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (path: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    const response = calls.length === 1 ? batch : calls.length === 5 ? { slot: { id: "slot-1" } } : detail;
    return new Response(JSON.stringify({ data: response }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const input = {
      sourceAssetId: "source-1",
      marketId: "amazon-us",
      modelId: "gpt-image-2",
      styleId: "precision",
      aspectRatio: "1:1",
      resolution: "标准 1K",
      outputLanguage: "中文",
      customStyle: "冷灰背景",
      modules: [
        { moduleId: "hero-kv", resultCount: 3, moduleParameters: [{ key: "核心卖点", value: "轻量佩戴" }] },
        { moduleId: "hero-scene", resultCount: 2, moduleParameters: [{ key: "使用场景", value: "办公桌面" }] },
      ],
    };
    await batchGenerationApi.compile("project / 1", input, "compile-key");
    await batchGenerationApi.get("project / 1", "batch / 1");
    await batchGenerationApi.confirm("project / 1", "batch / 1", { "module / 1": "编辑后的实时任务提示词" }, "confirm-key");
    await batchGenerationApi.cancel("project / 1", "batch / 1");
    await batchGenerationApi.retrySlot("project / 1", "batch / 1", "slot / 1");

    assert.equal(calls[0].path, "/api/projects/project%20%2F%201/generation-batches/compile");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), input);
    assert.equal((calls[0].init?.headers as Record<string, string>)["idempotency-key"], "compile-key");
    assert.equal(calls[1].path, "/api/projects/project%20%2F%201/generation-batches/batch%20%2F%201");
    assert.equal(calls[2].path, "/api/projects/project%20%2F%201/generation-batches/batch%20%2F%201/confirm");
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { moduleTaskPrompts: { "module / 1": "编辑后的实时任务提示词" } });
    assert.equal((calls[2].init?.headers as Record<string, string>)["idempotency-key"], "confirm-key");
    assert.equal(calls[3].path, "/api/projects/project%20%2F%201/generation-batches/batch%20%2F%201/cancel");
    assert.equal(calls[3].init?.method, "POST");
    assert.equal(calls[4].path, "/api/projects/project%20%2F%201/generation-batches/batch%20%2F%201/slots/slot%20%2F%201/retry");
    assert.equal(calls[4].init?.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("批次生成客户端保留后端返回的中文安全错误", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ error: { code: "BATCH_GENERATION_NOT_FOUND", message: "批次生成任务不存在" } }),
    { status: 404, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

  try {
    await assert.rejects(
      () => batchGenerationApi.get("project-1", "batch-1"),
      /批次生成任务不存在/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

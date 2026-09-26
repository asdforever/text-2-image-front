import assert from "node:assert/strict";
import test from "node:test";

import { heroGenerationApi } from "../src/api/client";


const task = {
  id: "task-1",
  projectId: "project / 1",
  sourceAssetId: "source-1",
  status: "awaiting_confirmation",
  snapshot: { selection: { module: { id: "hero-kv", label: "首屏 KV" } } },
  constraints: {
    authenticity: { content: "真实性约束", source: "server_policy", contentSha256: "a".repeat(64) },
    market: { content: "淘宝约束", source: "market_guidance", contentSha256: "b".repeat(64) },
    style: { content: "冷调精密", source: "style_description", contentSha256: "c".repeat(64) },
  },
  compiledTaskPrompt: "黑色耳机居中",
  visibleFacts: ["黑色耳机"],
  unconfirmedItems: ["续航未知"],
  confirmedTaskPrompt: null,
  finalPrompt: null,
  finalPromptSha256: null,
  providerRequest: null,
  generatedAssetId: null,
  generatedAssetPreviewUrl: null,
  error: null,
  createdAt: "2026-09-14T00:00:00Z",
  updatedAt: "2026-09-14T00:00:00Z",
  confirmedAt: null,
  completedAt: null,
} as const;


test("主图生成客户端按编译、读取、确认三条项目接口请求", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (path: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    return new Response(JSON.stringify({ data: task }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const input = {
      sourceAssetId: "source-1",
      marketId: "taobao",
      modelId: "gpt-image-2-5",
      styleId: "precision",
      moduleId: "hero-kv",
      aspectRatio: "1:1",
      resolution: "标准 1K",
      outputLanguage: "中文",
      customStyle: "冷灰背景",
      moduleParameters: [{ key: "核心卖点", value: "轻量佩戴" }],
      resultCount: 1 as const,
    };
    const compiled = await heroGenerationApi.compile("project / 1", input);
    await heroGenerationApi.get("project / 1", "task / 1");
    await heroGenerationApi.confirm("project / 1", "task / 1", "用户编辑任务提示词");

    assert.equal(compiled.compiledTaskPrompt, "黑色耳机居中");
    assert.equal(calls[0].path, "/api/projects/project%20%2F%201/hero-generations/compile");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), input);
    assert.match(
      String((calls[0].init?.headers as Record<string, string>)["idempotency-key"]),
      /\S/,
    );
    assert.equal(
      calls[1].path,
      "/api/projects/project%20%2F%201/hero-generations/task%20%2F%201",
    );
    assert.equal(
      calls[2].path,
      "/api/projects/project%20%2F%201/hero-generations/task%20%2F%201/confirm",
    );
    assert.equal(calls[2].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
      taskPrompt: "用户编辑任务提示词",
    });
    assert.match(
      String((calls[2].init?.headers as Record<string, string>)["idempotency-key"]),
      /\S/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("主图生成客户端保留编译和生图失败消息", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      error: { code: "PROMPT_COMPILER_UNAVAILABLE", message: "提示词编译模型未配置" },
    }),
    { status: 503, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

  try {
    await assert.rejects(
      () => heroGenerationApi.get("project-1", "task-1"),
      /提示词编译模型未配置/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

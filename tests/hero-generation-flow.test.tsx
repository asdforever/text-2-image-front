import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

import type { ApiBatchGenerationDetail, ApiHeroGenerationTask } from "../src/api/client";
import {
  compileBatchHeroGenerationFlow,
  compileHeroGenerationFlow,
  confirmBatchHeroGenerationFlow,
  confirmHeroGenerationFlow,
  validateBatchHeroSelection,
  validateStage3AHeroSelection,
} from "../src/lib/hero-generation-flow";
import { BatchGenerationProgress, BatchGenerationStatus, BatchPromptConfirmation, HeroPromptConfirmation } from "../src/pages/HeroImageWorkspace";


test("阶段 3A 门禁只允许一个源图、一个模块和一张结果", () => {
  assert.deepEqual(validateStage3AHeroSelection(["source-1"], ["hero-kv"], { "hero-kv": 1 }), []);
  assert.deepEqual(
    validateStage3AHeroSelection(["source-1", "source-2"], ["hero-kv", "hero-scene"], { "hero-kv": 2, "hero-scene": 1 }),
    [
      "阶段 3A 每次只能选择 1 张产品素材",
      "阶段 3A 每次只能选择 1 个主图模块",
      "阶段 3A 每个模块只能生成 1 张图片",
    ],
  );
});


test("批次主图只限制一个源图，并允许多个模块各自选择一到四张", () => {
  assert.deepEqual(
    validateBatchHeroSelection(["source-1"], ["hero-kv", "hero-scene"], { "hero-kv": 3, "hero-scene": 2 }),
    [],
  );
  assert.deepEqual(
    validateBatchHeroSelection(["source-1", "source-2"], ["hero-kv"], { "hero-kv": 1 }),
    ["批次主图每次只能选择 1 张产品素材"],
  );
});


test("批次编译把每个已选模块及其图片数量提交给批次接口", async () => {
  const calls: unknown[] = [];
  const api = {
    compile: async (projectId: string, input: unknown) => {
      calls.push({ projectId, input });
      return batch;
    },
  };
  const input = {
    sourceAssetId: "source-1",
    marketId: "taobao",
    modelId: "gpt-image-2",
    styleId: "precision",
    aspectRatio: "1:1",
    resolution: "标准 1K",
    outputLanguage: "中文",
    modules: [
      { moduleId: "hero-kv", resultCount: 3, moduleParameters: [{ key: "核心卖点", value: "轻量" }] },
      { moduleId: "hero-scene", resultCount: 2, moduleParameters: [{ key: "场景地点", value: "书房" }] },
    ],
  };

  const compiled = await compileBatchHeroGenerationFlow(api, "project-1", input, "compile-key");

  assert.equal(compiled.id, "batch-1");
  assert.deepEqual(calls, [{ projectId: "project-1", input }]);
});


test("编译动作只请求待确认提示词，不提前调用确认生图", async () => {
  const calls: string[] = [];
  const api = {
    compile: async () => { calls.push("compile"); return task; },
    confirm: async () => { calls.push("confirm"); return task; },
  };

  const result = await compileHeroGenerationFlow(api, "project-1", {
    sourceAssetId: "source-1",
    marketId: "taobao",
    modelId: "gpt-image-2-5",
    styleId: "precision",
    moduleId: "hero-kv",
    aspectRatio: "1:1",
    resolution: "标准 1K",
    outputLanguage: "中文",
    moduleParameters: [],
    resultCount: 1,
  });

  assert.equal(result.status, "awaiting_confirmation");
  assert.deepEqual(calls, ["compile"]);
});


test("确认动作只把用户编辑后的实时任务提示词发送给确认接口", async () => {
  const calls: unknown[] = [];
  const api = {
    compile: async () => task,
    confirm: async (projectId: string, taskId: string, prompt?: string) => {
      calls.push({ projectId, taskId, prompt });
      return { ...task, status: "succeeded" as const, confirmedTaskPrompt: prompt ?? null };
    },
  };

  const result = await confirmHeroGenerationFlow(
    api,
    "project-1",
    "task-1",
    "用户编辑后的实时任务提示词",
  );

  assert.equal(result.status, "succeeded");
  assert.deepEqual(calls, [{ projectId: "project-1", taskId: "task-1", prompt: "用户编辑后的实时任务提示词" }]);
});


test("批次确认只提交每个模块编辑后的实时任务提示词", async () => {
  const calls: unknown[] = [];
  const api = {
    confirm: async (projectId: string, batchId: string, moduleTaskPrompts: Record<string, string>) => {
      calls.push({ projectId, batchId, moduleTaskPrompts });
      return batchDetail;
    },
  };

  const result = await confirmBatchHeroGenerationFlow(api, "project-1", "batch-1", {
    "module-kv": "编辑后的 KV 任务",
    "module-scene": "编辑后的场景任务",
  });

  assert.equal(result.status, "awaiting_confirmation");
  assert.deepEqual(calls, [{
    projectId: "project-1",
    batchId: "batch-1",
    moduleTaskPrompts: { "module-kv": "编辑后的 KV 任务", "module-scene": "编辑后的场景任务" },
  }]);
});


test("确认面板只允许编辑实时任务提示词，三张约束卡和事实均只读", () => {
  const html = renderToStaticMarkup(
    <HeroPromptConfirmation
      task={task}
      busy={false}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />,
  );

  assert.match(html, /商品真实性约束/);
  assert.match(html, /具体电商平台约束/);
  assert.match(html, /全局风格约束/);
  assert.match(html, /可见事实/);
  assert.match(html, /无法确认项/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 1);
  assert.equal((html.match(/<input/g) ?? []).length, 0);
  assert.match(html, /确认并生成/);
});


test("批次确认面板按模块显示可编辑提示词、只读事实和数量", () => {
  const html = renderToStaticMarkup(
    <BatchPromptConfirmation
      batch={batchDetail}
      busy={false}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />,
  );

  assert.match(html, /首屏 KV/);
  assert.match(html, /使用场景/);
  assert.match(html, /生成 3 张/);
  assert.match(html, /生成 2 张/);
  assert.match(html, /商品真实性约束/);
  assert.match(html, /具体电商平台约束/);
  assert.match(html, /全局风格约束/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 2);
  assert.equal((html.match(/<input/g) ?? []).length, 0);
  assert.match(html, /KV 任务/);
  assert.match(html, /场景任务/);
  assert.doesNotMatch(html, /已编辑 KV 任务/);
  assert.doesNotMatch(html, /readOnly/);
  assert.match(html, /确认并开始批次生成/);
});


test("批次运行状态展示总进度、模块进度、槽位结果、失败重试和取消", () => {
  const html = renderToStaticMarkup(
    <BatchGenerationStatus
      batch={runningBatch}
      busy={false}
      onCancel={() => undefined}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, /成功 1 \/ 3/);
  assert.match(html, /首屏 KV：1 \/ 2/);
  assert.match(html, /使用场景：0 \/ 1/);
  assert.match(html, /\/preview\/asset-1/);
  assert.match(html, /模型请求失败/);
  assert.match(html, /重试此张/);
  assert.match(html, /取消批次/);
});


test("主图真实提交路径不再使用浏览器模拟或本地生成资产", () => {
  const source = readFileSync(new URL("../src/pages/HeroImageWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /mockGenerateHeroImage/);
  assert.doesNotMatch(source, /addGeneratedAsset/);
  assert.match(source, /heroGenerationApi/);
  assert.match(source, /await props\.onRefresh\?\.\(\)/);
});

test("顶部进度按图片数统计，并标明已结束的失败、取消和待重试结果", () => {
  const html = renderToStaticMarkup(<BatchGenerationProgress batch={runningBatch} />);
  assert.match(html, /任务进度 · 1\/3 · 33%/);
  assert.match(html, /首屏 KV：50%/);
  assert.match(html, /使用场景：0%/);
  assert.match(html, /失败 1 张/);
  for (const status of ["cancelled", "needs_retry"] as const) {
    const ended: ApiBatchGenerationDetail = {
      ...runningBatch,
      slots: runningBatch.slots.map((slot) => slot.status === "failed" ? { ...slot, status } : slot),
      progress: { ...runningBatch.progress, failed: 0, cancelled: status === "cancelled" ? 1 : 0, needsRetry: status === "needs_retry" ? 1 : 0 },
    };
    const endedHtml = renderToStaticMarkup(<BatchGenerationProgress batch={ended} />);
    assert.match(endedHtml, /任务进度 · 1\/3 · 33%/);
    assert.match(endedHtml, status === "cancelled" ? /已取消 1 张/ : /待重试 1 张/);
  }
});

test("取消全部图片不显示成功 100%，并提供独立的重新编译入口", () => {
  const cancelled: ApiBatchGenerationDetail = {
    ...runningBatch,
    status: "cancelled",
    slots: runningBatch.slots.map((slot) => ({ ...slot, status: "cancelled", generatedAssetId: null, generatedAssetPreviewUrl: null })),
    progress: { ...runningBatch.progress, succeeded: 0, queued: 0, failed: 0, cancelled: 3, completed: 3 },
  };
  const progress = renderToStaticMarkup(<BatchGenerationProgress batch={cancelled} />);
  assert.match(progress, /任务进度 · 0\/3 · 0%/);
  assert.match(progress, /已取消 3 张/);
  assert.doesNotMatch(progress, /100%/);
  for (const status of ["cancelled", "failed", "partially_failed"] as const) {
    const html = renderToStaticMarkup(<BatchGenerationStatus batch={{ ...cancelled, status }} busy={false} onCancel={() => undefined} onRetry={() => undefined} onRecompile={() => undefined} />);
    assert.match(html, /重新编译提示词/);
    assert.match(html, /成功 0 \/ 3/);
    assert.doesNotMatch(html, /取消批次/);
  }
});

test("单张重试重新排队后顶部进度回到当前批次状态", () => {
  const retried: ApiBatchGenerationDetail = {
    ...runningBatch,
    slots: runningBatch.slots.map((slot) => slot.status === "failed" ? { ...slot, status: "queued", error: null } : slot),
    progress: { ...runningBatch.progress, queued: 2, failed: 0, completed: 1 },
  };
  const html = renderToStaticMarkup(<BatchGenerationProgress batch={retried} />);
  assert.match(html, /任务进度 · 1\/3 · 33%/);
  assert.match(html, /首屏 KV：50%/);
  assert.doesNotMatch(html, /失败 1 张/);
});


const task: ApiHeroGenerationTask = {
  id: "task-1",
  projectId: "project-1",
  sourceAssetId: "source-1",
  status: "awaiting_confirmation",
  snapshot: {},
  constraints: {
    authenticity: { content: "保持商品真实性", source: "server_policy", contentSha256: "a".repeat(64) },
    market: { content: "淘宝平台约束", source: "market_guidance", contentSha256: "b".repeat(64) },
    style: { content: "冷调精密风格", source: "style_description", contentSha256: "c".repeat(64) },
  },
  compiledTaskPrompt: "黑色耳机居中展示",
  visibleFacts: ["黑色主体"],
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
};

const batch = {
  id: "batch-1",
  projectId: "project-1",
  sourceAssetId: "source-1",
  status: "awaiting_confirmation" as const,
  createdAt: "2026-09-14T00:00:00Z",
  updatedAt: "2026-09-14T00:00:00Z",
  confirmedAt: null,
  completedAt: null,
};

const constraint = (content: string) => ({ content, source: "server_policy", contentSha256: "d".repeat(64) });
const batchDetail: ApiBatchGenerationDetail = {
  ...batch,
  modules: [
    {
      id: "module-kv",
      moduleKey: "hero-kv",
      resultCount: 3,
      constraints: { authenticity: constraint("真实性约束"), market: constraint("淘宝约束"), style: constraint("冷调精密") },
      compiledTaskPrompt: "KV 任务",
      visibleFacts: ["黑色产品"],
      unconfirmedItems: ["具体规格未知"],
      confirmedTaskPrompt: null,
      finalPromptSha256: null,
    },
    {
      id: "module-scene",
      moduleKey: "hero-scene",
      resultCount: 2,
      constraints: { authenticity: constraint("真实性约束"), market: constraint("淘宝约束"), style: constraint("冷调精密") },
      compiledTaskPrompt: "场景任务",
      visibleFacts: ["黑色产品"],
      unconfirmedItems: ["具体规格未知"],
      confirmedTaskPrompt: null,
      finalPromptSha256: null,
    },
  ],
  slots: [],
  progress: { total: 0, queued: 0, leased: 0, dispatching: 0, succeeded: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: 0 },
};

const runningBatch: ApiBatchGenerationDetail = {
  ...batchDetail,
  status: "queued",
  modules: [
    { ...batchDetail.modules[0], resultCount: 2 },
    { ...batchDetail.modules[1], resultCount: 1 },
  ],
  slots: [
    { id: "slot-1", moduleTaskId: "module-kv", moduleKey: "hero-kv", ordinal: 1, status: "succeeded", generatedAssetId: "asset-1", generatedAssetPreviewUrl: "/preview/asset-1", error: null },
    { id: "slot-2", moduleTaskId: "module-kv", moduleKey: "hero-kv", ordinal: 2, status: "failed", generatedAssetId: null, generatedAssetPreviewUrl: null, error: { code: "PROVIDER_FAILED", message: "模型请求失败" } },
    { id: "slot-3", moduleTaskId: "module-scene", moduleKey: "hero-scene", ordinal: 1, status: "queued", generatedAssetId: null, generatedAssetPreviewUrl: null, error: null },
  ],
  progress: { total: 3, queued: 1, leased: 0, dispatching: 0, succeeded: 1, failed: 1, cancelled: 0, needsRetry: 0, completed: 2 },
};

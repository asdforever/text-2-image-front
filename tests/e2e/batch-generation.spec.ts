import { expect, test } from "playwright/test";
import type { ApiBatchGenerationDetail } from "../../src/api/client";

import { createDefaultGenerationConfig } from "../../src/lib/generation-config";


test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("batch-test-initialized")) return;
    window.localStorage.clear();
    window.sessionStorage.setItem("batch-test-initialized", "1");
  });
});

test("主图批次在确认前不请求生图，并按模块数量轮询展示五个槽位", async ({ page }, testInfo) => {
  await page.route("**/api/generation-worker/status", (route) => route.fulfill({ json: { data: { status: "online", lastSeenAt: null } } }));
  const config = createDefaultGenerationConfig();
  const sourceId = "source-1";
  let confirmCalls = 0;
  let confirmed = false;
  let successfulSlots = 0;
  const deletedIds = new Set<string>();

  const batch = {
    id: "batch-1", projectId: "proj-demo", sourceAssetId: sourceId,
    createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: null, completedAt: null,
  };
  const modules = [
    { id: "module-kv", moduleKey: "hero-kv", resultCount: 3, constraints: cards(), compiledTaskPrompt: "KV 实时任务", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"], confirmedTaskPrompt: null, finalPromptSha256: null },
    { id: "module-scene", moduleKey: "hero-scene", resultCount: 2, constraints: cards(), compiledTaskPrompt: "场景实时任务", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"], confirmedTaskPrompt: null, finalPromptSha256: null },
  ];

  await page.route("**/api/generation-config", async (route) => {
    await route.fulfill({ json: { data: { id: "version-1", version: 1, content: config, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" } } });
  });
  await page.route("**/api/projects/proj-demo", async (route) => {
    await route.fulfill({ json: { data: {
      id: "proj-demo", name: "演示项目", status: "active", archivedAt: null,
      createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", selections: {},
      assets: [
        { id: sourceId, kind: "source", sourceAssetId: null, generationSnapshotId: null, state: "available", filename: "充电宝-正面.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-09-14T00:00:00Z" },
        { id: "history-1", kind: "generated", sourceAssetId: sourceId, generationSnapshotId: null, state: "available", filename: "历史主图.png", mimeType: "image/png", byteSize: 2048, width: 1024, height: 1024, sha256: "c".repeat(64), createdAt: "2026-09-13T00:00:00Z" },
        ...(confirmed ? Array.from({ length: successfulSlots }, (_, index) => ({ id: `asset-${index + 1}`, kind: "generated", sourceAssetId: sourceId, generationSnapshotId: null, state: "available", filename: `生成结果${index + 1}.png`, mimeType: "image/png", byteSize: 2048, width: 1024, height: 1024, sha256: "c".repeat(64), createdAt: "2026-09-14T00:00:00Z" })).filter((asset) => !deletedIds.has(asset.id)) : []),
      ],
    } } });
  });
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/preview/asset-*", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/projects/proj-demo/assets/asset-5", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deletedIds.add("asset-5");
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/projects/proj-demo/generation-batches/compile", async (route) => {
    await route.fulfill({ status: 201, json: { data: { ...batch, status: "awaiting_confirmation" } } });
  });
  await page.route("**/api/projects/proj-demo/generation-batches/batch-1", async (route) => {
    const slots = confirmed ? Array.from({ length: 5 }, (_, index) => ({
      id: `slot-${index + 1}`, moduleTaskId: index < 3 ? "module-kv" : "module-scene", moduleKey: index < 3 ? "hero-kv" : "hero-scene",
      ordinal: index < 3 ? index + 1 : index - 2, status: index < successfulSlots ? "succeeded" : "queued", generatedAssetId: index < successfulSlots ? `asset-${index + 1}` : null,
      generatedAssetPreviewUrl: index < successfulSlots ? `/preview/asset-${index + 1}` : null, error: null,
    })) : [];
    await route.fulfill({ json: { data: {
      ...batch, status: confirmed ? (successfulSlots === 5 ? "succeeded" : "queued") : "awaiting_confirmation", confirmedAt: confirmed ? "2026-09-14T00:00:01Z" : null,
      completedAt: successfulSlots === 5 ? "2026-09-14T00:00:02Z" : null, modules, slots,
      progress: confirmed
        ? { total: 5, queued: 5 - successfulSlots, leased: 0, dispatching: 0, succeeded: successfulSlots, failed: 0, cancelled: 0, needsRetry: 0, completed: successfulSlots }
        : { total: 0, queued: 0, leased: 0, dispatching: 0, succeeded: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: 0 },
    } } });
  });
  await page.route("**/api/projects/proj-demo/generation-batches/batch-1/confirm", async (route) => {
    confirmCalls += 1;
    confirmed = true;
    await route.fulfill({ json: { data: {
      ...batch, status: "queued", confirmedAt: "2026-09-14T00:00:01Z", completedAt: null, modules, slots: [],
      progress: { total: 5, queued: 5, leased: 0, dispatching: 0, succeeded: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: 0 },
    } } });
  });

  await page.goto("/projects/proj-demo?tab=hero");
  await expect(page.getByRole("region", { name: "图片预览" }).getByText("历史主图.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
  await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
  await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
  await page.getByLabel("风格分类", { exact: true }).selectOption("digital");
  await page.getByRole("button", { name: /冷调精密/ }).click();
  await page.getByRole("button", { name: /首屏 KV 建立第一眼识别/ }).click();
  await page.getByRole("button", { name: /使用场景 呈现产品/ }).click();
  await page.getByLabel("首屏 KV生成张数").selectOption("3");
  await page.getByLabel("使用场景生成张数").selectOption("2");

  await page.getByRole("button", { name: "编译提示词" }).click();
  await expect(page.getByRole("heading", { name: "逐个检查模块实时任务提示词" })).toBeVisible();
  await expect(page.getByLabel("批次主图提示词确认").locator("textarea")).toHaveCount(2);
  await expect(page.getByText("淘宝平台约束").first()).not.toBeVisible();
  await page.getByText("查看固定约束与图片分析", { exact: true }).first().click();
  await expect(page.getByText("淘宝平台约束").first()).toBeVisible();
  await page.getByText("查看固定约束与图片分析", { exact: true }).first().click();
  await page.getByLabel("实时任务提示词").first().fill("产品主体居中，右侧留白");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("hero-confirmation-refined.png") });
  await page.getByText("提示词已就绪 · 检查并确认生成", { exact: true }).click();
  await expect(page.getByLabel("实时任务提示词").first()).not.toBeVisible();
  await expect(page.getByRole("region", { name: "图片预览" })).toBeInViewport();
  await page.getByText("提示词已就绪 · 检查并确认生成", { exact: true }).click();
  await expect(page.getByLabel("实时任务提示词").first()).toHaveValue("产品主体居中，右侧留白");
  await page.waitForTimeout(250);
  expect(confirmCalls).toBe(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "逐个检查模块实时任务提示词" })).toBeVisible();
  await expect(page.getByLabel("批次主图提示词确认").locator("textarea")).toHaveCount(2);

  await page.getByRole("button", { name: "确认并开始批次生成" }).click();
  await expect.poll(() => confirmCalls).toBe(1);
  await expect(page.locator(".generation-run-status")).toContainText("任务进度 · 0/5 · 0%");
  successfulSlots = 1;
  await expect(page.locator(".generation-run-status")).toContainText("任务进度 · 1/5 · 20%");
  await expect(page.locator(".generation-module-statuses")).toContainText("首屏 KV：33%");
  await expect(page.locator(".generation-module-statuses")).toContainText("使用场景：0%");
  successfulSlots = 5;
  await expect(page.locator(".generation-run-status")).toContainText("任务进度 · 5/5 · 100%");
  await expect(page.locator(".generation-module-statuses")).toContainText("首屏 KV：100%");
  await expect(page.locator(".generation-module-statuses")).toContainText("使用场景：100%");
  await page.getByText("批次进度与重试", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "成功 5 / 5" })).toBeVisible();
  await expect(page.locator(".hero-batch-slot")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "生成结果缩略图" }).getByRole("button")).toHaveCount(6);
  await page.getByRole("button", { name: "查看 历史主图.png", exact: true }).click();
  await expect(page.getByRole("region", { name: "图片预览" }).getByText("历史主图.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看 生成结果5.png", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除当前图片", exact: true }).click();
  await expect(page.getByRole("region", { name: "生成结果缩略图" }).getByRole("button")).toHaveCount(5);
  await page.reload();
  await expect(page.getByRole("region", { name: "生成结果缩略图" }).getByRole("button")).toHaveCount(5);
  await expect(page.locator(".generation-run-status")).toContainText("任务进度 · 5/5 · 100%");
});

for (const { entry, responseLoss } of [
  { entry: "重新编译提示词", responseLoss: false },
  { entry: "编译提示词", responseLoss: false },
  { entry: "重新编译提示词", responseLoss: true },
]) {
  test(`取消后通过${entry}创建新批次，单张重试不重新编译${responseLoss ? "，响应丢失后安全重试" : ""}`, async ({ page }) => {
    const config = createDefaultGenerationConfig();
    const compileKeys: string[] = [];
    const confirmKeys: string[] = [];
    const requests: unknown[] = [];
    let retries = 0;
    let lostResponse = false;
    const batches = new Map<string, ApiBatchGenerationDetail>();
    await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown;
      if (path === "/api/generation-config") {
        data = { id: "version-1", version: 1, content: config, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" };
      } else if (path === "/api/generation-worker/status") {
        data = { status: "online", lastSeenAt: null };
      } else if (path.endsWith("/preview")) {
        return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
      } else if (path === "/api/projects/proj-demo") {
        data = { id: "proj-demo", name: "批次测试", status: "active", archivedAt: null, selections: {}, createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", assets: [
          { id: "source-1", kind: "source", sourceAssetId: null, generationSnapshotId: null, state: "available", filename: "充电宝-正面.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-09-14T00:00:00Z" },
        ] };
      } else if (path.endsWith("/generation-batches/compile")) {
        const key = route.request().headers()["idempotency-key"];
        requests.push(route.request().postDataJSON());
        if (!compileKeys.includes(key)) {
          compileKeys.push(key);
          const id = `batch-${compileKeys.length}`;
          batches.set(id, {
            id, projectId: "proj-demo", sourceAssetId: "source-1", status: "awaiting_confirmation",
            createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: null, completedAt: null,
            modules: [{ id: `${id}-module`, moduleKey: "hero-kv", resultCount: 3, constraints: cards(), compiledTaskPrompt: `任务 ${id}`, visibleFacts: [], unconfirmedItems: [], confirmedTaskPrompt: null, finalPromptSha256: null }],
            slots: [], progress: { total: 0, queued: 0, leased: 0, dispatching: 0, succeeded: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: 0 },
          });
        }
        data = batches.get(`batch-${compileKeys.indexOf(key) + 1}`);
        if (responseLoss && !lostResponse && compileKeys.length === 2) {
          lostResponse = true;
          return route.abort("failed");
        }
      } else if (path.includes("/generation-batches/")) {
        const id = path.split("/generation-batches/")[1].split("/")[0];
        const batch = batches.get(id);
        if (!batch) return route.fulfill({ status: 404, json: {} });
        if (path.endsWith("/confirm")) {
          confirmKeys.push(route.request().headers()["idempotency-key"]);
          batch.status = "queued";
          batch.slots = Array.from({ length: 3 }, (_, index) => ({ id: `${id}-slot-${index}`, moduleTaskId: `${id}-module`, moduleKey: "hero-kv", ordinal: index + 1, status: "queued", generatedAssetId: null, generatedAssetPreviewUrl: null, error: null }));
          batch.progress = { ...batch.progress, total: 3, queued: 3 };
        } else if (path.endsWith("/cancel")) {
          batch.status = "cancelled";
          batch.slots.forEach((slot) => { slot.status = "cancelled"; });
          batch.progress = { ...batch.progress, queued: 0, cancelled: 3, completed: 3 };
        } else if (path.endsWith("/retry")) {
          retries += 1;
          batch.status = "queued";
          batch.slots[0].status = "queued";
          batch.progress = { ...batch.progress, queued: 1, cancelled: 2, completed: 2 };
          return route.fulfill({ json: { data: { slot: batch.slots[0] } } });
        }
        data = batch;
      } else {
        return route.fulfill({ json: { data: [] } });
      }
      await route.fulfill({ json: { data } });
    });
    await page.goto("/projects/proj-demo?tab=hero");
    await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
    await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
    await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
    await page.getByLabel("风格分类", { exact: true }).selectOption("digital");
    await page.getByRole("button", { name: /冷调精密/ }).click();
    await page.getByRole("button", { name: /首屏 KV 建立第一眼识别/ }).click();
    await page.getByLabel("首屏 KV生成张数").selectOption("3");
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    await page.getByRole("button", { name: "确认并开始批次生成" }).click();
    await page.getByRole("button", { name: "取消批次", exact: true }).click();
    await expect(page.locator(".generation-run-status")).toContainText("已取消 3 张");
    // 重试此张只走图片重试端点，保留同一份提示词。
    if (!(await page.getByRole("button", { name: "重试此张" }).first().isVisible())) {
      await page.getByText("批次进度与重试", { exact: true }).click();
    }
    await page.getByRole("button", { name: "重试此张" }).first().click();
    await expect.poll(() => retries).toBe(1);
    expect(requests).toHaveLength(1);
    await page.getByRole("button", { name: "取消批次", exact: true }).click();
    await expect(page.locator(".generation-run-status")).toContainText("已取消 3 张");
    await page.reload();
    await expect(page.locator(".generation-run-status")).toContainText("已取消 3 张");
    if (entry === "重新编译提示词" && !(await page.getByRole("button", { name: entry, exact: true }).isVisible())) {
      await page.getByText("批次进度与重试", { exact: true }).click();
    }
    await page.getByRole("button", { name: entry, exact: true }).click();
    if (responseLoss) {
      await expect(page.getByRole("alert")).toContainText("本次任务失败");
      await page.getByRole("button", { name: entry, exact: true }).click();
    }
    await expect(page.getByLabel("实时任务提示词")).toHaveValue("任务 batch-2");
    expect(compileKeys).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(batches.get("batch-1")?.status).toBe("cancelled");
    await page.getByRole("button", { name: "确认并开始批次生成" }).click();
    await expect.poll(() => confirmKeys.length).toBe(2);
    expect(confirmKeys[1]).not.toBe(confirmKeys[0]);
  });
}

function cards() {
  return {
    authenticity: { content: "保持商品真实性", source: "server_policy", contentSha256: "d".repeat(64) },
    market: { content: "淘宝平台约束", source: "market_guidance", contentSha256: "e".repeat(64) },
    style: { content: "冷调精密风格", source: "style_description", contentSha256: "f".repeat(64) },
  };
}

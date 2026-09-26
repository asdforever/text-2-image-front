import { expect, test, type Page } from "playwright/test";

import { createDefaultGenerationConfig } from "../../src/lib/generation-config";


async function recoverLegacyTask(page: Page, taskId: string) {
  await page.addInitScript((id) => {
    if (sessionStorage.getItem("legacy-task-ready")) return;
    localStorage.clear();
    localStorage.setItem("picagent-project-store", JSON.stringify({ state: { heroGenerationSessions: {
      "proj-demo": { taskId: id, inputFingerprint: "legacy", compileIdempotencyKey: "legacy-compile", confirmIdempotencyKey: "legacy-confirm" },
    } }, version: 0 }));
    sessionStorage.setItem("legacy-task-ready", "1");
  }, taskId);
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
}

test("恢复旧主图任务后仍需确认才能生图，并展示真实结果", async ({ page }) => {
  await recoverLegacyTask(page, "task-1");
  const config = createDefaultGenerationConfig();
  const sourceId = "source-1";
  const generatedId = "generated-1";
  let confirmCalls = 0;
  let includeGenerated = false;

  await page.route("**/api/generation-config", async (route) => {
    await route.fulfill({ json: { data: { id: "version-1", version: 1, content: config, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" }, requestId: "config-1" } });
  });
  await page.route("**/api/projects/proj-demo", async (route) => {
    const assets = [
      { id: sourceId, kind: "source", sourceAssetId: null, generationSnapshotId: null, state: "available", filename: "充电宝-正面.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-09-14T00:00:00Z" },
      ...(includeGenerated ? [{ id: generatedId, kind: "generated", sourceAssetId: sourceId, generationSnapshotId: "task-1", state: "available", filename: "首屏 KV.png", mimeType: "image/png", byteSize: 2048, width: 1024, height: 1024, sha256: "c".repeat(64), createdAt: "2026-09-14T00:00:01Z" }] : []),
    ];
    await route.fulfill({ json: { data: { id: "proj-demo", name: "演示项目", status: "active", archivedAt: null, createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", selections: {}, assets }, requestId: "project-1" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/compile", async (route) => {
    await route.fulfill({ status: 201, json: { data: {
      id: "task-1", projectId: "proj-demo", sourceAssetId: sourceId, status: "awaiting_confirmation", snapshot: {},
      constraints: { authenticity: { content: "保持商品真实性" }, market: { content: "淘宝平台约束" }, style: { content: "冷调精密风格" } },
      compiledTaskPrompt: "保留产品真实外观，主体居中。", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"],
      confirmedTaskPrompt: null, finalPrompt: null, finalPromptSha256: null, providerRequest: null, generatedAssetId: null, generatedAssetPreviewUrl: null, error: null,
      createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: null, completedAt: null,
    }, requestId: "task-1" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/task-1/confirm", async (route) => {
    confirmCalls += 1;
    includeGenerated = true;
    await route.fulfill({ json: { data: {
      id: "task-1", projectId: "proj-demo", sourceAssetId: sourceId, status: "succeeded", snapshot: {},
      constraints: { authenticity: { content: "保持商品真实性" }, market: { content: "淘宝平台约束" }, style: { content: "冷调精密风格" } },
      compiledTaskPrompt: "保留产品真实外观，主体居中。", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"],
      confirmedTaskPrompt: "用户补充：右侧留白", finalPrompt: "固定约束\\n用户补充：右侧留白", finalPromptSha256: "d".repeat(64), providerRequest: { n: 1 }, generatedAssetId: generatedId, generatedAssetPreviewUrl: `/api/projects/proj-demo/assets/${generatedId}/preview`, error: null,
      createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:02Z", confirmedAt: "2026-09-14T00:00:01Z", completedAt: "2026-09-14T00:00:02Z",
    }, requestId: "task-1" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/task-1", async (route) => {
    await route.fulfill({ json: { data: {
      id: "task-1", projectId: "proj-demo", sourceAssetId: sourceId, status: "awaiting_confirmation", snapshot: {},
      constraints: { authenticity: { content: "保持商品真实性" }, market: { content: "淘宝平台约束" }, style: { content: "冷调精密风格" } },
      compiledTaskPrompt: "保留产品真实外观，主体居中。", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"],
      confirmedTaskPrompt: null, finalPrompt: null, finalPromptSha256: null, providerRequest: null, generatedAssetId: null, generatedAssetPreviewUrl: null, error: null,
      createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: null, completedAt: null,
    }, requestId: "task-1" } });
  });
  await page.route("**/api/projects/proj-demo/assets/generated-1/preview", async (route) => {
    await route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
  });

  await page.goto("/projects/proj-demo?tab=hero");
  const confirmRequest = page.waitForRequest("**/api/projects/proj-demo/hero-generations/task-1/confirm").catch(() => null);
  await expect(page.getByText("商品真实性约束")).not.toBeVisible();
  await page.getByText("查看固定约束与图片分析", { exact: true }).click();
  await expect(page.getByText("商品真实性约束")).toBeVisible();
  expect(await Promise.race([confirmRequest, page.waitForTimeout(250).then(() => null)])).toBeNull();
  await page.reload();
  await page.getByText("查看固定约束与图片分析", { exact: true }).click();
  await expect(page.getByText("商品真实性约束")).toBeVisible();
  await page.getByLabel("实时任务提示词").fill("用户补充：右侧留白");
  await page.getByRole("button", { name: "确认并生成" }).click();
  await expect.poll(() => confirmCalls).toBe(1);
  await expect(page.getByText("本次生成快照")).toBeVisible();
  await expect(page.getByText(/最终提示词哈希/)).toBeVisible();
});


test("确认生图失败时展示安全错误且保留历史结果", async ({ page }) => {
  await recoverLegacyTask(page, "task-failed");
  const config = createDefaultGenerationConfig();
  const sourceId = "source-1";
  const historicalId = "generated-history";
  let confirmationFailed = false;

  await page.route("**/api/generation-config", async (route) => {
    await route.fulfill({ json: { data: { id: "version-1", version: 1, content: config, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" }, requestId: "config-1" } });
  });
  await page.route("**/api/projects/proj-demo", async (route) => {
    const assets = [
      { id: sourceId, kind: "source", sourceAssetId: null, generationSnapshotId: null, state: "available", filename: "充电宝-正面.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-09-14T00:00:00Z" },
      { id: historicalId, kind: "generated", sourceAssetId: sourceId, generationSnapshotId: "task-history", state: "available", filename: "历史主图.png", mimeType: "image/png", byteSize: 2048, width: 1024, height: 1024, sha256: "c".repeat(64), createdAt: "2026-09-13T00:00:00Z" },
    ];
    await route.fulfill({ json: { data: { id: "proj-demo", name: "演示项目", status: "active", archivedAt: null, createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", selections: {}, assets }, requestId: "project-1" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/compile", async (route) => {
    await route.fulfill({ status: 201, json: { data: {
      id: "task-failed", projectId: "proj-demo", sourceAssetId: sourceId, status: "awaiting_confirmation", snapshot: {},
      constraints: { authenticity: { content: "保持商品真实性" }, market: { content: "淘宝平台约束" }, style: { content: "冷调精密风格" } },
      compiledTaskPrompt: "保留产品真实外观，主体居中。", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"],
      confirmedTaskPrompt: null, finalPrompt: null, finalPromptSha256: null, providerRequest: null, generatedAssetId: null, generatedAssetPreviewUrl: null, error: null,
      createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: null, completedAt: null,
    }, requestId: "task-failed" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/task-failed/confirm", async (route) => {
    confirmationFailed = true;
    await route.fulfill({ status: 502, json: { error: { code: "IMAGE_PROVIDER_FAILED", message: "图片生成服务暂时不可用，请稍后重试" }, requestId: "confirm-failed" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/task-failed", async (route) => {
    await route.fulfill({ json: { data: {
      id: "task-failed", projectId: "proj-demo", sourceAssetId: sourceId, status: confirmationFailed ? "failed" : "awaiting_confirmation", snapshot: {},
      constraints: { authenticity: { content: "保持商品真实性" }, market: { content: "淘宝平台约束" }, style: { content: "冷调精密风格" } },
      compiledTaskPrompt: "保留产品真实外观，主体居中。", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"],
      confirmedTaskPrompt: confirmationFailed ? "保留产品真实外观，主体居中。" : null,
      finalPrompt: confirmationFailed ? "固定约束" : null,
      finalPromptSha256: confirmationFailed ? "f".repeat(64) : null,
      providerRequest: confirmationFailed ? { n: 1 } : null,
      generatedAssetId: null, generatedAssetPreviewUrl: null,
      error: confirmationFailed ? { code: "IMAGE_PROVIDER_FAILED", message: "图片生成服务暂时不可用，请稍后重试" } : null,
      createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:01Z", confirmedAt: "2026-09-14T00:00:01Z", completedAt: "2026-09-14T00:00:01Z",
    }, requestId: "task-failed" } });
  });
  await page.route("**/api/projects/proj-demo/hero-generations/task-history", async (route) => {
    await route.fulfill({ json: { data: {
      id: "task-history", projectId: "proj-demo", sourceAssetId: sourceId, status: "succeeded", generatedAssetId: historicalId,
      snapshot: { selection: { module: { id: "hero-kv", label: "历史首屏 KV" }, modelPreset: { label: "历史模型" }, aspectRatio: "16:9", resolution: "超清 4K", style: { label: "历史风格" } } },
      constraints: { authenticity: { content: "保持商品真实性" }, market: { content: "淘宝平台约束" }, style: { content: "历史风格约束" } },
      compiledTaskPrompt: "历史任务", visibleFacts: [], unconfirmedItems: [], confirmedTaskPrompt: "历史任务", finalPrompt: "历史提示词", finalPromptSha256: "e".repeat(64), providerRequest: { n: 1 }, generatedAssetPreviewUrl: `/api/projects/proj-demo/assets/${historicalId}/preview`, error: null,
      createdAt: "2026-09-13T00:00:00Z", updatedAt: "2026-09-13T00:00:00Z", confirmedAt: "2026-09-13T00:00:00Z", completedAt: "2026-09-13T00:00:00Z",
    }, requestId: "task-history" } });
  });
  await page.route(`**/api/projects/proj-demo/assets/${historicalId}/preview`, async (route) => {
    await route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
  });

  await page.goto("/projects/proj-demo?tab=hero");
  await expect(page.getByRole("region", { name: "图片预览" }).getByText("历史主图.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "图片预览" })).toContainText("历史模型 · 历史风格");
  await page.getByText("查看固定约束与图片分析", { exact: true }).click();
  await expect(page.getByText("商品真实性约束")).toBeVisible();
  await page.getByRole("button", { name: "确认并生成" }).click();

  await expect(page.locator(".hero-generation-error")).toContainText("图片生成服务暂时不可用，请稍后重试");
  await expect(page.getByRole("region", { name: "图片预览" }).getByText("历史主图.png", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("图片生成服务暂时不可用，请稍后重试");
});

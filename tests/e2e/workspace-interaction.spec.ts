import { test, expect } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

test.beforeEach(async ({ page }) => {
  const now = "2026-09-24T08:00:00Z";
  const assets = [{ id: "source", kind: "source", state: "available", filename: "商品.png", width: 1000, height: 1000, createdAt: now }];
  await page.route("**/api/**", route => new URL(route.request().url()).pathname.startsWith("/api/") ? route.fulfill({ status: 404, json: { error: { message: "无记录" } } }) : route.fallback());
  await page.route("**/api/projects/proj-ui", route => route.fulfill({ json: { data: { id: "proj-ui", name: "交互验收项目", status: "active", updatedAt: now, createdAt: now, selections: {}, assets } } }));
  await page.route("**/api/projects/proj-ui/assets", route => route.fulfill({ json: { data: assets } }));
  await page.route("**/api/projects/proj-ui/assets/*/preview", route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/generation-config", route => route.fulfill({ json: { data: { id: "published", version: 1, content: createDefaultGenerationConfig(), contentSha256: "a".repeat(64) } } }));
  await page.route("**/api/suites/proj-ui/workbench", route => route.fulfill({ json: { data: { suite: { id: "proj-ui", name: "交互验收项目" }, tasks: [], inputImages: [], batches: [], generationSteps: [], layout: null } } }));
});

test("canvas remains inside project navigation and preserves local controls across tabs", async ({ page }) => {
  await page.goto("/projects/proj-ui?tab=canvas");
  await expect(page.getByLabel("输出类型")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "主导航" })).toBeVisible();
  await expect(page.getByLabel("图片画布", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "画布模块类型", exact: true }).selectOption("unassigned");
  await page.getByLabel("输出类型").getByRole("button", { name: "白底图", exact: true }).click();
  await page.getByLabel("输出类型").getByRole("button", { name: "画布", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "画布模块类型", exact: true })).toHaveValue("unassigned");
  await expect(page).toHaveURL(/projects\/proj-ui\?tab=canvas/);
});

test("legacy canvas link resolves to the embedded project canvas", async ({ page }) => {
  await page.goto("/suites/proj-ui/board");
  await expect(page).toHaveURL(/projects\/proj-ui\?tab=canvas/);
  await expect(page.getByLabel("输出类型")).toBeVisible();
});

test("both generation tabs omit reference suite inputs", async ({ page }) => {
  await page.goto("/projects/proj-ui?tab=hero");
  await expect(page.getByRole("complementary", { name: "生成配置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "选择参考套图" })).toHaveCount(0);
  await page.getByLabel("输出类型").getByRole("button", { name: "详情套图", exact: true }).click();
  await expect(page.getByLabel("详情页商品资料")).toBeVisible();
  await expect(page.getByLabel("上传参考套图")).toHaveCount(0);
});

test("legacy hero results restore their original task parameters", async ({ page }) => {
  await page.route("**/api/projects/proj-ui", route => route.fulfill({ json: { data: {
    id: "proj-ui", name: "历史项目", status: "active", selections: {},
    assets: [{ id: "legacy-image", kind: "generated", state: "available", filename: "old.png", generationSnapshotId: "old-task", width: 1024, height: 1024 }],
  } } }));
  await page.route("**/api/projects/proj-ui/hero-generations/old-task", route => route.fulfill({ json: { data: {
    id: "old-task", projectId: "proj-ui", sourceAssetId: "source", generatedAssetId: "legacy-image",
    snapshot: { selection: { aspectRatio: "1:1", style: { label: "旧单图风格" }, modelPreset: { label: "旧单图模型" } } },
  } } }));
  await page.goto("/projects/proj-ui?tab=hero");
  await expect(page.getByLabel("查看生成批次")).toHaveValue("hero-task:old-task");
  await expect(page.getByLabel("图片预览")).toContainText("旧单图风格");
  await expect(page.getByLabel("图片预览")).toContainText("旧单图模型");
});

test("new task status is separate from old results and completion does not steal image selection", async ({ page }, testInfo) => {
  await page.clock.install();
  const now = "2026-09-24T08:00:00Z";
  let complete = false;
  let submissions = 0;
  page.on("request", request => { if (request.method() === "POST") submissions++; });
  const asset = (id: string) => ({ id, kind: "generated", state: "available", filename: `batch-${id}.png`, width: 1086, height: 1448, createdAt: now });
  await page.addInitScript(() => localStorage.setItem("picagent-project-store", JSON.stringify({ state: {
    heroGenerationSessions: { "proj-ui": { inputFingerprint: "test", compileIdempotencyKey: "compile-new", confirmIdempotencyKey: "confirm-new", batchId: "new-batch" } },
  }, version: 0 })));
  await page.route("**/api/projects/proj-ui", route => route.fulfill({ json: { data: { id: "proj-ui", name: "交互验收项目", status: "active", createdAt: now, updatedAt: now, selections: {}, assets: [asset("old-1"), asset("old-2"), ...(complete ? [asset("new-1")] : [])] } } }));
  await page.route("**/api/suites/proj-ui/workbench", route => route.fulfill({ json: { data: {
    suite: { id: "proj-ui", name: "交互验收项目" }, tasks: [], inputImages: [], layout: null,
    generationSteps: [{ id: "old-module", batchId: "old-batch", batchCreatedAt: now, kind: "hero", title: "产品细节", outputAssetIds: ["old-1", "old-2"], finalPrompt: "历史批次生成提示词：突出真实 DPI 参数与鼠标细节", taskPrompt: "", constraints: {}, parameters: { aspectRatio: "3:4", style: { label: "旧批次风格" } } }],
  } } }));
  await page.route("**/api/projects/proj-ui/generation-batches/new-batch", route => route.fulfill({ json: { data: {
    id: "new-batch", kind: "hero", projectId: "proj-ui", createdAt: now, updatedAt: now, status: complete ? "succeeded" : "compiling_prompt",
    modules: [{ id: "new-module", moduleKey: "hero-detail", moduleLabel: "新细节图", resultCount: 1, constraints: {}, compiledTaskPrompt: "历史批次生成提示词：突出真实 DPI 参数与鼠标细节", confirmedTaskPrompt: null, finalPromptSha256: null, visibleFacts: [], unconfirmedItems: [] }],
    slots: complete ? [{ id: "new-slot", moduleTaskId: "new-module", moduleKey: "hero-detail", ordinal: 1, status: "succeeded", generatedAssetId: "new-1", generatedAssetPreviewUrl: "/api/projects/proj-ui/assets/new-1/preview", error: null }] : [],
    progress: { total: 1, succeeded: complete ? 1 : 0, queued: 0, leased: 0, dispatching: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: complete ? 1 : 0 },
  } } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/proj-ui?tab=hero");
  await expect(page.getByLabel("当前任务状态")).toContainText("正在编译提示词");
  await expect(page.getByLabel("查看生成批次")).toHaveValue("old-batch");
  await expect(page.getByText("新任务正在处理，当前展示已有结果；图片数量不代表新任务进度。")).toBeVisible();
  await page.getByRole("button", { name: "查看 batch-old-1.png", exact: true }).click();
  const preview = page.getByLabel("图片预览").locator(".studio-stage-image");
  await expect(preview).toHaveAttribute("src", /old-1\/preview$/);
  await expect(page.getByLabel("图片预览")).toContainText("实际尺寸 1086x1448");
  await expect(page.getByLabel("图片预览")).toContainText("旧批次风格");
  await expect(page.getByLabel("图片预览")).toContainText("生成提示词");
  await expect(page.getByLabel("图片预览")).toContainText("突出真实 DPI 参数与鼠标细节");
  complete = true;
  await page.clock.runFor(3500);
  await expect(page.getByLabel("当前任务状态")).toContainText("本次任务已完成");
  await expect(page.getByLabel("查看生成批次").locator("option[value='new-batch']")).toHaveCount(1);
  await expect(preview).toHaveAttribute("src", /old-1\/preview$/);
  await expect(page.getByLabel("查看生成批次")).toHaveValue("old-batch");
  expect(submissions).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("result-batches-desktop.png"), fullPage: true });
});

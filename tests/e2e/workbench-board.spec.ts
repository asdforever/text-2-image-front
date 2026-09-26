import { expect, test, type Page } from "playwright/test";

// Legacy board links now load the project shell before the embedded canvas.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/projects/proj-demo", route => route.fulfill({ json: { data: {
    id: "proj-demo", name: "画布测试项目", status: "active", assets: [], selections: {},
    createdAt: "2026-09-24T08:00:00Z", updatedAt: "2026-09-24T08:00:00Z",
  } } }));
});

const now = "2026-09-14T00:00:00Z";

test("画布加载失败显示可重试错误，重试成功后恢复画布", async ({ page }) => {
  await page.route("**/api/projects/proj-demo/assets", (route) => route.fulfill({ json: { data: [] } }));
  let unavailable = true;
  const state = createState();
  await page.route("**/api/suites/proj-demo/workbench", (route) => unavailable
    ? route.fulfill({ status: 502, json: { error: { code: "UNAVAILABLE", message: "画布服务暂时不可用" } } })
    : route.fulfill({ json: { data: state.workbench } }));
  await page.goto("/suites/proj-demo/board");
  await expect(page.getByRole("alert")).toContainText("画布服务暂时不可用");
  await expect(page.getByText("正在恢复套图工作台…", { exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await expect(page.getByText("首屏详情", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("画布响应超过轮询周期时仍能打开且不重复请求", async ({ page }) => {
  const state = createState();
  let requests = 0;
  await page.route("**/api/projects/proj-demo/assets", route => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/suites/proj-demo/workbench", async route => {
    requests++;
    await new Promise(resolve => setTimeout(resolve, 9500));
    await route.fulfill({ json: { data: state.workbench } });
  });
  await page.goto("/projects/proj-demo?tab=canvas");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 14000 });
  expect(requests).toBe(1);
});

test("工作台支持编辑、拖动、刷新恢复和版本选择且不调用真实 Provider", async ({ page }) => {
  const state = createState();
  const calls = { layout: 0, update: 0, select: 0, provider: 0 };
  await page.addInitScript(() => window.localStorage.clear());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/projects/proj-demo/assets", (route) => route.fulfill({ json: { data: [] } }));

  await page.route("**/api/suites/proj-demo/workbench", async (route) => {
    await route.fulfill({ json: { data: state.workbench } });
  });
  await page.route("**/api/suite-tasks/task-1", async (route) => {
    calls.update += 1;
    const body = route.request().postDataJSON() as { promptDraft?: string };
    if (body.promptDraft) state.workbench.tasks[0].promptDraft = body.promptDraft;
    state.workbench.tasks[0].promptRevision += 1;
    await route.fulfill({ json: { data: state.workbench.tasks[0] } });
  });
  await page.route("**/api/suites/proj-demo/workbench/layout", async (route) => {
    calls.layout += 1;
    const body = route.request().postDataJSON() as typeof state.layout;
    state.layout = { ...state.layout, ...body, layoutVersion: state.layout.layoutVersion + 1 };
    state.workbench.layout = state.layout;
    await route.fulfill({ json: { data: state.layout } });
  });
  await page.route("**/api/suite-tasks/task-1/versions/ver-2/select", async (route) => {
    calls.select += 1;
    const body = route.request().postDataJSON() as { selection: "current" | "final" };
    const versions = state.workbench.tasks[0].versions;
    versions.forEach((version) => { version.isCurrent = body.selection === "current" ? version.id === "ver-2" : version.isCurrent; version.isFinal = body.selection === "final" ? version.id === "ver-2" : version.isFinal; });
    await route.fulfill({ json: { data: versions[1] } });
  });
  await page.route("**/v1/**", async (route) => { calls.provider += 1; await route.abort(); });
  await page.route("**/api/**/generation", async (route) => { calls.provider += 1; await route.abort(); });

  await page.goto("/suites/proj-demo/board");
  await expect(page.getByText("首屏详情", { exact: true }).first()).toBeVisible();
  await page.locator('.react-flow__node[data-id="task:task-1"]').click();
  await expect(page.locator(".ic-detail-title h2")).toHaveText("首屏详情");

  await page.getByRole("textbox", { name: "提示词草稿" }).fill("更新后的详情页提示词");
  await page.getByRole("button", { name: "保存提示词" }).dispatchEvent("click");
  await expect.poll(() => calls.update).toBe(1);

  const taskNode = page.locator(".ic-image-node").filter({ hasText: "首屏详情" }).first();
  const before = await taskNode.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + 100, before!.y + 100);
  await page.mouse.down();
  await page.mouse.move(before!.x + 180, before!.y + 140, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => calls.layout).toBeGreaterThan(0);
  expect(state.layout.nodes.find((node) => node.nodeId === "task:task-1")?.x).toBeGreaterThan(400);

  await page.getByLabel("选择首屏详情版本").selectOption("ver-2");
  await page.getByRole("button", { name: "设为当前" }).click();
  await expect(page.getByRole("status")).toContainText("已切换当前版本");
  expect(calls.select).toBe(1);

  await page.reload();
  await page.locator('.react-flow__node[data-id="task:task-1"]').click();
  await expect(page.getByRole("textbox", { name: "提示词草稿" })).toHaveValue("更新后的详情页提示词");
  await expect(page.getByLabel("选择首屏详情版本")).toHaveValue("ver-2");
  expect(state.workbench.layout.nodes.find((node) => node.nodeId === "task:task-1")?.x).toBeGreaterThan(400);
  expect(calls.provider).toBe(0);
});

function createState() {
  const inputImage = { id: "source-1", suiteId: "proj-demo", ordinal: 1, originalObjectKey: "", thumbnailObjectKey: "", sha256: "b".repeat(64), width: 1200, height: 800, mimeType: "image/png", originalFilename: "产品图.png", currentBaseVersionId: null, createdAt: now, originalPreviewUrl: "", thumbnailPreviewUrl: "" };
  const versions = [
    { id: "ver-1", taskId: "task-1", slotId: "slot-1", attemptId: "attempt-1", versionNumber: 1, objectKey: "", processObjectKeys: [], sha256: "a".repeat(64), width: 1024, height: 1024, mimeType: "image/png", promptSnapshot: { finalPrompt: "v1 提示词" }, contextSnapshot: {}, isCurrent: true, isFinal: false, createdAt: now, previewUrl: "/fixture/v1.png" },
    { id: "ver-2", taskId: "task-1", slotId: "slot-1", attemptId: "attempt-2", versionNumber: 2, objectKey: "", processObjectKeys: [], sha256: "c".repeat(64), width: 1024, height: 1024, mimeType: "image/png", promptSnapshot: { finalPrompt: "v2 提示词" }, contextSnapshot: {}, isCurrent: false, isFinal: false, createdAt: now, previewUrl: "/fixture/v2.png" },
  ];
  const task = { id: "task-1", suiteId: "proj-demo", planSnapshotId: "plan-1", planItemId: "item-1", ordinal: 1, imageType: "detail", title: "首屏详情", purpose: "展示核心卖点", promptDraft: "初始提示词", promptRevision: 1, sourceInputImageId: null, generationParams: { ratio: "1:1", size: "1K", quality: "medium", model: "gpt-image-2" }, status: "generated", archivedAt: null, createdAt: now, updatedAt: now, versions, attempts: [], slots: [] };
  const layout = { id: "layout-1", suiteId: "proj-demo", layoutVersion: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [{ nodeId: "style:global", x: 36, y: 30 }, { nodeId: "task:task-1", x: 400, y: 30 }], groups: [], updatedAt: now };
  const workbench = { suite: { id: "proj-demo", name: "演示项目", status: "in_progress", createdAt: now, updatedAt: now, inputImages: [] }, inputImages: [inputImage], planSnapshot: { id: "plan-1", revisionNumber: 1, revisionKind: "human", templateVersionId: "template-1", dynamicInput: {}, humanInput: {}, chunks: [], inputImageIds: ["source-1"], provider: { name: "fake", model: "fake", isFake: true }, items: [{ id: "item-1", ordinal: 1, imageType: "detail", title: "首屏详情", purpose: "展示核心卖点", prompt: "初始提示词" }], confirmationStatus: "confirmed", createdAt: now }, tasks: [task], batches: [], references: [], layout };
  return { workbench, layout };
}

import { test, expect } from "playwright/test";

test("首页仅用项目摘要显示封面和数量，不等待项目详情", async ({ page }) => {
  let detailReads = 0;
  await page.route("**/api/projects", route => route.fulfill({ json: { data: [{
    id: "summary-only", name: "轻量项目", status: "active", archivedAt: null,
    createdAt: "2026-09-25T00:00:00Z", updatedAt: "2026-09-25T00:00:00Z",
    assetCount: 25, coverAssetId: "cover",
  }] } }));
  await page.route("**/api/projects/summary-only", route => {
    detailReads++;
    return route.fulfill({ status: 503, json: { error: { message: "不应读取详情" } } });
  });
  await page.route("**/api/projects/summary-only/assets/cover/preview", route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: { projects: [] } } }));
  await page.goto("/workspace");
  const card = page.getByRole("button", { name: /轻量项目/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("25 张图片");
  await expect(card.locator("img")).toHaveAttribute("src", "/api/projects/summary-only/assets/cover/preview");
  expect(detailReads).toBe(0);
});

test("首页展示真实任务并保留独立新建入口", async ({ page }) => {
  const project = { id: "home-project", name: "充电器项目", status: "active", updatedAt: "2026-09-24T08:00:00Z", createdAt: "2026-09-24T08:00:00Z", assets: [], selections: {} };
  await page.route("**/api/projects", route => route.fulfill({ json: { data: [project] } }));
  await page.route("**/api/projects/home-project", route => route.fulfill({ json: { data: project } }));
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: { projects: [{ projectId: project.id, projectName: project.name, tasks: [{ id: "task", projectId: project.id, projectName: project.name, type: "suite", workbenchTab: "suite", status: "partially_failed", updatedAt: project.updatedAt, progress: { total: 10, succeeded: 5, failed: 5, cancelled: 0 } }] }] } } }));
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "图片工作室" })).toBeVisible();
  await expect(page.getByLabel("任务动态")).toContainText("部分失败");
  await expect(page.getByLabel("任务动态")).toContainText("5/10");
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "创建项目" })).toBeVisible();
});

test("旧接口兜底也使用生成结果作为封面", async ({ page }) => {
  const project = { id: "legacy-home", name: "旧接口项目", status: "active", archivedAt: null, createdAt: "2026-09-25T00:00:00Z", updatedAt: "2026-09-25T00:00:00Z" };
  await page.route("**/api/projects", route => route.fulfill({ json: { data: [project] } }));
  await page.route("**/api/projects/legacy-home", route => route.fulfill({ json: { data: {
    ...project, selections: {}, assets: [
      { id: "source", kind: "source", state: "available" },
      { id: "result", kind: "generated", state: "available" },
    ],
  } } }));
  await page.route("**/api/projects/legacy-home/assets/result/preview", route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: { projects: [] } } }));
  await page.goto("/workspace");
  const card = page.getByRole("button", { name: /旧接口项目/ });
  await expect(card).toContainText("2 张图片");
  await expect(card.locator("img")).toHaveAttribute("src", "/api/projects/legacy-home/assets/result/preview");
});

test("创建失败可重试，保留填写的项目名称", async ({ page }) => {
  let creates = 0;
  const project = { id: "retry-project", name: "我的商品", status: "active", assetCount: 0, coverAssetId: null, createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z", assets: [], selections: {} };
  await page.route("**/api/projects", route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
    creates++;
    expect(route.request().postDataJSON().name).toBe("我的商品");
    return creates === 1 ? route.fulfill({ status: 503, json: { error: { message: "创建暂时失败" } } }) : route.fulfill({ json: { data: project } });
  });
  await page.route("**/api/projects/retry-project", route => route.fulfill({ json: { data: project } }));
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: { projects: [] } } }));
  await page.goto("/workspace");
  await page.getByRole("button", { name: "商品图创作", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("我的商品");
  await page.getByRole("button", { name: "创建并进入工作台" }).click();
  await expect(page.getByRole("alert")).toContainText("创建暂时失败");
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue("我的商品");
  await page.getByRole("button", { name: "创建并进入工作台" }).click();
  await expect(page).toHaveURL(/\/projects\/retry-project\?tab=base$/);
  expect(creates).toBe(2);
});

test("创建等待期间禁止重复提交", async ({ page }) => {
  let creates = 0;
  let releaseCreate!: () => void;
  const pending = new Promise<void>(resolve => { releaseCreate = resolve; });
  const project = { id: "created-project", name: "我的商品", status: "active", assetCount: 0, coverAssetId: null, updatedAt: "2026-10-13T00:00:00Z", createdAt: "2026-10-13T00:00:00Z", assets: [], selections: {} };
  await page.route("**/api/projects", async route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
    creates++;
    await pending;
    return route.fulfill({ json: { data: project } });
  });
  await page.route("**/api/projects/created-project", route => route.fulfill({ json: { data: project } }));
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: { projects: [] } } }));
  await page.goto("/workspace");
  await page.getByRole("button", { name: "商品图创作", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("我的商品");
  await page.getByRole("button", { name: "创建并进入工作台" }).click();
  try {
    await expect.poll(() => creates).toBe(1);
    await expect(page.getByRole("button", { name: "创建中…" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  } finally { releaseCreate(); }
  await expect(page).toHaveURL(/\/projects\/created-project\?tab=base$/);
  expect(creates).toBe(1);
});

test("任务服务失败与项目刷新失败均不移除已显示项目", async ({ page }) => {
  const project = { id: "retained", name: "保留的项目", status: "active", updatedAt: "2026-09-24T08:00:00Z", createdAt: "2026-09-24T08:00:00Z", assets: [], selections: {} };
  let reads = 0;
  await page.route("**/api/projects", route => {
    reads++;
    return reads === 1 ? route.fulfill({ json: { data: [project] } }) : route.fulfill({ status: 503, json: { error: { message: "项目刷新失败" } } });
  });
  await page.route("**/api/projects/retained", route => route.fulfill({ json: { data: project } }));
  await page.route("**/api/task-center", route => route.fulfill({ status: 503, json: { error: { message: "任务服务失败" } } }));
  await page.goto("/workspace");
  await expect(page.getByRole("button", { name: /保留的项目/ })).toBeVisible();
  await expect(page.getByLabel("任务动态")).toContainText("任务动态暂时不可用");
  await page.getByRole("button", { name: "刷新项目", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("项目刷新失败");
  await expect(page.getByRole("button", { name: /保留的项目/ })).toBeVisible();
});


test("C 工作台中等宽度导航可见且白底图各行不重叠", async ({ page }) => {
  const now = "2026-09-24T00:00:00Z";
  const assets = Array.from({ length: 6 }, (_, i) => ({ id: `asset-${i}`, kind: "source", state: "available", filename: `商品-${i}.png`, mimeType: "image/png", byteSize: 68, width: 1000, height: 1000, createdAt: now }));
  await page.route("**/api/projects/c-layout", route => route.fulfill({ json: { data: { id: "c-layout", name: "布局项目", status: "active", createdAt: now, updatedAt: now, selections: {}, assets } } }));
  await page.route("**/api/projects/c-layout/assets/*/preview", route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/c-layout?tab=base");
  const cards = page.locator(".base-card");
  await expect(cards).toHaveCount(6);
  await expect.poll(async () => {
    const first = await cards.nth(0).boundingBox(), secondRow = await cards.nth(2).boundingBox();
    return secondRow!.y - first!.y - first!.height;
  }).toBeGreaterThanOrEqual(0);
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.getByRole("link", { name: "首页", exact: true }).locator("svg")).toBeVisible();
});

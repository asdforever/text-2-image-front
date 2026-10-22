import { expect, test } from "playwright/test";

const projectId = "469b8a98-c5b1-4e08-8aae-f904b1498cf3";
const projectDetail = {
  id: projectId,
  name: "真实最近项目",
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-16T00:00:00Z",
  updatedAt: "2026-09-16T01:00:00Z",
  assets: [],
  selections: {},
};

test("工作台最近项目使用真实项目 ID 进入项目", async ({ page }) => {
  let listCalls = 0;
  await page.addInitScript(() => window.localStorage.clear());
  await page.route(url => url.pathname === "/api/projects", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    listCalls += 1;
    await route.fulfill({ json: { data: [projectDetail] } });
  });
  await page.route(`**/api/projects/${projectId}`, async (route) => {
    await route.fulfill({ json: { data: projectDetail } });
  });

  await page.goto("/workspace");
  await expect.poll(() => listCalls).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /真实最近项目/ })).toBeVisible();
  await expect(page.locator(".project-thumb img")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "搜索项目" }).fill("不存在的名称");
  await expect(page.getByRole("button", { name: /真实最近项目/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "搜索项目" }).fill("");
  await page.getByRole("button", { name: /真实最近项目/ }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}\\?tab=base$`));
  await expect(page.getByText("真实最近项目").first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "主导航" }).locator('[aria-current="page"]')).toHaveCount(1);
});

test("项目列表后台刷新失败时保留当前内容", async ({ page }) => {
  let listCalls = 0;
  await page.route(url => url.pathname === "/api/projects", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    listCalls += 1;
    if (listCalls > 1) return route.fulfill({ status: 503, json: { error: { message: "项目服务暂时不可用" } } });
    await route.fulfill({ json: { data: [projectDetail] } });
  });
  await page.route(`**/api/projects/${projectId}/archive`, (route) => route.fulfill({ json: { data: projectDetail } }));

  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: projectDetail.name })).toBeVisible();
  await page.getByRole("button", { name: "归档", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("项目服务暂时不可用");
  await expect(page.getByRole("heading", { name: projectDetail.name })).toBeVisible();
});

test("删除等待期间显示进度并禁止重复提交", async ({ page }) => {
  let deleteCalls = 0;
  let releaseDelete!: () => void;
  const deletion = new Promise<void>((resolve) => { releaseDelete = resolve; });
  await page.route(url => url.pathname === "/api/projects", (route) => route.fulfill({ json: { data: [projectDetail] } }));
  await page.route(`**/api/projects/${projectId}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deleteCalls += 1;
    await deletion;
    await route.fulfill({ status: 204 });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/projects");
  await page.getByRole("button", { name: "删除", exact: true }).click();
  try {
    await expect.poll(() => deleteCalls).toBe(1);
    await expect(page.getByRole("button", { name: "删除中…", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "归档", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "进入工作台", exact: true })).toBeDisabled();
  } finally {
    releaseDelete();
  }
});

test("删除成功立即移除卡片，列表刷新失败也不恢复已删除项目", async ({ page }) => {
  let listCalls = 0;
  let releaseRefresh!: () => void;
  const refresh = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  await page.route(url => url.pathname === "/api/projects", async (route) => {
    listCalls += 1;
    if (listCalls === 1) return route.fulfill({ json: { data: [projectDetail] } });
    await refresh;
    await route.fulfill({ status: 503, json: { error: { message: "项目服务暂时不可用" } } });
  });
  await page.route(`**/api/projects/${projectId}`, (route) => route.fulfill({ status: 204 }));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/projects");
  await page.getByRole("button", { name: "删除", exact: true }).click();
  try {
    await expect.poll(() => listCalls).toBe(2);
    await expect(page.getByRole("heading", { name: projectDetail.name })).toHaveCount(0);
  } finally {
    releaseRefresh();
  }
  await expect(page.getByRole("alert")).toContainText("项目服务暂时不可用");
  await expect(page.getByRole("heading", { name: projectDetail.name })).toHaveCount(0);
});

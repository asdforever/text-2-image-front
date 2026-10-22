import { expect, test } from "playwright/test";

const project = {
  id: "reference-project", name: "商品创作测试", status: "active", archivedAt: null,
  createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T01:00:00Z",
  assetCount: 0, coverAssetId: null,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/projects" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      return route.fulfill({ json: { data: { ...project, name: body.name } } });
    }
    if (path === "/api/projects") return route.fulfill({ json: { data: [project] } });
    if (path === "/api/task-center") return route.fulfill({ json: { data: { projects: [] } } });
    if (path === "/api/projects/reference-project") return route.fulfill({ json: { data: { ...project, assets: [], selections: {} } } });
    return route.fulfill({ json: { data: null } });
  });
});

test("商品图入口创建项目后进入素材工作台", async ({ page }) => {
  await page.goto("/workspace");
  await page.getByRole("button", { name: "商品图创作", exact: true }).click();
  await page.getByRole("textbox", { name: "项目名称" }).fill("商品图入口测试");
  await page.getByRole("button", { name: "创建并进入工作台" }).click();
  await expect(page).toHaveURL(/projects\/reference-project\?tab=base$/);
});

test("下一步推荐显示最近项目任务进度并进入对应工作台", async ({ page }) => {
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: { projects: [{
    projectId: project.id, projectName: project.name,
    tasks: [{ id: "next-task", projectId: project.id, projectName: project.name,
      type: "suite", workbenchTab: "suite", status: "succeeded", updatedAt: project.updatedAt,
      progress: { total: 5, succeeded: 5, failed: 0, cancelled: 0 } }],
  }] } } }));
  await page.goto("/workspace");
  const recommendation = page.getByRole("region", { name: "下一步推荐", exact: true });
  await expect(recommendation).toContainText(`继续处理「${project.name}」`);
  await expect(recommendation).toContainText("详情套图 · 已完成");
  await expect(recommendation).toContainText("5 / 5 张已完成");
  await expect(recommendation.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
  await recommendation.getByRole("button", { name: "进入项目", exact: true }).click();
  await expect(page).toHaveURL(/projects\/reference-project\?tab=suite$/);
});

test("无任务的最近项目仍可从推荐进入素材工作台", async ({ page }) => {
  await page.goto("/workspace");
  const recommendation = page.getByRole("region", { name: "下一步推荐", exact: true });
  await recommendation.getByRole("button", { name: "进入项目", exact: true }).click();
  await expect(page).toHaveURL(/projects\/reference-project\?tab=base$/);
});

test("没有项目时推荐卡提供创建入口", async ({ page }) => {
  await page.route("**/api/projects", route => route.fulfill({ json: { data: [] } }));
  await page.goto("/workspace");
  const recommendation = page.getByRole("region", { name: "下一步推荐", exact: true });
  await recommendation.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "创建项目" })).toBeVisible();
});

test("左侧新建项目无需离开当前页面", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("complementary", { name: "主导航" }).getByRole("button", { name: "新建项目", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "创建项目" })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});

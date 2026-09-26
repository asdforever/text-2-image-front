import { expect, test } from "playwright/test";

test("任务中心按项目分组展示主图和详情套图，并且只读刷新", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/task-center", route => route.fulfill({ json: { data: {
    projects: [
      { projectId: "p-current", projectName: "当前项目", projectStatus: "active", updatedAt: "2026-09-21T12:00:00Z", tasks: [{ id: "hero-1", projectId: "p-current", projectName: "当前项目", type: "hero", source: "generation_batch", status: "running", phase: "running", progress: { succeeded: 2, total: 5, failed: 0, cancelled: 0 }, createdAt: "2026-09-21T11:00:00Z", updatedAt: "2026-09-21T12:00:00Z", error: null, workbenchTab: "hero" }] },
      { projectId: "p-other", projectName: "另一个项目", projectStatus: "active", updatedAt: "2026-09-21T10:00:00Z", tasks: [{ id: "suite-1", projectId: "p-other", projectName: "另一个项目", type: "suite", source: "suite_plan", status: "awaiting_confirmation", phase: "awaiting_confirmation", progress: null, createdAt: "2026-09-21T09:00:00Z", updatedAt: "2026-09-21T10:00:00Z", error: null, workbenchTab: "suite" }] },
    ],
  } } }));
  await page.route(url => url.pathname.startsWith("/api/"), route => {
    if (new URL(route.request().url()).pathname === "/api/task-center") return route.fallback();
    if (route.request().method() !== "GET") { writes += 1; return route.fulfill({ status: 500 }); }
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "任务中心", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "项目 当前项目" })).toBeVisible();
  await expect(page.getByText("2 / 5", { exact: true })).toBeVisible();
  await page.getByLabel("任务状态").selectOption("awaiting_confirmation");
  await expect(page.getByRole("region", { name: "项目 另一个项目" })).toBeVisible();
  await expect(page.getByRole("region", { name: "项目 当前项目" })).toHaveCount(0);
  await page.getByRole("button", { name: "刷新任务" }).click();
  expect(writes).toBe(0);
});

test("活动任务串行自动更新，失败时保留内容并在终态停止", async ({ page }) => {
  let calls = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  const task = (status: string, succeeded: number) => ({ id: "hero-poll", projectId: "p-poll", projectName: "轮询项目", type: "hero", source: "generation_batch", status, phase: status, progress: { succeeded, total: 3, failed: 0, cancelled: 0 }, createdAt: "2026-09-24T00:00:00Z", updatedAt: `2026-09-24T00:00:0${succeeded}Z`, error: null, workbenchTab: "hero" });
  await page.route("**/api/task-center", async (route) => {
    calls += 1;
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((resolve) => setTimeout(resolve, 120));
    concurrent -= 1;
    if (calls === 2) return route.fulfill({ status: 503, json: { error: { message: "temporary disconnect" } } });
    const completed = calls >= 3;
    await route.fulfill({ json: { data: { projects: [{ projectId: "p-poll", projectName: "轮询项目", projectStatus: "active", updatedAt: "2026-09-24T00:00:03Z", tasks: [task(completed ? "completed" : "running", completed ? 3 : 1)] }] } } });
  });

  await page.goto("/tasks");
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("已保留当前任务", { timeout: 5_000 });
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  await expect(page.getByText("3 / 3", { exact: true })).toBeVisible({ timeout: 5_000 });
  const terminalCalls = calls;
  await page.waitForTimeout(3_500);
  expect(calls).toBe(terminalCalls);
  expect(maxConcurrent).toBe(1);
});

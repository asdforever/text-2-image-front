import { expect, test, type Page } from "playwright/test";

async function setup(page: Page, existing = false) {
  const source = { id: "source", kind: "source", state: "available", filename: "商品原图.png", width: 1280, height: 1905, createdAt: "2026-09-21", sourceAssetId: null };
  const output = { ...source, id: "white", kind: "white_background", filename: "商品白底图.png", sourceAssetId: "source" };
  const state = { submitted: existing ? 1 : 0, status: "generating", reads: 0, networkFailure: false };
  const task = () => ({ id: "task", sessionId: "session", revision: 1, status: state.status, sourceSnapshot: { assetId: "source", filename: source.filename }, configSnapshot: { outputKind: "white_background" }, promptSnapshot: {}, operations: [], attempts: state.status === "failed" ? [{ id: "attempt", status: "failed", error: "模型服务返回失败" }] : [], currentVersionId: state.status === "succeeded" ? "version" : null, finalVersionId: null });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.fallback();
    const ok = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "/api/projects/proj-demo") return ok({ id: "proj-demo", name: "白底图项目", status: "active", assets: state.status === "succeeded" ? [source, output] : [source], selections: {} });
    if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    if (path === "/api/prompt-templates") return ok([{ id: "template", name: "白底图", defaultVersion: { id: "prompt-version", body: "纯白背景", versionNo: 1 } }]);
    if (path.endsWith("/white-background-generations") && route.request().method() === "POST") { state.submitted++; return ok(task()); }
    if (path.endsWith("/white-background-generations") || path === "/api/image-editor/tasks/task") {
      state.reads++;
      if (state.networkFailure) return route.fulfill({ status: 503, json: { error: { message: "网络暂不可用" } } });
      return ok(path === "/api/image-editor/tasks/task" ? task() : state.submitted ? [task()] : []);
    }
    return ok([]);
  });
  await page.goto("/projects/proj-demo?tab=base");
  await expect(page.locator(".base-card")).toHaveCount(1);
  await page.clock.install();
  return state;
}

test("白底图超过原轮询上限仍显示生成中，完成后自动补图且只提交一次", async ({ page }) => {
  const state = await setup(page);
  await page.getByTitle("生成白底图", { exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "生成白底图", exact: true }).click();
  await expect(page.getByText("白底图生成中", { exact: true })).toBeVisible();
  for (let i = 0; i < 65; i++) {
    const before = state.reads;
    await page.clock.runFor(3100);
    await expect.poll(() => state.reads).toBeGreaterThan(before);
  }
  await expect(page.getByText("白底图生成中", { exact: true })).toBeVisible();
  state.status = "succeeded";
  await page.clock.runFor(3100);
  await expect(page.locator(".base-card")).toHaveCount(2);
  await expect(page.getByText("商品白底图.png", { exact: true })).toBeVisible();
  expect(state.submitted).toBe(1);
});

test("重新进入页面恢复后台任务，查询中断不会误报生成失败或重复提交", async ({ page }) => {
  const state = await setup(page, true);
  await expect(page.getByText("白底图生成中", { exact: true })).toBeVisible();
  state.networkFailure = true;
  await page.clock.runFor(3100);
  await expect(page.getByText(/暂时无法查询白底图任务/)).toBeVisible();
  await expect(page.getByText("白底图生成中", { exact: true })).toBeVisible();
  state.networkFailure = false;
  await page.reload();
  await expect(page.getByText("白底图生成中", { exact: true })).toBeVisible();
  state.status = "succeeded";
  await page.clock.runFor(3100);
  await expect(page.locator(".base-card")).toHaveCount(2);
  expect(state.submitted).toBe(1);
});

test("真实失败显示任务错误，查询不会自动重新生成", async ({ page }) => {
  const state = await setup(page, true);
  await expect(page.getByText("白底图生成中", { exact: true })).toBeVisible();
  state.status = "failed";
  await page.clock.runFor(3100);
  await expect(page.getByText(/模型服务返回失败/)).toBeVisible();
  await expect(page.getByText("白底图生成中", { exact: true })).toHaveCount(0);
  expect(state.submitted).toBe(1);
});

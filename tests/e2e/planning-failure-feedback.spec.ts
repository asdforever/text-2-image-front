import { expect, test } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

for (const mode of ["hero", "suite"] as const) {
  test(`${mode}: compile planning failure is visible with the config panel closed`, async ({ page }) => {
    const config = createDefaultGenerationConfig();
    const chosen = (mode === "hero" ? config.heroModules : config.suiteModules)[0];
    const project = { id: "planning-failure", name: "商品", status: "active", archivedAt: null,
      createdAt: "2026-10-06", updatedAt: "2026-10-06", selections: {},
      assets: [{ id: "source", kind: "source", filename: "商品.jpg", state: "available",
        mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800,
        sha256: "a".repeat(64), createdAt: "2026-10-06" }] };
    let releasePlanning!: () => void;
    const planningGate = new Promise<void>(resolve => { releasePlanning = resolve; });
    await page.route(url => url.pathname.startsWith("/api/"), async route => {
      const path = new URL(route.request().url()).pathname;
      const data = (value: unknown) => route.fulfill({ json: { data: value } });
      if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
      if (path === `/api/projects/${project.id}`) return data(project);
      if (path === "/api/generation-config/resolve") return data({ config, configVersion: 1,
        runtimeModules: { version: "runtime-modules-v1", heroModules: config.heroModules, suiteModules: config.suiteModules } });
      if (path.includes("reverse-bindings")) return data([]);
      if (path.endsWith("/module-plans") && route.request().method() === "POST") {
        await planningGate;
        return route.fulfill({ status: 502, json: { error: {
          code: "MODULE_PLANNER_INVALID_RESPONSE", message: "内容规划返回格式无效，请重新编译",
        } } });
      }
      return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/${project.id}?tab=${mode}`);
    await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
    await page.getByRole("button", { name: /商品.jpg 可用/ }).click();
    await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
    await page.getByLabel("参数填写", { exact: true }).fill("商品名称：随行杯\n容量：500ml");
    await page.getByRole("button", { name: config.styleCategories[0].styles[0].label, exact: true }).click();
    await page.getByRole("button", { name: `添加${chosen.label}`, exact: true }).click();
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    await expect(page.getByRole("status", { name: "当前任务状态" })).toContainText("正在规划模块");
    await page.getByRole("button", { name: "收起配置", exact: true }).click();
    releasePlanning();
    await expect(page.locator(".generation-result").getByRole("alert")).toContainText("内容规划返回格式无效");
    await expect(page.getByRole("status", { name: "当前任务状态" })).toContainText("失败");
    await page.getByRole("button", { name: "展开配置", exact: true }).click();
    await expect(page.getByRole("button", { name: "编译提示词", exact: true })).toBeEnabled();
  });
}

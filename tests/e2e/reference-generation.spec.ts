import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

for (const mode of ["hero", "suite"] as const) {
  test(`${mode}: dark generation controls retain edits through mode changes, reload and mobile drawer`, async ({ page }, testInfo) => {
    const config = createDefaultGenerationConfig();
    const module = (mode === "hero" ? config.heroModules : config.suiteModules)[0];
    const writes: string[] = [];
    await page.addInitScript(() => {
      if (sessionStorage.getItem("reference-generation-seeded")) return;
      localStorage.clear();
      sessionStorage.setItem("reference-generation-seeded", "yes");
    });
    await page.route(url => url.pathname.startsWith("/api/"), route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes.push(path);
      const data = (value: unknown) => route.fulfill({ json: { data: value } });
      if (path === "/api/projects/reference-generation") return data({ id: "reference-generation", name: "随行杯商品图", status: "active", selections: {}, assets: [], createdAt: "2026-10-14", updatedAt: "2026-10-14" });
      if (path === "/api/generation-config/resolve") return data({ config, configVersion: 1, runtimeModules: { version: "runtime-modules-v1", heroModules: config.heroModules, suiteModules: config.suiteModules } });
      if (path.includes("reverse-bindings")) return data([]);
      if (path === "/api/generation-worker/status") return data({ status: "online" });
      return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/reference-generation?tab=${mode}`);
    await expect(page.getByRole("button", { name: "常规版", exact: true })).toHaveAttribute("aria-pressed", "true");
    const configPanel = page.getByRole("complementary", { name: "生成配置" });
    await expect(configPanel).toHaveCSS("background-color", "rgb(13, 13, 13)");
    await expect(configPanel.getByText("统一整套视觉方向，各张按内容调整构图与场景")).toBeVisible();
    await page.getByRole("button", { name: `添加${module.label}`, exact: true }).click();
    await page.getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await page.getByRole("textbox", { name: "内容目标", exact: true }).fill("展示杯身与 500ml 容量");
    await page.getByRole("textbox", { name: "参考文案", exact: true }).fill("轻装出发");
    await page.getByRole("checkbox", { name: "锁定本图文案，原样使用" }).check();
    await page.getByRole("button", { name: "完成编辑第 1 张任务", exact: true }).click();
    await expect(page.locator(".module-task-card")).toContainText("轻装出发");
    await page.screenshot({ path: testInfo.outputPath(`${mode}-regular-desktop.png`), fullPage: true });
    await page.locator(".generation-result-header").getByRole("button", { name: "收起配置", exact: true }).click();
    await expectRestoreAboveHeading(page);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-desktop-collapsed.png`), fullPage: true });
    await page.getByRole("button", { name: "展开配置", exact: true }).click();
    await page.getByRole("button", { name: "专业版", exact: true }).click();
    await page.getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await expect(page.getByLabel("本图要讲什么", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "常规版", exact: true }).click();
    await page.reload();
    await expect(page.locator(".module-task-card")).toContainText("展示杯身与 500ml 容量");
    await page.getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "锁定文案", exact: true })).toHaveValue("轻装出发");
    await expect(page.getByRole("checkbox", { name: "锁定本图文案，原样使用" })).toBeChecked();
    await page.getByRole("button", { name: "完成编辑第 1 张任务", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "关闭生成配置", exact: true }).first().click();
    await expect(configPanel).toHaveCount(0);
    await expectRestoreAboveHeading(page);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-mobile-results.png`), fullPage: true });
    await page.getByRole("button", { name: "展开配置", exact: true }).click();
    await expect(configPanel).toBeVisible();
    await configPanel.getByRole("button", { name: "选择产品素材", exact: true }).click();
    await expect(configPanel.getByText("暂无可用产品素材")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${mode}-mobile-config.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "展开配置", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(writes).toEqual([]);
  });
}

async function expectRestoreAboveHeading(page: Page) {
  const restoreBox = await page.getByRole("button", { name: "展开配置", exact: true }).boundingBox();
  const resultHeadingBox = await page.locator(".generation-result-header").boundingBox();
  expect(restoreBox).not.toBeNull();
  expect(resultHeadingBox).not.toBeNull();
  expect(restoreBox!.y + restoreBox!.height).toBeLessThanOrEqual(resultHeadingBox!.y);
}

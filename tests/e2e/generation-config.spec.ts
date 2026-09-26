import { expect, test } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/model-connections", (route) => route.fulfill({ json: { data: [] } }));
});

test("keeps a saved market in draft until explicit publish", async ({ page }) => {
  const publishedContent = createDefaultGenerationConfig();
  let draftContent = structuredClone(publishedContent);
  let publishedVersion = 1;
  let draftSaved = false;

  await page.route("**/api/generation-config**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const versionView = () => ({
      id: "00000000-0000-0000-0000-000000000001",
      version: publishedVersion,
      content: publishedContent,
      contentSha256: "a".repeat(64),
      createdAt: "2026-09-14T00:00:00Z",
    });
    if (request.method() === "GET" && path === "/api/generation-config") {
      return route.fulfill({ json: { data: versionView() } });
    }
    if (request.method() === "GET" && path === "/api/generation-config/draft") {
      return route.fulfill({ json: { data: { baseVersion: publishedVersion, content: draftContent, updatedAt: "2026-09-14T00:00:00Z" } } });
    }
    if (request.method() === "PUT" && path === "/api/generation-config/draft") {
      draftContent = request.postDataJSON().content;
      draftSaved = true;
      return route.fulfill({ json: { data: { baseVersion: publishedVersion, content: draftContent, updatedAt: "2026-09-14T00:00:01Z" } } });
    }
    if (request.method() === "POST" && path === "/api/generation-config/publish") {
      publishedVersion += 1;
      Object.assign(publishedContent, structuredClone(draftContent), { version: publishedVersion });
      return route.fulfill({ json: { data: versionView() } });
    }
    return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "not found" } } });
  });
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [] } }));

  await page.goto("/generation-config");
  await expect(page.getByRole("heading", { name: "生成配置" })).toBeVisible();
  await page.getByRole("button", { name: "新增市场" }).click();
  const form = page.locator(".generation-config-inline-form").first();
  await form.getByLabel("市场名称").fill("抖音电商");
  await form.getByLabel("适用平台").fill("抖音商城");
  await form.getByLabel("默认语言").fill("中文");
  await form.getByLabel("平台规范").fill("短视频电商规范");
  await form.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".generation-config-card strong")).toHaveText("抖音电商");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect.poll(() => draftSaved).toBeTruthy();
  await expect(page.getByText("已发布 v1")).toBeVisible();
  await page.getByRole("button", { name: "发布配置" }).click();
  await expect(page.getByText(/已发布 v2/)).toBeVisible();
});

test("keeps generation config editing disabled when initial loading fails", async ({ page }) => {
  await page.route("**/api/generation-config**", (route) => route.fulfill({
    status: 503,
    json: { error: { code: "DEPENDENCY_NOT_READY", message: "配置服务不可用" } },
  }));
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [] } }));

  await page.goto("/generation-config");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "发布配置" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "新增市场" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});

test("exposes CRUD controls for hero and suite generation modules", async ({ page }) => {
  const content = createDefaultGenerationConfig();
  await page.route("**/api/generation-config**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/generation-config/draft") {
      return route.fulfill({ json: { data: { baseVersion: 1, content, updatedAt: "2026-09-14T00:00:00Z" } } });
    }
    return route.fulfill({ json: { data: { id: "00000000-0000-0000-0000-000000000001", version: 1, content, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" } } });
  });
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [] } }));
  await page.goto("/generation-config");
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("hero");
  const heroSection = page.locator(".generation-config-section").filter({ hasText: "主图模块" });
  const suiteSection = page.locator(".generation-config-section").filter({ hasText: "详情页模块" });
  await expect(heroSection.getByRole("button", { name: "新增模块" })).toBeVisible();
  await expect(heroSection.getByTitle("编辑主图模块").first()).toBeVisible();
  await expect(heroSection.getByTitle("删除主图模块").first()).toBeVisible();
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("suite");
  await expect(suiteSection.getByRole("button", { name: "新增模块" })).toBeVisible();
  await expect(suiteSection.getByTitle("编辑详情页模块").first()).toBeVisible();
  await expect(suiteSection.getByTitle("删除详情页模块").first()).toBeVisible();
});

test("选择配置项后只编辑当前项，跨类型切换保留修改和提示词绑定", async ({ page }, testInfo) => {
  let content = createDefaultGenerationConfig();
  const marketId = content.markets[1].id;
  const moduleId = content.heroModules[1].id;
  await page.route("**/api/generation-config**", async (route) => {
    if (route.request().method() === "PUT") content = route.request().postDataJSON().content;
    const data = new URL(route.request().url()).pathname.endsWith("/draft") ? { baseVersion: 1, content } : { id: "config-v1", version: 1, content };
    await route.fulfill({ json: { data } });
  });
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [{ id: "prompt-test", name: "商品构图提示词" }] } }));
  await page.route("**/api/prompt-templates/prompt-test/versions", (route) => route.fulfill({ json: { data: [{ id: "version-test", templateId: "prompt-test", versionNo: 1, body: "保留产品真实结构", status: "published" }] } }));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/generation-config");
  await page.getByRole("combobox", { name: "选择电商平台", exact: true }).selectOption(marketId);
  await expect(page.locator(".generation-config-card")).toHaveCount(1);
  await page.getByRole("combobox", { name: "提示词绑定", exact: true }).selectOption("version-test");
  await page.getByTitle("编辑市场").click();
  await page.getByLabel("市场名称", { exact: true }).fill("已修改的平台");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("hero");
  await page.getByRole("combobox", { name: "选择主图模块", exact: true }).selectOption(moduleId);
  await page.getByTitle("编辑主图模块").click();
  await page.getByLabel("模块说明", { exact: true }).fill("仅修改被选中的模块");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("market");
  await expect(page.locator(".generation-config-card strong")).toHaveText("已修改的平台");
  await expect(page.getByRole("combobox", { name: "提示词绑定", exact: true })).toHaveValue("version-test");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  expect(content.markets.find((m) => m.id === marketId)?.label).toBe("已修改的平台");
  expect(content.marketBindings[marketId]?.promptVersionId).toBe("version-test");
  expect(content.heroModules.find((m) => m.id === moduleId)?.description).toBe("仅修改被选中的模块");
  expect(content.heroModules[0].description).not.toBe("仅修改被选中的模块");
  await page.screenshot({ path: testInfo.outputPath("generation-config-select-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("generation-config-select-mobile.png") });
});

test("空风格大类可新增，新增后选中，删除后恢复空态", async ({ page }) => {
  const content = createDefaultGenerationConfig();
  content.styleCategories.push({ id: "empty", label: "空大类", styles: [] });
  await page.route("**/api/generation-config**", (route) => route.fulfill({ json: { data: new URL(route.request().url()).pathname.endsWith("/draft") ? { baseVersion: 1, content } : { version: 1, content } } }));
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [] } }));
  await page.goto("/generation-config");
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("style");
  await page.getByRole("combobox", { name: "选择风格大类", exact: true }).selectOption("empty");
  await expect(page.getByText("此大类还没有风格，点击新增风格开始配置。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新增风格", exact: true }).click();
  await page.getByLabel("风格名称", { exact: true }).fill("自然光摄影");
  await page.getByLabel("风格描述", { exact: true }).fill("柔和自然光，干净背景");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".generation-config-card strong")).toHaveText("自然光摄影");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByTitle("删除风格").click();
  await expect(page.getByText("此大类还没有风格，点击新增风格开始配置。", { exact: true })).toBeVisible();
});

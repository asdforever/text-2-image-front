import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

const createdAt = "2026-10-14T00:00:00Z";
const category = { id: "hero", name: "商品主图", sortOrder: 0, templateCount: 2, createdAt, updatedAt: createdAt };
const templates = ["商品卖点设计", "场景氛围设计", "详情内容规划"].map((name, index) => {
  const id = `prompt-${index}`;
  const version = { id: `${id}-v1`, templateId: id, versionNo: 1, name, kind: "text_to_text", executionTarget: "llm", body: `${name}：保留商品真实参数，合理安排内容层级。`, userPromptTemplate: "", inputSchema: [], outputSchema: {}, applicability: {}, generationParams: {}, contentSha256: "a".repeat(64), source: "marketplace", createdBy: "test", createdAt };
  return { id, code: `product.design.${index}`, name, kind: "text_to_text", executionTarget: "llm", kindName: "文生文", categoryId: index < 2 ? category.id : null, categoryName: index < 2 ? category.name : null, defaultVersionId: version.id, defaultVersion: version, versionCount: 1, createdAt, updatedAt: createdAt, templateId: id, templateVersionId: version.id, versionNo: 1, inputSchema: [], applicability: {} };
});

async function mockPrompts(page: Page) {
  await page.route(url => url.pathname === "/api/asset-libraries", route => route.fulfill({ json: { data: [] } }));
  await page.route(url => url.pathname.startsWith("/api/prompt-"), route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/prompt-categories") return route.fulfill({ json: { data: [category] } });
    if (path === "/api/prompt-templates") return route.fulfill({ json: { data: templates } });
    const item = templates.find(item => path === `/api/prompt-templates/${item.id}`);
    if (item) return route.fulfill({ json: { data: { ...item, versions: [item.defaultVersion] } } });
    return route.fulfill({ status: 404 });
  });
}

test("提示词分类和搜索组合，键盘打开详情，关闭后返回模板", async ({ page }, testInfo) => {
  await mockPrompts(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/prompts");
  await expect(page.locator(".prompt-card")).toHaveCount(3);
  await page.getByRole("button", { name: /商品主图/ }).first().click();
  await page.getByRole("textbox", { name: "搜索提示词", exact: true }).fill("场景");
  await expect(page.locator(".prompt-card")).toHaveCount(1);
  const open = page.getByRole("button", { name: "查看提示词 场景氛围设计", exact: true });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".prompt-info-body")).toContainText("保留商品真实参数");
  await page.screenshot({ path: testInfo.outputPath("prompt-detail-desktop.png") });
  await page.locator(".prompt-detail-panel").getByRole("button", { name: "关闭", exact: true }).click();
  await expect(open).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await open.click();
  await expect(page.locator(".prompt-detail-panel")).toBeInViewport();
  await page.locator(".prompt-card").getByRole("button", { name: "测试提示词 场景氛围设计", exact: true }).click();
  await expect(page.locator(".prompt-detail-panel")).toBeFocused();
  await page.locator(".prompt-detail-tabs").getByRole("button", { name: "基本信息", exact: true }).click();
  for (const selector of [".prompt-marketplace-shell", ".prompt-detail-panel", ".prompt-detail-content"]) {
    expect(await page.locator(selector).evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: testInfo.outputPath("prompt-detail-mobile.png") });
  for (const [tab, className] of [["版本历史", ".prompt-versions-container"], ["快速测试", ".prompt-test-tab"], ["对比分析", ".prompt-compare-tab"]]) {
    await page.locator(".prompt-detail-tabs").getByRole("button", { name: tab, exact: true }).click();
    await expect(page.locator(className)).toBeVisible();
    expect(await page.locator(".prompt-detail-content").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`prompt-${tab}-mobile.png`) });
  }
});

test("提示词新建和分类弹窗支持 Escape 和焦点返回，手机端控件可见", async ({ page }, testInfo) => {
  await mockPrompts(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/prompts");
  const create = page.getByRole("button", { name: "新建提示词", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog", { name: "新建提示词", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "业务分类" })).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("prompt-create-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
  const manage = page.getByRole("button", { name: "分类管理", exact: true });
  await manage.click();
  const categories = page.getByRole("dialog", { name: "分类管理", exact: true });
  await expect(categories.getByRole("textbox", { name: "新分类名称" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(manage).toBeFocused();
});

test("生成配置六类布局和模型表单在手机端无横向溢出，编辑输入保留", async ({ page }, testInfo) => {
  const content = createDefaultGenerationConfig();
  const connections = [{ id: "environment", baseUrl: "https://images.example.test/v1", modelName: "image-model", protocol: "openai_images", hasApiKey: true }, { id: "environment-context", baseUrl: "https://chat.example.test/v1", modelName: "planning-model", protocol: "openai_chat", hasApiKey: true }];
  await page.route(url => url.pathname.startsWith("/api/generation-config"), route => route.fulfill({ json: { data: new URL(route.request().url()).pathname.endsWith("/draft") ? { baseVersion: 1, content, updatedAt: createdAt } : { id: "config-1", version: 1, content, contentSha256: "a".repeat(64), createdAt } } }));
  await page.route(url => url.pathname === "/api/model-connections", route => route.fulfill({ json: { data: connections } }));
  await mockPrompts(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/generation-config");
  await expect(page.getByRole("button", { name: "新增市场", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("config-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const section of ["market", "style", "hero", "suite", "model", "prompt-model"]) {
    await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption(section);
    expect(await page.locator(".generation-config-content").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`config-${section}-mobile.png`) });
  }
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("model");
  await page.getByRole("button", { name: "新增模型", exact: true }).click();
  await page.getByRole("textbox", { name: "模型名称", exact: true }).fill("新图片模型");
  await expect(page.getByRole("combobox", { name: "配置类型", exact: true })).toBeDisabled();
  expect(await page.locator(".generation-config-content").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.getByRole("textbox", { name: "模型名称", exact: true })).toHaveValue("新图片模型");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "配置类型", exact: true })).toBeEnabled();
});

test("新建提示词提交中禁止关闭，失败后保留输入，批量勾选随筛选更新", async ({ page }) => {
  await mockPrompts(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route(url => url.pathname === "/api/prompt-templates", async route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: templates } });
    writes++;
    await gate;
    return route.fulfill({ status: 503, json: { error: { message: "服务暂时不可用" } } });
  });
  await page.goto("/prompts");
  await page.getByRole("button", { name: "新建提示词", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新建提示词" });
  await dialog.getByRole("textbox", { name: /Code/ }).fill("product.example");
  await dialog.getByRole("textbox", { name: /名称/ }).fill("新设计模板");
  await dialog.getByRole("textbox", { name: /System Prompt/ }).fill("保留商品真实参数");
  await dialog.getByRole("button", { name: "创建 v1" }).click();
  await expect.poll(() => writes).toBe(1);
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "创建中…" })).toBeDisabled();
  release();
  await expect(dialog.getByRole("alert")).toContainText("服务暂时不可用");
  await expect(dialog.getByRole("textbox", { name: /名称/ })).toHaveValue("新设计模板");
  page.once("dialog", confirmation => confirmation.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "批量删除", exact: true }).click();
  await page.getByRole("checkbox", { name: "选择提示词 商品卖点设计" }).check();
  await expect(page.getByRole("button", { name: "删除选中 (1)", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "搜索提示词", exact: true }).fill("场景");
  await expect(page.getByRole("button", { name: "删除选中 (0)", exact: true })).toBeDisabled();
});

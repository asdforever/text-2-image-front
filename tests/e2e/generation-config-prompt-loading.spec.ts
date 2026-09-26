import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

const version = { id: "prompt-version-1", templateId: "prompt-1", versionNo: 1, name: "淘宝平台约束 V1", kind: "image_to_image", executionTarget: "llm", body: "保持商品真实", userPromptTemplate: "", inputSchema: [], outputSchema: {}, applicability: {}, generationParams: {}, contentSha256: "a".repeat(64), source: "marketplace", createdBy: "local-user", createdAt: "2026-09-18T00:00:00Z" };
const template = { id: "prompt-1", code: "test.market.taobao", name: "淘宝平台约束 V1", kind: "image_to_image", kindName: "平台约束", stage: "plan", executionTarget: "llm", defaultVersionId: version.id, defaultVersion: version, versionCount: 1, categoryId: null, categoryName: null, createdAt: version.createdAt, updatedAt: version.createdAt };

async function configure(page: Page) {
  const content = createDefaultGenerationConfig();
  content.marketBindings[content.markets[0].id] = { promptTemplateId: template.id, promptVersionId: version.id, templateName: template.name, versionNo: 1, contentSha256: version.contentSha256 };
  await page.route("**/api/model-connections", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/generation-config**", (route) => route.fulfill({ json: { data: new URL(route.request().url()).pathname.endsWith("/draft") ? { baseVersion: 7, content, updatedAt: version.createdAt } : { id: "config-v7", version: 7, content, contentSha256: "b".repeat(64), createdAt: version.createdAt } } }));
}

test("规划大师不提供配置入口，旧绑定不阻止普通模块绑定保存", async ({ page }) => {
  await configure(page);
  const imageVersion = { ...version, id: "image-version", templateId: "image-template", executionTarget: "image" };
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [template, { ...template, id: "image-template", defaultVersionId: imageVersion.id, defaultVersion: imageVersion }] } }));
  await page.route("**/api/prompt-templates/*/versions", (route) => route.fulfill({ json: { data: route.request().url().includes("image-template") ? [imageVersion] : [version] } }));
  let saved: ReturnType<typeof createDefaultGenerationConfig> | undefined;
  const legacy = { ...createDefaultGenerationConfig(), plannerBindings: { hero: { promptTemplateId: "missing", promptVersionId: "missing" }, suite: null } };
  await page.route("**/api/generation-config/draft", async (route) => {
    if (route.request().method() !== "GET") saved = route.request().postDataJSON().content;
    await route.fulfill({ json: { data: { baseVersion: 7, content: saved ?? legacy, updatedAt: version.createdAt } } });
  });
  await page.goto("/generation-config");
  await page.getByLabel("配置类型", { exact: true }).selectOption("hero");
  await expect(page.getByRole("region", { name: "主图规划大师绑定" })).toHaveCount(0);
  const hero = page.getByRole("combobox", { name: "提示词绑定", exact: true });
  await expect(hero).toBeEnabled();
  await hero.selectOption(version.id);
  await page.getByLabel("选择主图模块", { exact: true }).selectOption("hero-scene");
  await expect(hero).toHaveValue("");
  await page.getByLabel("选择主图模块", { exact: true }).selectOption("hero-kv");
  await expect(hero).toHaveValue(version.id);
  await page.getByLabel("配置类型", { exact: true }).selectOption("suite");
  await expect(page.getByRole("region", { name: "详情页规划大师绑定" })).toHaveCount(0);
  const suite = page.getByRole("combobox", { name: "提示词绑定", exact: true });
  await expect(suite).toHaveValue("");
  await suite.selectOption(version.id);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(() => saved?.heroBindings["hero-kv"]?.promptVersionId).toBe(version.id);
  expect(Object.values(saved!.suiteBindings).some((binding) => binding?.promptVersionId === version.id)).toBe(true);
  expect(saved).not.toHaveProperty("plannerBindings");
});

test("有效绑定在提示词目录加载期间显示已保存名称，不误报版本不可解析", async ({ page }) => {
  await configure(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/prompt-templates", async (route) => { await gate; await route.fulfill({ json: { data: [template] } }); });
  await page.route("**/api/prompt-templates/*/versions", (route) => route.fulfill({ json: { data: [version] } }));
  try {
    await page.goto("/generation-config");
    const picker = page.getByRole("combobox", { name: "提示词绑定", exact: true });
    await expect(picker).toHaveValue(version.id);
    await expect(picker.locator("option:checked")).toContainText(template.name);
    await expect(page.getByText("正在加载提示词版本…", { exact: true })).toBeVisible();
    await expect(picker).toBeDisabled();
    release();
    await expect(picker).toBeEnabled();
    await expect(page.getByText("正在加载提示词版本…", { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test("目录请求失败时保留当前绑定，并能单独重试提示词加载", async ({ page }) => {
  await configure(page);
  let shouldFail = true;
  await page.route("**/api/prompt-templates", (route) => shouldFail
    ? route.fulfill({ status: 503, json: { error: { message: "temporarily unavailable" } } })
    : route.fulfill({ json: { data: [template] } }));
  await page.route("**/api/prompt-templates/*/versions", (route) => route.fulfill({ json: { data: [version] } }));
  await page.goto("/generation-config");
  const picker = page.getByRole("combobox", { name: "提示词绑定", exact: true });
  await expect(picker.locator("option:checked")).toContainText(template.name);
  await expect(picker).toHaveValue(version.id);
  await expect(page.getByText("提示词加载失败，已保留当前绑定。", { exact: true })).toBeVisible();
  await page.getByTitle("编辑市场").click();
  await page.getByLabel("市场名称", { exact: true }).fill("重试前的未保存修改");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  shouldFail = false;
  await page.getByRole("button", { name: "重试加载提示词", exact: true }).click();
  await expect(picker).toBeEnabled();
  await expect(picker.locator("option:checked")).toContainText(template.name);
  await expect(page.getByText("提示词加载失败，已保留当前绑定。", { exact: true })).toHaveCount(0);
  await expect(page.locator(".generation-config-card strong")).toHaveText("重试前的未保存修改");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
});

test("历史版本加载失败不会把已绑定旧版本误判为不存在", async ({ page }) => {
  await configure(page);
  const latest = { ...version, id: "latest-version", versionNo: 2 };
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [{ ...template, defaultVersion: latest, defaultVersionId: latest.id, versionCount: 2 }] } }));
  await page.route("**/api/prompt-templates/*/versions", (route) => route.fulfill({ status: 503, json: { error: { message: "temporarily unavailable" } } }));
  await page.goto("/generation-config");
  const picker = page.getByRole("combobox", { name: "提示词绑定", exact: true });
  await expect(page.getByText("部分历史版本加载失败，已保留当前绑定。", { exact: true })).toBeVisible();
  await expect(picker.locator("option:checked")).toContainText(`${template.name} · v1`);
  await expect(picker.locator("option:checked")).not.toContainText("不可解析");
  await expect(picker).toBeEnabled();
  await page.getByTitle("编辑市场").click();
  await page.getByLabel("市场名称", { exact: true }).fill("历史版本待核验");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  await picker.selectOption(latest.id);
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
});

test("完整加载后缺失的绑定明确提示不可用，仍然可以解除绑定", async ({ page }) => {
  await configure(page);
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [] } }));
  await page.goto("/generation-config");
  const picker = page.getByRole("combobox", { name: "提示词绑定", exact: true });
  await expect(picker.locator("option:checked")).toContainText("版本不可用");
  await expect(picker).toBeEnabled();
  await picker.selectOption("");
  await expect(picker).toHaveValue("");
  await expect(page.getByText("提示词加载失败，已保留当前绑定。", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
});

test("默认版本先可用，其他模板的历史版本请求不阻塞绑定选择", async ({ page }) => {
  await configure(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const older = { ...version, id: "historical-version", templateId: "prompt-2", versionNo: 1 };
  const newest = { ...older, id: "latest-version", versionNo: 2 };
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [template, { ...template, id: "prompt-2", name: "多版本模板", defaultVersion: newest, defaultVersionId: newest.id, versionCount: 2 }] } }));
  await page.route("**/api/prompt-templates/prompt-1/versions", (route) => route.fulfill({ json: { data: [version] } }));
  await page.route("**/api/prompt-templates/prompt-2/versions", async (route) => { await gate; await route.fulfill({ json: { data: [newest, older] } }); });
  try {
    await page.goto("/generation-config");
    const picker = page.getByRole("combobox", { name: "提示词绑定", exact: true });
    await expect(picker).toBeEnabled();
    await picker.selectOption(newest.id);
    await expect(picker).toHaveValue(newest.id);
    release();
    await expect(picker.locator(`option[value="${older.id}"]`)).toHaveCount(1);
    await expect(picker).toHaveValue(newest.id);
  } finally { release(); }
});

import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

async function setup(page: Page, options: { failure?: boolean; environment?: boolean } = {}) {
  let content = createDefaultGenerationConfig();
  let version = 1;
  const configWrites: unknown[] = [];
  const connectionWrites: Record<string, unknown>[] = [];
  const connections = options.environment === false ? [] : [{ id: "environment", baseUrl: "https://existing.example/v1", modelName: "existing-image-model", protocol: "openai_images", hasApiKey: true, createdAt: null }];
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/generation-config**", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      configWrites.push(request.postDataJSON());
      content = request.postDataJSON().content;
    }
    if (request.method() === "POST") { configWrites.push({ publish: true }); version += 1; }
    const data = new URL(request.url()).pathname.endsWith("/draft") ? { baseVersion: version, content, updatedAt: "2026-09-18T00:00:00Z" } : { id: `config-${version}`, version, content, createdAt: "2026-09-18T00:00:00Z", contentSha256: "a".repeat(64) };
    await route.fulfill({ json: { data } });
  });
  await page.route("**/api/model-connections", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: connections } });
    const body = route.request().postDataJSON();
    connectionWrites.push(body);
    if (options.failure) return route.fulfill({ status: 503, json: { error: { message: `保存失败 ${body.apiKey}` } } });
    const saved = { id: `connection-${connectionWrites.length}`, baseUrl: body.baseUrl, modelName: body.modelName, protocol: "openai_images", hasApiKey: true, createdAt: "2026-09-18T00:00:00Z" };
    connections.push(saved);
    await route.fulfill({ json: { data: saved } });
  });
  await page.goto("/generation-config");
  await page.getByRole("combobox", { name: "配置类型", exact: true }).selectOption("model");
  return { configWrites, connectionWrites, content: () => content };
}

test("保存新连接后按草稿和发布流程生效，普通配置和缓存不包含 Key", async ({ page }, testInfo) => {
  const state = await setup(page);
  await expect(page.getByLabel("提示词绑定", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "新增模型", exact: true }).click();
  await page.getByLabel("模型名称", { exact: true }).fill("新模型");
  await page.getByLabel("接口地址", { exact: true }).fill("https://new.example/v1");
  await page.getByLabel("实际模型名", { exact: true }).fill("actual-image-model");
  await page.getByLabel("API Key", { exact: true }).fill("fake-new-secret");
  await page.getByLabel("模型约束", { exact: true }).fill("仅用于商品图");
  await page.getByLabel("支持比例", { exact: true }).fill("1:1, 4:3");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: testInfo.outputPath("model-connection-form-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("model-connection-form-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".generation-config-card")).toContainText("actual-image-model");
  await expect(page.locator(".generation-config-card")).toContainText("已配置");
  expect(state.connectionWrites).toEqual([{ baseUrl: "https://new.example/v1", modelName: "actual-image-model", protocol: "openai_images", apiKey: "fake-new-secret" }]);
  expect(state.configWrites).toHaveLength(0);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  expect(state.content().models.find((model) => model.label === "新模型")).toMatchObject({ connectionId: "connection-1", aspectRatios: ["1:1", "4:3"] });
  expect(JSON.stringify(state.configWrites)).not.toContain("fake-new-secret");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("fake-new-secret");
  await page.getByTitle("编辑模型").click();
  await expect(page.getByLabel("API Key", { exact: true })).toHaveValue("");
  await page.getByLabel("实际模型名", { exact: true }).fill("actual-image-model-v2");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".generation-config-card")).toContainText("actual-image-model-v2");
  expect(state.connectionWrites[1]).toEqual({ baseUrl: "https://new.example/v1", modelName: "actual-image-model-v2", protocol: "openai_images", reuseConnectionId: "connection-1" });
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "发布配置", exact: true }).click();
  await expect(page.getByText("已发布 v2")).toBeVisible();
});

test("旧模型读取环境连接，空 Key 复用旧连接凭据", async ({ page }) => {
  const state = await setup(page);
  await expect(page.locator(".generation-config-card")).toContainText("https://existing.example/v1");
  await page.getByTitle("编辑模型").click();
  await expect(page.getByLabel("实际模型名", { exact: true })).toHaveValue("existing-image-model");
  await page.getByLabel("实际模型名", { exact: true }).fill("updated-model");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".generation-config-card")).toContainText("updated-model");
  expect(state.connectionWrites[0]).toEqual({ baseUrl: "https://existing.example/v1", modelName: "updated-model", protocol: "openai_images", reuseConnectionId: "environment" });
});

test("连接失败保留表单且不能保存或发布普通配置，错误不回显密钥", async ({ page }) => {
  const state = await setup(page, { failure: true });
  await page.getByTitle("编辑模型").click();
  await page.getByLabel("API Key", { exact: true }).fill("fake-failed-secret");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("连接保存失败");
  await expect(page.getByRole("alert")).not.toContainText("fake-failed-secret");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "发布配置", exact: true })).toBeDisabled();
  expect(state.configWrites).toHaveLength(0);
});

test("未配置环境时不假装已有 Key，新模型必填 Key", async ({ page }) => {
  const state = await setup(page, { environment: false });
  await expect(page.locator(".generation-config-card")).toContainText("未配置连接");
  await page.getByRole("button", { name: "新增模型", exact: true }).click();
  await expect(page.getByLabel("API Key", { exact: true })).toHaveAttribute("required", "");
  expect(state.connectionWrites).toHaveLength(0);
});

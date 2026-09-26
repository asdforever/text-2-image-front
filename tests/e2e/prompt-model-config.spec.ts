import { expect, test } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

test("提示词模型独立配置、密钥复用并通过草稿发布生效", async ({ page }, testInfo) => {
  let content = createDefaultGenerationConfig();
  let version = 1;
  const writes: Record<string, unknown>[] = [];
  const connections = [
    { id: "environment", baseUrl: "https://image.example/v1", modelName: "image-only", protocol: "openai_images", hasApiKey: true, createdAt: null },
    { id: "environment-context", baseUrl: "https://chat.example/v1", modelName: "existing-chat", protocol: "openai_chat", hasApiKey: true, createdAt: null },
  ];
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/generation-config**", async (route) => {
    const req = route.request();
    if (req.method() === "PUT") content = req.postDataJSON().content;
    if (req.method() === "POST") version += 1;
    const data = new URL(req.url()).pathname.endsWith("/draft") ? { baseVersion: version, content } : { id: "config", version, content, contentSha256: "a".repeat(64) };
    await route.fulfill({ json: { data } });
  });
  await page.route("**/api/model-connections", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: connections } });
    const input = route.request().postDataJSON();
    writes.push(input);
    const connection = { id: `chat-${writes.length}`, baseUrl: input.baseUrl, modelName: input.modelName, protocol: input.protocol, hasApiKey: true, createdAt: null };
    connections.push(connection);
    await route.fulfill({ json: { data: connection } });
  });
  await page.goto("/generation-config");
  await page.getByLabel("配置类型", { exact: true }).selectOption("prompt-model");
  await expect(page.getByLabel("选择提示词模型", { exact: true })).not.toContainText("image-only");
  await expect(page.locator(".generation-config-section")).toContainText("existing-chat");
  await page.getByRole("button", { name: "编辑提示词模型", exact: true }).click();
  await expect(page.getByLabel("API Key", { exact: true })).toHaveValue("");
  await page.getByLabel("实际模型名", { exact: true }).fill("new-chat");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByLabel("选择提示词模型", { exact: true })).toHaveValue("chat-1");
  expect(writes[0]).toEqual({ baseUrl: "https://chat.example/v1", modelName: "new-chat", protocol: "openai_chat", reuseConnectionId: "environment-context" });
  expect(content.promptModel).toBeUndefined();
  await page.getByRole("button", { name: "新增提示词模型", exact: true }).click();
  await page.getByLabel("接口地址", { exact: true }).fill("https://new.example");
  await page.getByLabel("实际模型名", { exact: true }).fill("vision-chat");
  await page.getByLabel("API Key", { exact: true }).fill("fake-prompt-secret");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByLabel("选择提示词模型", { exact: true })).toHaveValue("chat-2");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  expect(content.promptModel).toEqual({ connectionId: "chat-2" });
  expect(JSON.stringify(content)).not.toContain("fake-prompt-secret");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("fake-prompt-secret");
  await page.getByRole("button", { name: "发布配置", exact: true }).click();
  await expect(page.getByText("已发布 v2")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("prompt-model-mobile.png"), fullPage: true });
  await page.getByLabel("选择提示词模型", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  expect(content.promptModel).toBeNull();
  await page.getByLabel("配置类型", { exact: true }).selectOption("model");
  await expect(page.locator(".generation-config-card")).toContainText("image-only");
});

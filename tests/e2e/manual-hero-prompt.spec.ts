import { expect, test } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

test("专业主图修改后刷新保留，确认重试复用请求键，改字后使用新键", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("manual-hero-initialized")) return;
    localStorage.clear();
    localStorage.setItem("picagent-project-store", JSON.stringify({ version: 0, state: {
      generationDrafts: { "manual-project:hero": { config: { creationMode: "professional" } } },
      heroGenerationSessions: { "manual-project": { batchId: "manual-batch", inputFingerprint: "test",
        compileIdempotencyKey: "compile-key", confirmIdempotencyKey: "confirm-key" } },
    } }));
    sessionStorage.setItem("manual-hero-initialized", "1");
  });
  const batch = { id: "manual-batch", projectId: "manual-project", kind: "hero", creationMode: "professional",
    status: "awaiting_confirmation", snapshot: { creationMode: "professional" },
    modules: [{ id: "task-1", moduleKey: "hero-kv", moduleLabel: "首屏主视觉", resultCount: 1,
      constraints: {}, compiledTaskPrompt: "原始编译描述", visibleFacts: [], unconfirmedItems: [] }], slots: [],
    progress: { total: 1, queued: 0, succeeded: 0, failed: 0, cancelled: 0, completed: 0 } };
  const requests: Array<{ key: string; prompt: string }> = [];
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.fallback();
    const data = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "/api/generation-config") return data({ content: createDefaultGenerationConfig(), version: 1 });
    if (path === "/api/projects/manual-project") return data({ id: "manual-project", name: "专业主图", status: "active", selections: {}, assets: [] });
    if (path.endsWith("/confirm")) {
      requests.push({ key: route.request().headers()["idempotency-key"], prompt: route.request().postDataJSON().moduleTaskPrompts["hero-kv"] });
      return route.fulfill({ status: 503, json: { error: { message: "临时失败，允许重试" } } });
    }
    if (path.endsWith("/manual-batch") || path.endsWith("/by-request")) return data(batch);
    if (path.endsWith("/reverse-bindings")) return data([]);
    if (path === "/api/generation-worker/status") return data({ status: "online" });
    return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
  });
  await page.goto("/projects/manual-project?tab=hero");
  const prompt = page.getByRole("textbox", { name: "实时任务提示词", exact: true });
  await expect(prompt).toHaveValue("原始编译描述");
  await prompt.fill("本次手动描述");
  await page.reload();
  await expect(prompt).toHaveValue("本次手动描述");
  const confirm = page.getByRole("button", { name: "确认并开始批次生成", exact: true });
  await confirm.click();
  await expect(page.getByRole("alert")).toContainText("临时失败");
  await confirm.click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
  await prompt.fill("再次修改的描述");
  await confirm.click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].prompt).toBe("再次修改的描述");
  expect(requests[2].key).not.toBe(requests[1].key);
  expect(batch.modules[0].compiledTaskPrompt).toBe("原始编译描述");
});

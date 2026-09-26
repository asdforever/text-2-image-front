import { test, expect, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

const project = { id: "recovery-project", name: "恢复测试项目", status: "active", archivedAt: null, createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z", selections: {}, assets: [{ id: "source", type: "source", name: "产品素材.jpg", url: "/source.jpg" }] };
const cards = { authenticity: { content: "保持真实" }, market: { content: "淘宝" }, style: { content: "简洁" } };
function task(kind: "hero" | "suite", status: string) {
  const moduleKey = kind === "hero" ? "hero-kv" : "suite-hero";
  return { id: `${kind}-task`, projectId: project.id, sourceAssetId: "source", status, revision: 1, snapshot: {}, sourceAssets: [], references: [], constraints: cards, generationBatchId: null,
    createdAt: project.createdAt, updatedAt: project.updatedAt, confirmedAt: null, completedAt: null,
    error: status === "failed" ? { code: "NO_CREDIT", message: "模型额度不足" } : null,
    modules: [{ id: `${kind}-module`, moduleKey, position: 1, title: "首屏主视觉", resultCount: 1, revision: 1, copySummary: "", visualDirection: "", moduleParameters: [], promptSnapshot: {}, constraints: cards, visibleFacts: [], unconfirmedItems: [], compiledTaskPrompt: "原始提示词", currentTaskPrompt: "原始提示词", confirmedTaskPrompt: null, finalPromptSha256: null }],
    slots: [], progress: { total: 0, succeeded: 0, queued: 0, leased: 0, dispatching: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: 0 },
  };
}

async function setup(page: Page, kind: "hero" | "suite", initial: string, saved = true, plannerVersion?: "v2") {
  let value = { ...task(kind, initial), plannerVersion };
  let writes = 0;
  let reads = 0;
  let unavailable = false;
  await page.addInitScript(({ kind, saved }) => {
    if (sessionStorage.getItem("recovery-init")) return;
    localStorage.clear();
    sessionStorage.setItem("recovery-init", "1");
    const session = { inputFingerprint: "input", compileIdempotencyKey: "compile-key", confirmIdempotencyKey: "confirm-key" };
    localStorage.setItem("picagent-project-store", JSON.stringify({ state: {
      generationDrafts: { [`recovery-project:${kind}`]: { config: { selectedAssetIds: ["source"], market: "taobao", model: "gpt-image-2-5", styleId: "minimal", selectedModuleIds: [kind === "hero" ? "hero-kv" : "suite-hero"], moduleCounts: { [kind === "hero" ? "hero-kv" : "suite-hero"]: 1 } } } },
      heroGenerationSessions: kind === "hero" && saved ? { "recovery-project": session } : {},
      suiteGenerationSessions: kind === "suite" && saved ? { "recovery-project": session } : {},
    }, version: 0 }));
  }, { kind, saved });
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    if (route.request().method() !== "GET") { writes++; return route.fulfill({ status: 500, json: { error: { message: "禁止自动生成" } } }); }
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/projects") return route.fulfill({ json: { data: [project] } });
    if (path === `/api/projects/${project.id}`) return route.fulfill({ json: { data: project } });
    if (path === "/api/generation-config") return route.fulfill({ json: { data: { id: "v1", version: 1, content: createDefaultGenerationConfig(), contentSha256: "a".repeat(64), createdAt: project.createdAt } } });
    if (path.includes(kind === "hero" ? "/generation-batches/" : "/suite-plans/")) {
      reads++;
      if (unavailable) return route.fulfill({ status: 503, json: { error: { message: "暂时无法读取任务" } } });
      return route.fulfill({ json: { data: value } });
    }
    if (path.endsWith("/suite-plans/latest")) return route.fulfill({ status: 404, json: { error: { message: "没有套图任务" } } });
    return route.fulfill({ json: { data: [] } });
  });
  return { setStatus: (status: string) => { value = { ...task(kind, status), plannerVersion }; }, setUnavailable: (next: boolean) => { unavailable = next; }, writes: () => writes, reads: () => reads };
}

for (const kind of ["suite", "hero"] as const) {
  test(`${kind} V2 确认使用服务端规划，忽略旧草稿并保持重试幂等`, async ({ page }) => {
    const state = await setup(page, kind, "awaiting_confirmation", true, "v2");
    await page.goto(`/projects/${project.id}?tab=${kind}`);
    const prompt = kind === "suite" ? page.getByLabel("首屏主视觉提示词", { exact: true }) : page.getByRole("textbox", { name: "实时任务提示词", exact: true });
    await expect(prompt).toHaveValue("原始提示词");
    await page.evaluate((kind) => {
      if (kind === "suite") {
        localStorage.setItem("suite-prompt-draft:recovery-project:suite-task", JSON.stringify({ planId: "suite-task", prompts: { "suite-hero": "旧草稿覆盖风格" } }));
      } else {
        const saved = JSON.parse(localStorage.getItem("picagent-project-store")!);
        Object.assign(saved.state.heroGenerationSessions["recovery-project"], { promptBatchId: "hero-task", moduleTaskPrompts: { "hero-kv": "旧草稿覆盖风格" } });
        localStorage.setItem("picagent-project-store", JSON.stringify(saved));
      }
    }, kind);
    await page.reload();
    await expect(prompt).toHaveValue("原始提示词");
    await expect(prompt).not.toBeEditable();
    await expect(page.getByText("提示词已统一合成；如需调整，请修改左侧模块参数后重新编译。", { exact: true })).toBeVisible();
    expect(state.writes()).toBe(0);
    const confirmations: Array<{ key?: string; prompts: Record<string, string> }> = [];
    await page.route(`**/${kind === "suite" ? "suite-plans" : "generation-batches"}/${kind}-task/confirm`, route => {
      confirmations.push({ key: route.request().headers()["idempotency-key"], prompts: route.request().postDataJSON().moduleTaskPrompts });
      return route.fulfill({ status: 503, json: { error: { message: "暂时不可用，请重试" } } });
    });
    const confirm = page.getByRole("button", { name: kind === "suite" ? "确认并生成 1 张" : "确认并开始批次生成", exact: true });
    await confirm.click();
    await expect(page.getByRole("alert")).toContainText("暂时不可用");
    await confirm.click();
    await expect.poll(() => confirmations.length).toBe(2);
    expect(confirmations[0].prompts).toEqual({ [kind === "suite" ? "suite-hero" : "hero-kv"]: "原始提示词" });
    expect(confirmations[1]).toEqual(confirmations[0]);
  });

  test(`${kind} 编译中切页退出刷新均恢复，只读提示词不重复提交`, async ({ page }) => {
    const state = await setup(page, kind, kind === "hero" ? "compiling_prompt" : "compiling");
    await page.goto(`/projects/${project.id}?tab=${kind}`);
    await expect(page.getByRole("status").filter({ hasText: "正在编译" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "输出类型" });
    await tabs.getByRole("button", { name: kind === "suite" ? "主图" : "详情套图", exact: true }).click();
    await tabs.getByRole("button", { name: kind === "suite" ? "详情套图" : "主图", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "正在编译" })).toBeVisible();
    state.setStatus("awaiting_confirmation");
    const prompt = kind === "suite" ? page.getByLabel("首屏主视觉提示词", { exact: true }) : page.getByRole("textbox", { name: "实时任务提示词", exact: true });
    await expect(prompt).toHaveValue("原始提示词");
    await expect(prompt).not.toBeEditable();
    await page.getByRole("button", { name: "返回项目管理" }).click();
    await expect(page.getByRole("heading", { name: "项目管理", exact: true })).toBeVisible();
    await page.getByRole("article").filter({ hasText: "恢复测试项目" }).getByRole("button", { name: "进入工作台" }).click();
    await page.getByRole("navigation", { name: "输出类型" }).getByRole("button", { name: kind === "suite" ? "详情套图" : "主图", exact: true }).click();
    await expect(prompt).toHaveValue("原始提示词");
    await page.reload();
    await expect(prompt).toHaveValue("原始提示词");
    expect(state.writes()).toBe(0);
  });

  test(`${kind} 失败和恢复读取错误可见，不伪装为空白`, async ({ page }) => {
    const state = await setup(page, kind, "failed");
    state.setUnavailable(true);
    await page.goto(`/projects/${project.id}?tab=${kind}`);
    await expect(page.getByRole("alert")).toContainText("暂时无法读取任务");
    state.setUnavailable(false);
    await expect(page.getByRole("alert")).toContainText("模型额度不足");
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("模型额度不足");
    expect(state.writes()).toBe(0);
  });
}

test("单张主图 V2 恢复时忽略旧草稿，确认发送服务端提示词", async ({ page }) => {
  await setup(page, "hero", "awaiting_confirmation");
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem("picagent-project-store")!);
    Object.assign(saved.state.heroGenerationSessions["recovery-project"], { taskId: "single-v2", taskPrompt: "旧版手动修改" });
    localStorage.setItem("picagent-project-store", JSON.stringify(saved));
  });
  await page.route("**/hero-generations/single-v2", route => route.fulfill({ json: { data: {
    ...task("hero", "awaiting_confirmation"), id: "single-v2", plannerVersion: "v2",
    compiledTaskPrompt: "服务端单图规划", visibleFacts: [], unconfirmedItems: [], confirmedTaskPrompt: null,
  } } }));
  let confirmedPrompt: string | undefined;
  await page.route("**/hero-generations/single-v2/confirm", route => {
    confirmedPrompt = route.request().postDataJSON().taskPrompt;
    return route.fulfill({ status: 503, json: { error: { message: "暂时不可用，请重试" } } });
  });
  await page.goto(`/projects/${project.id}?tab=hero`);
  const prompt = page.getByRole("textbox", { name: "实时任务提示词", exact: true });
  await expect(prompt).toHaveValue("服务端单图规划");
  await expect(prompt).not.toBeEditable();
  await page.getByRole("button", { name: "确认并生成", exact: true }).click();
  await expect.poll(() => confirmedPrompt).toBe("服务端单图规划");
});

test("套图旧项目无本地会话时也持续恢复服务器编译任务", async ({ page }) => {
  const state = await setup(page, "suite", "compiling", false);
  await page.goto(`/projects/${project.id}?tab=suite`);
  await expect(page.getByRole("status").filter({ hasText: "正在编译" })).toBeVisible();
  state.setStatus("awaiting_confirmation");
  await expect(page.getByLabel("首屏主视觉提示词", { exact: true })).toHaveValue("原始提示词");
  expect(state.writes()).toBe(0);
});

test("套图空项目短暂断线后恢复为可编译状态", async ({ page }) => {
  await setup(page, "suite", "compiling", false);
  let offline = true;
  await page.route("**/suite-plans/latest", route => route.fulfill({ status: offline ? 503 : 404, json: { error: { message: offline ? "暂时断线" : "没有套图任务" } } }));
  await page.goto(`/projects/${project.id}?tab=suite`);
  await expect(page.getByRole("alert")).toContainText("暂时断线");
  offline = false;
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成套图提示词", exact: true })).toBeEnabled();
});

test("套图未落库请求可手动重试原请求，恢复本身不重提", async ({ page }) => {
  const state = await setup(page, "suite", "compiling");
  await page.route("**/suite-plans/by-request?*", route => route.fulfill({ json: { data: null } }));
  let submittedKey: string | undefined;
  await page.route("**/suite-plans/compile", route => {
    submittedKey = route.request().headers()["idempotency-key"];
    state.setStatus("awaiting_confirmation");
    return route.fulfill({ json: { data: task("suite", "awaiting_confirmation") } });
  });
  await page.goto(`/projects/${project.id}?tab=suite`);
  await expect(page.getByRole("status").filter({ hasText: "尚未找到记录" })).toBeVisible();
  expect(submittedKey).toBeUndefined();
  await page.getByRole("button", { name: "生成套图提示词", exact: true }).click();
  await expect(page.getByLabel("首屏主视觉提示词", { exact: true })).toHaveValue("原始提示词");
  expect(submittedKey).toBe("compile-key");
  expect(state.writes()).toBe(0);
});

test("套图已有方案重新编译会创建新的幂等请求", async ({ page }) => {
  await setup(page, "suite", "awaiting_confirmation");
  let submittedKey: string | undefined;
  await page.on("dialog", dialog => void dialog.accept());
  await page.route("**/suite-plans/compile", route => {
    submittedKey = route.request().headers()["idempotency-key"];
    return route.fulfill({ json: { data: task("suite", "awaiting_confirmation") } });
  });
  await page.goto(`/projects/${project.id}?tab=suite`);
  await expect(page.getByLabel("首屏主视觉提示词", { exact: true })).toHaveValue("原始提示词");
  await page.getByRole("button", { name: "生成套图提示词", exact: true }).click();
  await expect.poll(() => submittedKey).not.toBe("compile-key");
});

test("套图迟到的恢复响应不能覆盖已确认任务", async ({ page }) => {
  await setup(page, "suite", "awaiting_confirmation", false);
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const confirmed = { ...task("suite", "confirmed"), revision: 2, generationBatchId: "suite-batch" };
  await page.route("**/suite-plans/suite-task", async route => {
    reads++;
    if (reads === 1) {
      await delayed;
      return route.fulfill({ json: { data: task("suite", "awaiting_confirmation") } });
    }
    return route.fulfill({ json: { data: confirmed } });
  });
  await page.route("**/suite-plans/suite-task/confirm", route => route.fulfill({ json: { data: { ...confirmed, batchId: "suite-batch" } } }));
  await page.route("**/generation-batches/suite-batch", route => route.fulfill({ json: { data: { ...task("suite", "queued"), id: "suite-batch", progress: { ...task("suite", "queued").progress, total: 1, queued: 1 } } } }));
  await page.goto(`/projects/${project.id}?tab=suite`);
  await expect.poll(() => reads).toBe(1);
  await page.getByRole("button", { name: "确认并生成 1 张", exact: true }).click();
  await expect(page.getByRole("region", { name: "批次图片进度" })).toBeVisible();
  release();
  await expect(page.getByRole("region", { name: "套图提示词确认" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "批次图片进度" })).toBeVisible();
});

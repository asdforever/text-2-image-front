import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../../src/lib/generation-workspace";
import { modulePlanRequestInput } from "../../src/lib/planning-master";
import type { ApiModulePlan, ApiModulePlanInput } from "../../src/api/client";

const brief = "轻量通勤耳机，重180克，续航资料尚未确认。面向地铁通勤人群。";
const catalog = createDefaultGenerationConfig();
function configFor(mode: "hero" | "suite") {
  const normalize = mode === "hero" ? normalizeHeroConfig : normalizeSuiteConfig;
  return normalize({ selectedAssetIds: ["source-1"], selectedModuleIds: [mode === "hero" ? "hero-kv" : "suite-hero"], planningBrief: brief, styleId: catalog.styleCategories[0].styles[0].id, model: catalog.models[0].id });
}
function planFor(input: ApiModulePlanInput): ApiModulePlan {
  const ids = input.mode === "hero" ? ["hero-scene", "hero-kv"] : ["suite-benefit", "suite-hero", "suite-scene", "suite-angle", "suite-mood", "suite-detail"];
  return { planningContractVersion: "commerce-design-v1", sharedVisualDirection: "统一冷灰品牌色与清晰层级", id: "master-1", mode: input.mode, input, status: "completed", summary: "先解释通勤价值，再建立商品识别", warnings: ["续航需要核实"], createdAt: "2026-09-22T00:00:00Z", modules: ids.map((moduleId, index) => ({ moduleId, taskTitle: index === 0 ? "解释通勤价值" : `商品信息 ${index + 1}`, informationQuestion: index === 0 ? "通勤时如何使用？" : "这张图要说明什么？", productPresence: index === 0 ? "context" : "full", designGuideIds: [index === 0 ? "usage-context" : "visual-hierarchy"], resultCount: 1, moduleParameters: [{ key: "核心卖点", value: "轻量通勤" }], compositionBrief: "产品位于左侧，右侧留文案区", reason: "帮助用户理解商品", visualMechanism: "商品与文字形成清晰主次" })) };
}
async function setup(page: Page, mode: "hero" | "suite", legacyDraft = false) {
  page.on("pageerror", (error) => console.error("Planning UI error:", error.message));
  const config = configFor(mode);
  if (legacyDraft) {
    config.planningBrief = "";
    config.moduleCounts[config.selectedModuleIds[0]] = 4;
  }
  await page.addInitScript(({ config, mode }) => {
    if (sessionStorage.getItem("master-seeded")) return;
    sessionStorage.setItem("master-seeded", "1");
    localStorage.setItem("picagent-project-store", JSON.stringify({ state: { generationDrafts: { [`proj-demo:${mode}`]: { config, updatedAt: "2026-09-22T00:00:00Z" } } }, version: 0 }));
  }, { config, mode });
  const postCalls: Array<{ path: string; body: any; key?: string }> = [];
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      postCalls.push({ path, body: request.postDataJSON(), key: request.headers()["idempotency-key"] });
      return route.fulfill({ status: 503, json: { error: { message: "已捕获编译请求" } } });
    }
    if (path === "/api/generation-config/resolve") return route.fulfill({ json: { data: { configVersion: 1, contentSha256: "a".repeat(64), config: catalog, runtimeModules: { version: "runtime-modules-v1", contentSha256: "c".repeat(64), heroModules: catalog.heroModules, suiteModules: catalog.suiteModules } } } });
    if (path === "/api/projects/proj-demo") return route.fulfill({ json: { data: { id: "proj-demo", name: "规划测试", status: "active", archivedAt: null, selections: {}, createdAt: "2026-09-22T00:00:00Z", updatedAt: "2026-09-22T00:00:00Z", assets: ["source-1", "ref-1", "ref-2"].map((id) => ({ id, kind: "source", state: "available", filename: id === "source-1" ? "耳机.jpg" : `${id}.jpg`, mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-09-22T00:00:00Z" })) } } });
    if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    return route.fulfill({ status: 404, json: { error: { message: "尚无记录" } } });
  });
  return { config, postCalls };
}
async function draft(page: Page, mode: string) {
  return page.evaluate((mode) => JSON.parse(localStorage.getItem("picagent-project-store")!).state.generationDrafts[`proj-demo:${mode}`].config, mode);
}

for (const mode of ["hero", "suite"] as const) {
  test(`${mode} 模块单列摘要与独立编辑`, async ({ page }, testInfo) => {
    await setup(page, mode);
    let saved: ApiModulePlan | undefined;
    await page.route("**/api/projects/proj-demo/module-plans**", async route => {
      if (route.request().method() === "POST") saved = planFor(route.request().postDataJSON());
      return saved ? route.fulfill({ json: { data: saved } }) : route.fulfill({ status: 404, json: { error: { message: "尚无规划" } } });
    });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await triggerInitialPlanning(page);
    const cards = page.locator(".studio-module.is-selected");
    await expect(cards).toHaveCount(mode === "hero" ? 2 : 6);
    await expect(cards.getByRole("textbox")).toHaveCount(0);
    await expect(cards.first()).toContainText("通勤时如何使用？");
    const boxes = await cards.evaluateAll(elements => elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height };
    }));
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].x).toBe(boxes[0].x);
      expect(boxes[i].width).toBe(boxes[0].width);
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height);
    }
    await page.screenshot({ path: testInfo.outputPath("module-list-desktop.png") });
    await cards.first().getByRole("button", { name: "修改第 1 张任务标题" }).click();
    await cards.first().getByLabel("任务标题", { exact: true }).fill("放弃这个标题");
    await cards.first().getByLabel("任务标题", { exact: true }).press("Escape");
    await expect(cards.first()).toContainText("解释通勤价值");
    await expect(page.locator(".generation-config")).toBeVisible();
    await cards.first().getByRole("button", { name: "修改第 1 张任务标题" }).click();
    await cards.first().getByLabel("任务标题", { exact: true }).fill("新的通勤主题");
    await cards.first().getByLabel("任务标题", { exact: true }).press("Enter");
    await cards.first().getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await expect(cards.first().getByRole("textbox", { name: "任务标题", exact: true })).toHaveCount(0);
    await cards.first().getByLabel("本图要讲什么", { exact: true }).fill("介绍地铁通勤的使用方式");
    await expect(cards.first().getByLabel("构图要求（选填）")).not.toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("module-editor-desktop.png") });
    await cards.nth(1).getByRole("button", { name: "编辑第 2 张任务", exact: true }).click();
    await expect(cards.first().getByLabel("本图要讲什么", { exact: true })).toHaveCount(0);
    await expect(cards.first()).toContainText("介绍地铁通勤的使用方式");
    await expect(cards.nth(1).getByLabel("本图要讲什么", { exact: true })).toHaveValue("这张图要说明什么？");
    await page.reload();
    await expect(cards.first()).toContainText("新的通勤主题");
    await expect(cards.first()).toContainText("介绍地铁通勤的使用方式");
    await expect(cards.getByRole("textbox")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "关闭生成配置", exact: true }).first().click();
    await cards.first().getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await expect(cards.first().getByLabel("本图要讲什么", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("module-editor-mobile.png") });
  });

  test(`${mode} 手动同类任务的设计选择独立保存并传给编译`, async ({ page }) => {
    const { postCalls } = await setup(page, mode, true);
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    const cards = page.locator(".studio-module.is-selected");
    await page.getByRole("button", { name: mode === "hero" ? "添加首屏 KV" : "添加首屏主视觉", exact: true }).click();
    const added = cards.nth(1);
    await added.getByRole("button", { name: "修改第 2 张任务标题" }).click();
    await added.getByLabel("任务标题", { exact: true }).fill("成分说明");
    await added.getByLabel("任务标题", { exact: true }).press("Enter");
    await added.getByRole("button", { name: "编辑第 2 张任务", exact: true }).click();
    await added.getByLabel("本图要讲什么", { exact: true }).fill("介绍已确认的成分");
    await added.getByLabel("表达方式", { exact: true }).fill("用大字与成分示意表达");
    await added.getByRole("combobox", { name: "商品出场", exact: true }).selectOption("none");
    await added.locator("summary").filter({ hasText: "构图建议与要求" }).click();
    await added.getByLabel("构图要求（选填）").fill("大标题在上方");
    await cards.first().getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await expect(cards.first().getByRole("combobox", { name: "商品出场", exact: true })).toHaveValue("auto");
    await cards.nth(1).getByRole("button", { name: "编辑第 2 张任务", exact: true }).click();
    await expect(page.getByText("当前生成模块已失效，请重新选择", { exact: true })).toHaveCount(0);
    await page.reload();
    await added.getByRole("button", { name: "编辑第 2 张任务", exact: true }).click();
    await expect(added.getByRole("combobox", { name: "商品出场", exact: true })).toHaveValue("none");
    await expect(added.getByLabel("表达方式", { exact: true })).toHaveValue("用大字与成分示意表达");
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    await expect.poll(() => postCalls.length).toBe(1);
    expect(postCalls[0].body.modules[0].taskDesign).toBeUndefined();
    expect(postCalls[0].body.modules[1].taskDesign).toEqual({ taskTitle: "成分说明", informationQuestion: "介绍已确认的成分", visualMechanism: "用大字与成分示意表达", productPresence: "none" });
    expect(postCalls[0].body.modules[1].moduleParameters).toContainEqual({ key: "构图要求", value: "大标题在上方" });
    await added.getByRole("button", { name: "清除设计选择" }).click();
    await expect(added.getByRole("combobox", { name: "商品出场", exact: true })).toHaveValue("auto");
  });

  test(`${mode} 编译缺少风格时提示并展开，补全后可提交`, async ({ page }) => {
    const { postCalls } = await setup(page, mode, true);
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    const style = page.getByRole("button", { name: catalog.styleCategories[0].styles[0].label, exact: true });
    await style.click();
    await page.getByRole("button", { name: "折叠图片风格", exact: true }).click();
    const submit = page.getByRole("button", { name: "编译提示词", exact: true });
    await submit.click();
    const section = page.locator(".generation-section-card").filter({ hasText: "图片风格" });
    await expect(section.getByRole("alert")).toContainText("请选择图片风格");
    await expect(style).toBeVisible();
    expect(postCalls).toHaveLength(0);
    await page.getByRole("button", { name: "＋ 自定义", exact: true }).click();
    await page.getByRole("textbox", { name: /自定义风格描述/ }).fill("   ");
    await submit.click();
    await expect(section.getByRole("alert")).toContainText("请填写自定义风格描述");
    expect(postCalls).toHaveLength(0);
    await style.click();
    await expect(section.getByRole("alert")).toHaveCount(0);
    await submit.click();
    await expect.poll(() => postCalls.length).toBe(1);
    expect(postCalls[0].body.styleId).toBe(catalog.styleCategories[0].styles[0].id);
  });

  test(`${mode} 旧草稿重新提交每项一张，手动添加同类图独立保存`, async ({ page }) => {
    const { postCalls } = await setup(page, mode, true);
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    const cards = page.locator(".studio-module.is-selected");
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("button", { name: "复制同类任务" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /[上下]移第 .* 张任务/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /生成张数/ })).toHaveCount(0);
    // Submit the untouched legacy count first; simply hiding the selector must not send four images.
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    await expect.poll(() => postCalls.length).toBe(1);
    expect(postCalls[0].body.modules[0].resultCount).toBe(1);
    await page.getByRole("button", { name: mode === "hero" ? "添加首屏 KV" : "添加首屏主视觉", exact: true }).click();
    await expect(cards).toHaveCount(2);
    await cards.nth(1).getByRole("button", { name: "编辑第 2 张任务", exact: true }).click();
    await cards.nth(1).locator("summary").filter({ hasText: "补充参数" }).click();
    await cards.nth(1).getByPlaceholder("填写具体要求").first().fill("第二张独立内容");
    const added = await draft(page, mode);
    expect(new Set(added.selectedModuleIds).size).toBe(2);
    expect(Object.values(added.moduleCounts)).toEqual([1, 1]);
    await page.reload();
    await expect(cards).toHaveCount(2);
    expect((await draft(page, mode)).moduleParameters).toEqual(added.moduleParameters);
    expect(postCalls).toHaveLength(1);
  });

  test(`${mode} 规划资料生成同模块多任务，独立编辑编译并恢复`, async ({ page }) => {
    const { postCalls } = await setup(page, mode);
    let saved: ApiModulePlan | undefined;
    let calls = 0;
    await page.route("**/api/projects/proj-demo/module-plans**", async (route) => {
      if (route.request().method() === "POST") {
        calls++;
        const input = route.request().postDataJSON();
        expect(input.sourceAssetIds).toEqual(["source-1"]);
        expect(input.brief).toBe(brief);
        expect(input.referenceAssetIds).toBeUndefined();
        const base = planFor(input);
        saved = { ...base, modules: [
          { ...base.modules[0], taskId: "detail-lid", moduleId: `${mode}-detail`, compositionBrief: "杯盖局部与整体定位", resultCount: 1 },
          { ...base.modules[0], taskId: "detail-base", taskTitle: "解释杯底结构", productPresence: "detail", moduleId: `${mode}-detail`, compositionBrief: "杯底局部与整体定位", resultCount: 1 },
        ] };
      }
      return saved ? route.fulfill({ json: { data: saved } }) : route.fulfill({ status: 404, json: { error: { message: "尚无规划" } } });
    });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await triggerInitialPlanning(page);
    await expect.poll(async () => (await draft(page, mode)).selectedModuleIds).toEqual(["detail-lid", "detail-base"]);
    const cards = page.locator(".studio-module.is-selected");
    await expect(page.getByRole("combobox", { name: /生成张数/ })).toHaveCount(0);
    await cards.nth(1).getByRole("button", { name: "编辑第 2 张任务", exact: true }).click();
    await cards.nth(1).locator("summary").filter({ hasText: "补充参数" }).click();
    await cards.nth(1).getByPlaceholder("填写具体要求").first().fill("用户只修改杯底任务");
    await page.reload();
    await expect(cards).toHaveCount(2);
    expect(calls).toBe(1);
    const restored = await draft(page, mode);
    expect(restored.planningBrief).toBe(brief);
    expect(restored.selectedModuleIds).toEqual(["detail-lid", "detail-base"]);
    expect(restored.moduleTypes).toMatchObject({ "detail-lid": `${mode}-detail`, "detail-base": `${mode}-detail` });
    expect(restored.moduleParameters["detail-lid"][0].value).toBe("轻量通勤");
    expect(restored.moduleParameters["detail-base"][0].value).toBe("用户只修改杯底任务");
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    await expect.poll(() => postCalls.length).toBe(1);
    expect(postCalls[0].body.modulePlanId).toBe("master-1");
    expect(postCalls[0].body.modules.map((item: any) => [item.taskId, item.moduleId, item.resultCount])).toEqual([
      ["detail-lid", `${mode}-detail`, 1], ["detail-base", `${mode}-detail`, 1],
    ]);
    expect(calls).toBe(1);
  });

  test(`${mode} 显式规划回填顺序数量参数，刷新保留手改且不触发付费请求`, async ({ page }) => {
    const { postCalls } = await setup(page, mode);
    let plans = 0;
    let saved: ApiModulePlan;
    await page.route("**/api/projects/proj-demo/module-plans**", async (route) => {
      if (route.request().method() === "POST") { plans++; saved = planFor(route.request().postDataJSON()); }
      if (!saved!) return route.fulfill({ status: 404, json: { error: { message: "尚无规划" } } });
      await route.fulfill({ json: { data: saved } });
    });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
    await page.getByLabel("商品信息与规划需求", { exact: true }).blur();
    await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
    expect(plans).toBe(0);
    await triggerInitialPlanning(page);
    await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "先解释通勤价值" })).toBeVisible();
    await expect(page.getByText("续航需要核实", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
    const applied = await draft(page, mode);
    expect(applied.selectedModuleIds).toEqual(saved!.modules.map((item) => item.moduleId));
    expect(Object.values(applied.moduleCounts)).toEqual(saved!.modules.map(() => 1));
    expect(applied.moduleParameters[saved!.modules[0].moduleId].filter((item: any) => item.key === "建议构图简案")).toHaveLength(0);
    await page.getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
    await expect(page.getByLabel("本图要讲什么", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "商品出场", exact: true }).first()).toHaveValue("context");
    expect(applied.moduleTaskDetails[saved!.modules[0].moduleId].title).toBe("解释通勤价值");
    await page.locator(".module-task-editor summary").filter({ hasText: "构图建议与要求" }).click();
    await page.getByLabel("构图要求（选填）").first().fill("标题放左上角");
    await page.locator(".module-task-editor summary").filter({ hasText: "补充参数" }).click();
    await page.getByPlaceholder("填写具体要求").first().fill("用户修改后的卖点");
    const edited = await draft(page, mode);
    expect(edited.moduleParameters[saved!.modules[0].moduleId]).toContainEqual({ key: "构图要求", value: "标题放左上角" });
    await page.reload();
    await expect(page.locator(".studio-module.is-selected")).toHaveCount(saved!.modules.length);
    expect((await draft(page, mode)).moduleParameters).toEqual(edited.moduleParameters);
    expect(plans).toBe(1);
    expect(postCalls).toHaveLength(0);
    await page.getByRole("button", { name: catalog.styleCategories[0].styles[1].label, exact: true }).click();
    await expect.poll(async () => (await draft(page, mode)).modulePlanId).toBeUndefined();
  });

  test(`${mode} 编译新资料时替换默认模块并携带规划ID`, async ({ page }) => {
    const { postCalls } = await setup(page, mode);
    let plans = 0;
    await page.route("**/api/projects/proj-demo/module-plans", async (route) => {
      plans++;
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      await route.fulfill({ json: { data: planFor(route.request().postDataJSON()) } });
    });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    await expect.poll(() => postCalls.length).toBe(1);
    expect(plans).toBe(1);
    expect(postCalls[0].body.modulePlanId).toBe("master-1");
    expect(postCalls[0].body.modules).toHaveLength(mode === "hero" ? 2 : 6);
    expect(postCalls[0].body.modules[0].moduleId).toBe(mode === "hero" ? "hero-scene" : "suite-benefit");
    expect(postCalls[0].body.modules.every((item: any) => item.resultCount === 1)).toBe(true);
  });

  test(`${mode} 资料改动后忽略旧响应，恢复planning记录只轮询GET`, async ({ page }) => {
    const { config, postCalls } = await setup(page, mode);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let submitted = false;
    await page.route("**/api/projects/proj-demo/module-plans", async (route) => {
      submitted = true;
      const input = route.request().postDataJSON();
      await pending;
      await route.fulfill({ json: { data: planFor(input) } });
    });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await triggerInitialPlanning(page);
    await expect.poll(() => submitted).toBe(true);
    await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
    await page.getByLabel("商品信息与规划需求", { exact: true }).fill("新的运动场景资料");
    await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
    release();
    await expect(page.getByRole("button", { name: "打开规划大师", exact: true })).toBeEnabled();
    expect((await draft(page, mode)).modulePlanId).toBeUndefined();
    let reads = 0;
    await page.route("**/api/projects/proj-demo/module-plans/**", async (route) => {
      reads++;
      const value = planFor({ ...modulePlanRequestInput(mode, config), brief: "新的运动场景资料" });
      await route.fulfill({ json: { data: { ...value, status: reads === 1 ? "planning" : "completed" } } });
    });
    await page.reload();
    await expect.poll(async () => (await draft(page, mode)).modulePlanId).toBe("master-1");
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(postCalls).toHaveLength(0);
  });
}

test("失败重试保留传输失败的幂等键，确定的规划失败允许下一次新请求", async ({ page }) => {
  await setup(page, "hero");
  const keys: string[] = [];
  await page.route("**/api/projects/proj-demo/module-plans", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) return route.abort("failed");
    if (keys.length === 2) return route.fulfill({ status: 502, json: { error: { code: "MODULE_PLANNER_FAILED", message: "规划失败，请重试" } } });
    return route.fulfill({ json: { data: planFor(route.request().postDataJSON()) } });
  });
  await page.goto("/projects/proj-demo?tab=hero");
  for (let attempt = 0; attempt < 3; attempt++) {
    await triggerInitialPlanning(page);
    await expect(page.getByRole("button", { name: "打开规划大师", exact: true })).toBeEnabled();
  }
  await expect.poll(async () => (await draft(page, "hero")).modulePlanId).toBe("master-1");
  expect(keys[0]).toBe(keys[1]);
  expect(keys[1]).not.toBe(keys[2]);
});

async function triggerInitialPlanning(page: Page) {
  await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
  await page.getByRole("button", { name: "初始规划", exact: true }).click();
  await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
}

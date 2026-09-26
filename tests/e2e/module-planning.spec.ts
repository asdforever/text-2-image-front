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
  return { id: "master-1", mode: input.mode, input, status: "completed", summary: "先解释通勤价值，再建立商品识别", warnings: ["续航需要核实"], createdAt: "2026-09-22T00:00:00Z", modules: ids.map((moduleId) => ({ moduleId, resultCount: 2, moduleParameters: [{ key: "核心卖点", value: "轻量通勤" }, { key: "建议构图简案", value: "产品位于左侧，右侧留文案区" }], compositionBrief: "产品位于左侧，右侧留文案区", reason: "帮助用户理解商品" })) };
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
    if (path === "/api/generation-config") return route.fulfill({ json: { data: { id: "v1", version: 1, content: catalog, contentSha256: "a".repeat(64), createdAt: "2026-09-22T00:00:00Z" } } });
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
  test(`${mode} 编译缺少风格时提示并展开，补全后可提交`, async ({ page }) => {
    const { postCalls } = await setup(page, mode, true);
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    const style = page.getByRole("button", { name: catalog.styleCategories[0].styles[0].label, exact: true });
    await style.click();
    await page.getByRole("button", { name: "折叠图片风格", exact: true }).click();
    const submit = page.getByRole("button", { name: mode === "hero" ? "编译提示词" : "生成套图提示词", exact: true });
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
    await page.getByRole("button", { name: mode === "hero" ? "编译提示词" : "生成套图提示词", exact: true }).click();
    await expect.poll(() => postCalls.length).toBe(1);
    expect(postCalls[0].body.modules[0].resultCount).toBe(1);
    await page.getByRole("button", { name: mode === "hero" ? "添加首屏 KV" : "添加首屏主视觉", exact: true }).click();
    await expect(cards).toHaveCount(2);
    await cards.nth(1).locator("summary").click();
    await cards.nth(1).getByPlaceholder("填写具体要求").first().fill("第二张独立内容");
    const added = await draft(page, mode);
    expect(new Set(added.selectedModuleIds).size).toBe(2);
    expect(Object.values(added.moduleCounts)).toEqual([1, 1]);
    await page.reload();
    await expect(cards).toHaveCount(2);
    expect((await draft(page, mode)).moduleParameters).toEqual(added.moduleParameters);
    expect(postCalls).toHaveLength(1);
  });

  test(`${mode} 参考套图有序输入，同模块多任务独立编辑编译并恢复`, async ({ page }) => {
    const { postCalls } = await setup(page, mode);
    let saved: ApiModulePlan | undefined;
    let calls = 0;
    await page.route("**/api/projects/proj-demo/module-plans**", async (route) => {
      if (route.request().method() === "POST") {
        calls++;
        const input = route.request().postDataJSON();
        expect(input.sourceAssetIds).toEqual(["source-1"]);
        expect(input.referenceAssetIds).toEqual(["ref-2", "ref-1"]);
        const base = planFor(input);
        saved = { ...base, modules: [
          { ...base.modules[0], taskId: "detail-lid", moduleId: `${mode}-detail`, compositionBrief: "杯盖局部与整体定位", resultCount: 1 },
          { ...base.modules[0], taskId: "detail-base", moduleId: `${mode}-detail`, compositionBrief: "杯底局部与整体定位", resultCount: 1 },
        ] };
      }
      return saved ? route.fulfill({ json: { data: saved } }) : route.fulfill({ status: 404, json: { error: { message: "尚无规划" } } });
    });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await page.getByLabel(mode === "hero" ? "主图商品资料" : "详情页商品资料").fill("");
    await page.getByRole("button", { name: "选择参考套图", exact: true }).click();
    await page.getByRole("button", { name: "参考图 ref-1.jpg", exact: true }).click();
    await page.getByRole("button", { name: "参考图 ref-2.jpg", exact: true }).click();
    await page.getByRole("button", { name: "上移参考图 2", exact: true }).click();
    await page.getByRole("button", { name: "自动规划", exact: true }).click();
    await expect.poll(async () => (await draft(page, mode)).selectedModuleIds).toEqual(["detail-lid", "detail-base"]);
    const cards = page.locator(".studio-module.is-selected");
    await expect(page.getByRole("combobox", { name: /生成张数/ })).toHaveCount(0);
    await cards.nth(1).locator("summary").click();
    await cards.nth(1).getByPlaceholder("填写具体要求").first().fill("用户只修改杯底任务");
    await page.reload();
    await expect(cards).toHaveCount(2);
    expect(calls).toBe(1);
    const restored = await draft(page, mode);
    expect(restored.referenceAssetIds).toEqual(["ref-2", "ref-1"]);
    expect(restored.moduleParameters["detail-lid"][0].value).toBe("轻量通勤");
    expect(restored.moduleParameters["detail-base"][0].value).toBe("用户只修改杯底任务");
    await page.getByRole("button", { name: mode === "hero" ? "编译提示词" : "生成套图提示词", exact: true }).click();
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
    await page.getByLabel(mode === "hero" ? "主图商品资料" : "详情页商品资料").blur();
    expect(plans).toBe(0);
    await page.getByRole("button", { name: "自动规划", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "先解释通勤价值" })).toBeVisible();
    await expect(page.getByText("续航需要核实", { exact: true })).toBeVisible();
    const applied = await draft(page, mode);
    expect(applied.selectedModuleIds).toEqual(saved!.modules.map((item) => item.moduleId));
    expect(Object.values(applied.moduleCounts)).toEqual(saved!.modules.map(() => 1));
    expect(applied.moduleParameters[saved!.modules[0].moduleId].filter((item: any) => item.key === "建议构图简案")).toHaveLength(1);
    await page.getByPlaceholder("填写具体要求").first().fill("用户修改后的卖点");
    const edited = await draft(page, mode);
    await page.reload();
    await expect(page.locator(".studio-module.is-selected")).toHaveCount(saved!.modules.length);
    expect((await draft(page, mode)).moduleParameters).toEqual(edited.moduleParameters);
    expect(plans).toBe(1);
    expect(postCalls).toHaveLength(0);
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
    await page.getByRole("button", { name: mode === "hero" ? "编译提示词" : "生成套图提示词", exact: true }).click();
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
    await page.getByRole("button", { name: "自动规划", exact: true }).click();
    await expect.poll(() => submitted).toBe(true);
    await page.getByLabel(mode === "hero" ? "主图商品资料" : "详情页商品资料").fill("新的运动场景资料");
    release();
    await expect(page.getByRole("button", { name: "自动规划", exact: true })).toBeEnabled();
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
    await page.getByRole("button", { name: "自动规划", exact: true }).click();
    await expect(page.getByRole("button", { name: "自动规划", exact: true })).toBeEnabled();
  }
  await expect.poll(async () => (await draft(page, "hero")).modulePlanId).toBe("master-1");
  expect(keys[0]).toBe(keys[1]);
  expect(keys[1]).not.toBe(keys[2]);
});

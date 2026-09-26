import { expect, test, type Page } from "playwright/test";

import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

const sourceId = "source-1";
const projectDetail = {
  id: "proj-demo", name: "演示项目", status: "active", archivedAt: null,
  createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", selections: {},
  assets: [{
    id: sourceId, kind: "source", sourceAssetId: null, generationSnapshotId: null,
    state: "available", filename: "充电宝-正面.jpg", mimeType: "image/jpeg", byteSize: 1024,
    width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-09-14T00:00:00Z",
  }],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("suite-test-initialized")) {
      window.localStorage.clear();
      sessionStorage.setItem("suite-test-initialized", "true");
    }
    window.localStorage.setItem("picagent-theme", JSON.stringify({ state: { theme: "light" }, version: 0 }));
  });
  await mockWorkbenchApis(page);
  await page.route("**/api/projects/proj-demo/reverse-bindings?target=*", route => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
});

test("主图工作台使用真实配置接口并保留模块数量控件", async ({ page }, testInfo) => {
  await page.goto("/projects/proj-demo?tab=hero");

  await expect(page.getByLabel("输出类型").getByRole("button", { name: "主图", exact: true })).toHaveClass(/active/);
  await expect(page.getByRole("complementary", { name: "生成配置" })).toBeVisible();
  await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
  await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
  await page.getByRole("button", { name: /首屏 KV/ }).click();
  await expect(page.getByLabel("首屏 KV生成张数")).toHaveValue("1");
  await expect(page.getByRole("button", { name: "编译提示词" })).toBeVisible();
  await page.getByRole("button", { name: "切换到暗色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("studio-dark.png") });
  await page.getByRole("button", { name: "切换到亮色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("收起配置明细后保留素材、风格、模块数量与补充参数", async ({ page }) => {
  await page.goto("/projects/proj-demo?tab=hero");
  await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
  await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
  await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
  await expect(page.getByRole("region", { name: "图片预览" }).locator(".studio-stage-image")).toHaveAttribute("src", /source-1\/preview$/);
  await page.getByLabel("风格分类", { exact: true }).selectOption("digital");
  await page.getByRole("button", { name: /冷调精密/ }).click();
  await page.getByLabel("风格分类", { exact: true }).selectOption("basic");
  await page.getByLabel("风格分类", { exact: true }).selectOption("digital");
  await expect(page.getByRole("button", { name: /冷调精密/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /首屏 KV 建立第一眼识别/ }).click();
  await page.getByLabel("首屏 KV生成张数").selectOption("3");
  const parameters = page.getByLabel("首屏 KV参数", { exact: true });
  await expect(parameters.getByPlaceholder("填写具体要求").first()).not.toBeVisible();
  await page.getByText(/^首屏 KV补充参数/).click();
  await parameters.getByPlaceholder("填写具体要求").first().fill("右侧留白，展示产品接口");
  await page.getByText(/^首屏 KV补充参数/).click();
  await page.getByText(/^首屏 KV补充参数/).click();
  await expect(parameters.getByPlaceholder("填写具体要求").first()).toHaveValue("右侧留白，展示产品接口");
  await expect(page.getByLabel("首屏 KV生成张数")).toHaveValue("3");
});

test("图片工作室在左侧配置，真实结果可切换且不触发生图", async ({ page }, testInfo) => {
  let generationRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /generation|compile|confirm/.test(request.url())) generationRequests++;
  });
  await page.route("**/api/projects/proj-demo", (route) => route.fulfill({ json: { data: {
    ...projectDetail,
    assets: [...projectDetail.assets, ...["result-1", "result-2"].map((id) => ({
      ...projectDetail.assets[0], id, kind: "generated", filename: `${id}.png`,
    }))],
  } } }));
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/proj-demo?tab=hero");
  const stage = page.getByRole("region", { name: "图片预览" });
  await expect(page.getByRole("region", { name: "生成结果", exact: true })).toBeVisible();
  const preview = stage.locator(".studio-stage-image");
  await page.getByRole("button", { name: "查看 result-2.png", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(preview).toHaveAttribute("src", /result-2\/preview$/);
  await page.getByRole("button", { name: "放大图片", exact: true }).click();
  await expect(stage.getByText("125%", { exact: true })).toBeVisible();
  const resultBox = await page.locator(".generation-result").boundingBox();
  const configBox = await page.getByRole("complementary", { name: "生成配置" }).boundingBox();
  expect(configBox!.x + configBox!.width).toBeLessThanOrEqual(resultBox!.x + 1);
  await page.getByRole("button", { name: "适应画面", exact: true }).click();
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  const imageBox = await preview.boundingBox();
  const viewportBox = await stage.locator(".studio-stage-viewport").boundingBox();
  expect(imageBox!.height).toBeLessThanOrEqual(viewportBox!.height + 1);
  await page.screenshot({ path: testInfo.outputPath("studio-desktop.png") });
  await page.getByRole("button", { name: "查看图片详情", exact: true }).click();
  await expect(page.getByRole("button", { name: "版本记录", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const panelBox = await page.locator(".right-panel").boundingBox();
  expect(panelBox!.width).toBeGreaterThan(280);
  await page.getByRole("button", { name: "关闭素材面板", exact: true }).click();
  await expect(page.getByRole("button", { name: "版本记录", exact: true })).toHaveCount(0);
  expect(generationRequests).toBe(0);
});

test("国内国外均可选择具体平台，切换后保留真实平台选项", async ({ page }) => {
  await page.goto("/projects/proj-demo?tab=hero");
  await page.getByLabel("国外电商平台", { exact: true }).selectOption("amazon");
  await expect(page.getByLabel("国外电商平台", { exact: true })).toHaveValue("amazon");
  await expect(page.getByLabel("国内电商平台", { exact: true })).toHaveValue("");
  await page.getByLabel("国内电商平台", { exact: true }).selectOption("jd");
  await expect(page.getByLabel("国内电商平台", { exact: true })).toHaveValue("jd");
  await expect(page.getByLabel("国外电商平台", { exact: true })).toHaveValue("");
});

test("长素材名不撑宽配置栏，模块张数和参数无需横向滚动", async ({ page }, testInfo) => {
  const filename = "batch-2e139351-e7d8-4b13-b565-f7a86fafb241-2e7cfdd3-b38e-4151-aa91-2c34948afad1.png";
  await page.route("**/api/projects/proj-demo", (route) => route.fulfill({ json: { data: {
    ...projectDetail, assets: [{ ...projectDetail.assets[0], filename }],
  } } }));
  for (const tab of ["hero", "suite"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/proj-demo?tab=${tab}`);
    await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
    await page.getByRole("button", { name: filename, exact: true }).click();
    await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
    const moduleName = tab === "hero" ? "首屏 KV" : "首屏主视觉";
    await page.getByRole("button", { name: new RegExp(`^${moduleName} `) }).click();
    const scroll = page.locator(".generation-config-scroll");
    const count = page.getByLabel(`${moduleName}生成张数`);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await expect.poll(() => scroll.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await count.scrollIntoViewIfNeeded();
      const panelBox = await scroll.boundingBox();
      const countBox = await count.boundingBox();
      expect(countBox!.x + countBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
      await count.selectOption("3");
      await page.locator(".studio-module-parameters > summary").first().click();
      const parameter = page.getByLabel(`${moduleName}参数`).getByPlaceholder("填写具体要求").first();
      await parameter.fill("长参数内容".repeat(35));
      await expect.poll(() => scroll.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await expect(count).toHaveValue("3");
      await page.screenshot({ path: testInfo.outputPath(`${tab}-${width}-no-overflow.png`) });
      await page.locator(".studio-module-parameters > summary").first().click();
    }
  }
});

test("空结果不伪造图片，选择素材后显示素材预览", async ({ page }) => {
  await page.goto("/projects/proj-demo?tab=hero");
  const stage = page.getByRole("region", { name: "图片预览" });
  await expect(stage).toBeVisible();
  await expect(stage.locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
  await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
  await expect(stage.locator(".studio-stage-image")).toHaveAttribute("src", /source-1\/preview$/);
  await expect(stage.getByText("素材预览", { exact: true })).toBeVisible();
  await expect(page.locator(".c-result-art")).toHaveCount(0);
});

test("移动端先显示图片，配置抽屉可关闭且页面无横向溢出", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/proj-demo?tab=hero");
  await expect(page.getByRole("region", { name: "图片预览" })).toBeVisible();
  await page.getByRole("button", { name: "展开配置", exact: true }).click();
  await expect(page.getByRole("button", { name: "编译提示词", exact: true })).toBeInViewport();
  const configBox = await page.getByRole("complementary", { name: "生成配置" }).boundingBox();
  const workspaceBox = await page.locator(".generation-workspace").boundingBox();
  expect(Math.abs(configBox!.x - workspaceBox!.x)).toBeLessThan(1);
  await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
  await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
  await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("studio-mobile-config.png") });
  await page.getByRole("button", { name: "关闭生成配置", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "展开配置", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("studio-mobile.png") });
});

test("顶部画布替代视频入口，所有图片工作区均可进入当前项目画布", async ({ page }) => {
  for (const tab of ["base", "hero", "suite"]) {
    await page.goto(`/projects/proj-demo?tab=${tab}`);
    const tabs = page.getByRole("navigation", { name: "输出类型" });
    await expect(tabs.getByRole("button", { name: "视频", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "画布", exact: true })).toHaveCount(1);
    await tabs.getByRole("button", { name: "画布", exact: true }).click();
    await expect(page).toHaveURL(/\/suites\/proj-demo\/board$/);
  }
  await page.goto("/projects/proj-demo?tab=video");
  await expect(page).toHaveURL(/\/suites\/proj-demo\/board$/);
  await page.goto("/projects/proj-demo?tab=suite");
  await page.keyboard.press("Control+Tab");
  await expect(page).toHaveURL(/\/suites\/proj-demo\/board$/);
});

test("套图规划、编辑提示词、确认和批次结果均走服务端接口，排序留在画布", async ({ page }, testInfo) => {
  page.on("dialog", (dialog) => dialog.accept());
  const state = createSuiteApiState();
  await mockSuiteApis(page, state);
  await page.goto("/projects/proj-demo?tab=suite");

  await expect(page.getByRole("button", { name: "生成套图提示词" })).toBeVisible();
  await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
  await page.getByRole("button", { name: /充电宝-正面\.jpg/ }).click();
  await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
  await page.getByLabel("风格分类", { exact: true }).selectOption("digital");
  await page.getByRole("button", { name: /冷调精密/ }).click();
  await page.getByRole("complementary", { name: "生成配置" }).getByRole("button", { name: /首屏主视觉/ }).click();
  await page.getByRole("complementary", { name: "生成配置" }).getByRole("button", { name: /核心卖点图/ }).click();
  await expect(page.getByRole("combobox", { name: /生成张数/ })).toHaveCount(0);
  await page.getByLabel("首屏主视觉参数").getByPlaceholder("填写具体要求").first().fill("第 1 张突出体积");
  await page.getByText(/^核心卖点图补充参数/).click();
  await page.getByLabel("核心卖点图参数").getByPlaceholder("填写具体要求").first().fill("第 2 张说明三口快充参数");
  await page.getByRole("button", { name: "生成套图提示词" }).click();

  await expect(page.getByRole("region", { name: "套图提示词确认" }).getByRole("textbox")).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("button", { name: "确认并生成 3 张", exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath("suite-plan-refined.png") });
  const resultBody = page.locator(".suite-unified .generation-result-body");
  await resultBody.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(page.getByLabel("核心卖点图提示词", { exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "确认并生成 3 张", exact: true })).toBeInViewport({ ratio: 1 });
  await resultBody.evaluate((node) => { node.scrollTop = 0; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "确认并生成 3 张", exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("suite-plan-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const firstCopy = page.getByLabel("首屏主视觉提示词", { exact: true });
  await firstCopy.fill("首屏突出 65W 快充与便携体积");
  await expect(firstCopy).toHaveValue("首屏突出 65W 快充与便携体积");

  // 图片配置与提示词确认不再承担拼接排序。
  await expect(page.getByRole("button", { name: /^(上移|下移)/ })).toHaveCount(0);
  await expect(page.locator(".suite-prompt-card").first()).toContainText("首屏主视觉");
  await expect(firstCopy).toHaveValue("首屏突出 65W 快充与便携体积");

  await page.getByRole("button", { name: "确认并生成 3 张" }).click();
  await expect(page.getByRole("region", { name: "批次图片进度" }).locator("img")).toHaveCount(3);
  expect(state.confirmedPrompts["suite-hero"]).toBe("首屏突出 65W 快充与便携体积");
  expect(state.compileCalls).toBe(1);
  expect(state.confirmCalls).toBe(1);
});

test("刷新后从最新规划和关联批次恢复套图结果", async ({ page }) => {
  const state = createSuiteApiState();
  state.plan = makePlan("awaiting_confirmation");
  await mockSuiteApis(page, state);
  await page.goto("/projects/proj-demo?tab=suite");
  await expect(page.locator(".suite-prompt-card")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "确认并生成 3 张" })).toBeVisible();
  await page.getByLabel("首屏主视觉提示词", { exact: true }).fill("刷新仍保留的手动修改");
  await page.reload();
  await expect(page.getByLabel("首屏主视觉提示词", { exact: true })).toHaveValue("刷新仍保留的手动修改");

  state.plan = makePlan("confirmed");
  state.plan.generationBatchId = "suite-batch-1";
  state.batchMode = "complete";
  await page.reload();
  await expect(page.getByRole("region", { name: "批次图片进度" }).locator("img")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "确认并生成 3 张" })).toHaveCount(0);
  expect(state.confirmCalls).toBe(0);
});

test("部分失败的套图只重试失败槽位并保留其他结果", async ({ page }) => {
  const state = createSuiteApiState();
  state.plan = makePlan("confirmed");
  state.batchMode = "partial";
  await mockSuiteApis(page, state);
  await page.goto("/projects/proj-demo?tab=suite");
  await expect(page.getByText("图片生成失败，请单独重试", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重试此张", exact: true }).click();
  await expect.poll(() => state.retryCalls).toBe(1);
  await expect(page.getByRole("region", { name: "批次图片进度" }).locator("img")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "生成结果缩略图" }).getByRole("button")).toHaveCount(3);
});

test("在 1280 宽度保持独立滚动，窄屏可用键盘收起和恢复配置栏", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/projects/proj-demo?tab=suite");
  await expect(page.getByRole("button", { name: "生成套图提示词" })).toBeVisible();
  const configBox = await page.getByRole("complementary", { name: "生成配置" }).boundingBox();
  const resultBox = await page.locator(".generation-result").boundingBox();
  expect(configBox!.x + configBox!.width).toBeLessThanOrEqual(resultBox!.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  expect(await page.locator(".generation-config-scroll").evaluate((node) => node.scrollHeight > node.clientHeight)).toBeTruthy();

  await page.setViewportSize({ width: 900, height: 720 });
  await expect(page.getByRole("complementary", { name: "生成配置" })).toBeVisible();
  await page.keyboard.press("Escape");
  const restore = page.getByRole("button", { name: "展开配置" });
  await expect(restore).toBeFocused();
  await restore.press("Enter");
  await expect(page.getByRole("complementary", { name: "生成配置" })).toBeVisible();
});

test("确认失败保留提示词，直接确认无需失焦保存，重试使用相同幂等键", async ({ page }) => {
  const state = createSuiteApiState();
  await mockSuiteApis(page, state);
  const requests: Array<{ key: string | undefined; body: Record<string, unknown> }> = [];
  await page.route("**/api/projects/proj-demo/suite-plans/*/confirm", async (route) => {
    requests.push({ key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON() });
    if (requests.length === 1) return route.fulfill({ status: 503, json: { error: { message: "暂时不可用，请重试" } } });
    return route.fallback();
  });
  await page.goto("/projects/proj-demo?tab=suite");
  const prompt = page.getByLabel("首屏主视觉提示词", { exact: true });
  await prompt.fill("");
  await expect(page.getByRole("button", { name: "确认并生成 3 张" })).toBeDisabled();
  await prompt.fill("刚输入的提示词，不触发失焦保存");
  await page.getByRole("button", { name: "确认并生成 3 张" }).click();
  await expect(page.getByRole("alert")).toContainText("暂时不可用");
  await expect(prompt).toHaveValue("刚输入的提示词，不触发失焦保存");
  await page.reload();
  await expect(prompt).toHaveValue("刚输入的提示词，不触发失焦保存");
  await page.getByRole("button", { name: "确认并生成 3 张" }).click();
  await expect(page.getByRole("region", { name: "批次图片进度" }).locator("img")).toHaveCount(3);
  expect(requests).toHaveLength(2);
  expect(requests[1].key).toBe(requests[0].key);
  expect(requests[1].body.moduleTaskPrompts).toMatchObject({ "suite-hero": "刚输入的提示词，不触发失焦保存" });
});

test("排队时展示执行器离线提示，恢复在线后仍无需重复确认", async ({ page }) => {
  const state = createSuiteApiState();
  state.plan = makePlan("confirmed");
  await mockSuiteApis(page, state);
  let online = false;
  await page.route("**/api/generation-worker/status", (route) => route.fulfill({ json: { data: { status: online ? "online" : "offline", lastSeenAt: null } } }));
  await page.goto("/projects/proj-demo?tab=suite");
  await expect(page.getByRole("status").filter({ hasText: "生图服务未运行" })).toBeVisible();
  online = true;
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "生图服务在线" })).toBeVisible();
  expect(state.confirmCalls).toBe(0);
});

async function mockWorkbenchApis(page: Page) {
  await page.route("**/api/generation-worker/status", (route) => route.fulfill({ json: { data: { status: "online", lastSeenAt: null } } }));
  await page.route("**/preview/*", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  const config = createDefaultGenerationConfig();
  await page.route("**/api/generation-config", async (route) => {
    await route.fulfill({ json: { data: { id: "version-1", version: 1, content: config, contentSha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" } } });
  });
  await page.route("**/api/projects/proj-demo", async (route) => {
    if (route.request().url().includes("/suite-plans/") || route.request().url().includes("/generation-batches/")) return route.fallback();
    await route.fulfill({ json: { data: projectDetail } });
  });
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ status: 404, json: { error: { message: "测试项目没有画布任务" } } }));
  await page.route("**/api/projects/proj-demo/suite-plans/latest", (route) => route.fulfill({ status: 404, json: { error: { message: "没有规划" } } }));
}

type SuiteApiState = {
  plan: ReturnType<typeof makePlan>;
  compileCalls: number;
  confirmCalls: number;
  retryCalls: number;
  confirmedPrompts: Record<string, string>;
  batchMode: "queued" | "partial" | "complete";
};

function createSuiteApiState(): SuiteApiState {
  return { plan: makePlan("awaiting_confirmation"), compileCalls: 0, confirmCalls: 0, retryCalls: 0, confirmedPrompts: {}, batchMode: "queued" };
}

async function mockSuiteApis(page: Page, state: SuiteApiState) {
  await page.route("**/api/projects/proj-demo/suite-plans/suite-plan-1", (route) => route.fulfill({ json: { data: state.plan } }));
  await page.route("**/api/projects/proj-demo", (route) => route.fulfill({ json: { data: {
    ...projectDetail,
    assets: [...projectDetail.assets, ...makeBatch(state.batchMode).slots.filter((slot) => slot.status === "succeeded").map((slot) => ({
      ...projectDetail.assets[0], id: slot.generatedAssetId, kind: "generated", filename: `${slot.moduleKey}-${slot.ordinal}.png`, generationSnapshotId: slot.id,
    }))],
  } } }));
  await page.route("**/api/projects/proj-demo/suite-plans/latest", async (route) => {
    if (state.plan.status === "awaiting_confirmation" || state.plan.status === "confirmed") await route.fulfill({ json: { data: state.plan } });
    else await route.fulfill({ status: 404, json: { error: { message: "规划不存在" } } });
  });
  await page.route("**/api/projects/proj-demo/suite-plans/compile", async (route) => {
    state.compileCalls += 1;
    state.plan = makePlan("awaiting_confirmation");
    await route.fulfill({ status: 201, json: { data: state.plan } });
  });
  await page.route("**/api/projects/proj-demo/suite-plans/*/modules/*", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const moduleId = route.request().url().split("/").pop()!;
    const module = state.plan.modules.find((item) => item.id === moduleId);
    if (module) {
      Object.assign(module, Object.fromEntries(Object.entries(body).filter(([key]) => !key.startsWith("expected"))));
      module.revision += 1;
      state.plan.revision += 1;
    }
    await route.fulfill({ json: { data: state.plan } });
  });
  await page.route("**/api/projects/proj-demo/suite-plans/*/order", async (route) => {
    const body = route.request().postDataJSON() as { moduleIds: string[] };
    state.plan.modules.sort((a, b) => body.moduleIds.indexOf(a.id) - body.moduleIds.indexOf(b.id)).forEach((module, index) => { module.position = index + 1; });
    state.plan.revision += 1;
    await route.fulfill({ json: { data: state.plan } });
  });
  await page.route("**/api/projects/proj-demo/suite-plans/*/confirm", async (route) => {
    state.confirmCalls += 1;
    state.confirmedPrompts = route.request().postDataJSON().moduleTaskPrompts;
    state.plan.status = "confirmed";
    state.plan.generationBatchId = "suite-batch-1";
    state.batchMode = "complete";
    await route.fulfill({ json: { data: { ...state.plan, batchId: "suite-batch-1" } } });
  });
  await page.route("**/api/projects/proj-demo/generation-batches/suite-batch-1", async (route) => {
    await route.fulfill({ json: { data: makeBatch(state.batchMode) } });
  });
  await page.route("**/api/projects/proj-demo/generation-batches/suite-batch-1/slots/*/retry", async (route) => {
    state.retryCalls += 1;
    state.batchMode = "complete";
    await route.fulfill({ json: { data: { slot: { id: "slot-benefit-2" } } } });
  });
}

function makePlan(status: "awaiting_confirmation" | "confirmed") {
  const card = (content: string) => ({ content, source: "test", contentSha256: "d".repeat(64) });
  return {
    id: "suite-plan-1", projectId: "proj-demo", status, revision: 1, snapshot: {},
    sourceAssets: [{ id: sourceId, sha256: "b".repeat(64) }],
    constraints: { market: card("淘宝平台约束"), style: card("冷调精密风格"), authenticity: card("保持商品真实性") },
    references: [], generationBatchId: status === "confirmed" ? "suite-batch-1" : null,
    error: null, createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: status === "confirmed" ? "2026-09-14T00:00:01Z" : null,
    modules: [
      { id: "plan-module-hero", moduleKey: "suite-hero", position: 1, resultCount: 1, revision: 1, title: "首屏主视觉", copySummary: "首屏卖点", visualDirection: "突出产品体积", moduleParameters: [{ key: "首要信息", value: "" }], promptSnapshot: {}, compiledTaskPrompt: "首屏提示词", currentTaskPrompt: "首屏提示词", visibleFacts: ["黑色主体"], unconfirmedItems: ["续航未知"] },
      { id: "plan-module-benefit", moduleKey: "suite-benefit", position: 2, resultCount: 2, revision: 1, title: "核心卖点图", copySummary: "卖点摘要", visualDirection: "说明三口快充", moduleParameters: [{ key: "核心卖点", value: "" }], promptSnapshot: {}, compiledTaskPrompt: "卖点提示词", currentTaskPrompt: "卖点提示词", visibleFacts: ["三口接口"], unconfirmedItems: [] },
    ],
  };
}

function makeBatch(mode: SuiteApiState["batchMode"]) {
  const completed = mode === "complete";
  const partial = mode === "partial";
  const modules = [
    { id: "task-hero", moduleKey: "suite-hero", position: 1, resultCount: 1, constraints: {}, compiledTaskPrompt: "首屏提示词", visibleFacts: [], unconfirmedItems: [], confirmedTaskPrompt: "首屏提示词", finalPromptSha256: null },
    { id: "task-benefit", moduleKey: "suite-benefit", position: 2, resultCount: 2, constraints: {}, compiledTaskPrompt: "卖点提示词", visibleFacts: [], unconfirmedItems: [], confirmedTaskPrompt: "卖点提示词", finalPromptSha256: null },
  ];
  const slots = [
    { id: "slot-hero-1", moduleTaskId: "task-hero", moduleKey: "suite-hero", ordinal: 1, status: completed || partial ? "succeeded" : "queued", generatedAssetId: completed || partial ? "asset-hero-1" : null, generatedAssetPreviewUrl: completed || partial ? "/preview/hero-1" : null, error: null },
    { id: "slot-benefit-1", moduleTaskId: "task-benefit", moduleKey: "suite-benefit", ordinal: 1, status: completed || partial ? "succeeded" : "queued", generatedAssetId: completed || partial ? "asset-benefit-1" : null, generatedAssetPreviewUrl: completed || partial ? "/preview/benefit-1" : null, error: null },
    { id: "slot-benefit-2", moduleTaskId: "task-benefit", moduleKey: "suite-benefit", ordinal: 2, status: completed ? "succeeded" : partial ? "failed" : "queued", generatedAssetId: completed ? "asset-benefit-2" : null, generatedAssetPreviewUrl: completed ? "/preview/benefit-2" : null, error: partial ? { code: "PROVIDER_FAILED", message: "图片生成失败，请单独重试" } : null },
  ];
  return {
    id: "suite-batch-1", projectId: "proj-demo", sourceAssetId: sourceId, kind: "suite", sourcePlanId: "suite-plan-1", status: completed ? "succeeded" : partial ? "partially_failed" : "queued",
    createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z", confirmedAt: completed ? "2026-09-14T00:00:01Z" : null, completedAt: completed ? "2026-09-14T00:00:02Z" : null,
    modules, slots, progress: { total: 3, queued: completed || partial ? 0 : 3, leased: 0, dispatching: 0, succeeded: completed ? 3 : partial ? 2 : 0, failed: partial ? 1 : 0, cancelled: 0, needsRetry: 0, completed: completed ? 3 : partial ? 3 : 0 },
  };
}

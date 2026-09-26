import { expect, test, type Page } from "playwright/test";

// Legacy board links now load the project shell before the embedded canvas.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/projects/proj-demo", route => route.fulfill({ json: { data: {
    id: "proj-demo", name: "画布测试项目", status: "active", assets: [], selections: {},
    createdAt: "2026-09-24T08:00:00Z", updatedAt: "2026-09-24T08:00:00Z",
  } } }));
});

const now = "2026-09-17T08:00:00Z";
const asset = (id: string, kind = "source") => ({ id, kind, sourceAssetId: null, generationSnapshotId: null, state: "available", filename: `${id}-产品图片.png`, mimeType: "image/png", byteSize: 100, width: 1000, height: 1000, sha256: id, createdAt: now });

test("风格统一卡片显示真实提示词和参考模式，不提供普通版本替换", async ({ page }, testInfo) => {
  await setup(page);
  const step = { id: "style-harmonization:task", kind: "style-harmonization", title: "局部风格统一", sourceAssetIds: ["source-1", "white-1"], outputAssetIds: ["hero-1"], outputVersionIds: [], taskPrompt: "参考图片的柔和暖光，保留商品与文字", finalPrompt: "商品真实性约束\n轻量编辑约束\n完整风格要求：柔和暖光", constraints: {}, parameters: { styleMode: "reference", providerModel: "example-model", aspectRatio: "1:1", resolution: "标准 1K", referenceAsset: { filename: "参考图片.png" } }, canRegenerate: false };
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "风格统一测试" }, tasks: [], inputImages: [], generationSteps: [step], generationTracks: [], layout: null } } }));
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto("/suites/proj-demo/board");
  const card = page.locator(".ic-generation-node");
  await expect(card.locator("header")).toContainText("风格统一");
  await expect(card).toContainText(step.taskPrompt);
  await expect(card).toContainText("参考图片");
  await expect(card.getByRole("button", { name: "修改提示词并生成" })).toHaveCount(0);
  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("style-card.png") });
  await card.getByRole("button", { name: "查看生成依据" }).click();
  const dialog = page.getByRole("dialog", { name: "生成依据" });
  await expect(dialog).toContainText(step.finalPrompt);
  await expect(dialog).toContainText("参考图片.png");
});

test("画布可以进入全屏工作区并通过按钮或 Esc 退出", async ({ page }) => {
  await setup(page);
  await page.goto("/suites/proj-demo/board");
  const studio = page.locator(".ic-studio");
  await expect(page.getByRole("button", { name: "进入画布全屏" })).toBeVisible();
  await page.getByRole("button", { name: "进入画布全屏" }).click();
  await expect(studio).toHaveClass(/is-fullscreen/);
  await expect(page.getByRole("button", { name: "项目图片", exact: true })).not.toHaveClass(/is-active/);
  await expect(page.getByRole("button", { name: "退出画布全屏" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(studio).not.toHaveClass(/is-fullscreen/);
  await expect(page.getByRole("button", { name: "项目图片", exact: true })).toHaveClass(/is-active/);
  await expect(page.getByRole("button", { name: "进入画布全屏" })).toBeVisible();
});

async function setup(page: Page) {
  const state = { assets: [asset("source-1"), asset("hero-1", "generated"), asset("white-1", "white_background")], layout: null as any, deletes: 0, generations: 0 };
  await page.route("**/api/projects/proj-demo/assets", (route) => route.fulfill({ json: { data: state.assets } }));
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "充电器视觉方案" }, tasks: [], inputImages: [], batches: [], planSnapshot: null, layout: state.layout } } }));
  await page.route("**/api/suites/proj-demo/workbench/layout", async (route) => {
    state.layout = { ...route.request().postDataJSON(), layoutVersion: (state.layout?.layoutVersion ?? 0) + 1 };
    await route.fulfill({ json: { data: state.layout } });
  });
  await page.route("**/api/projects/proj-demo/assets/*", async (route) => { if (route.request().method() === "DELETE") state.deletes++; await route.abort(); });
  await page.route("**/api/**/generation", async (route) => { state.generations++; await route.abort(); });
  return state;
}

test("修改图在画布视野外时可从顶部入口直接定位，刷新后入口仍可用", async ({ page }) => {
  const state = await setup(page);
  state.assets.push(asset("edited-1", "generated"));
  state.layout = {
    layoutVersion: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{ nodeId: "edit-child:edit-1", x: 48, y: 8140, hidden: false }],
    groups: [],
  } as any;
  const workbench = {
    suite: { id: "proj-demo", name: "画布编辑项目" }, tasks: [], inputImages: [],
    batches: [], planSnapshot: null, layout: state.layout,
    imageEditChildren: [{
      task: { id: "edit-1", sourceCardId: "asset:source-1", summary: "更换背景", status: "succeeded", currentVersionId: "version-1", createdAt: now },
      snapshot: { sourceVersionId: "source-1", operations: [] }, attempts: [],
      versions: [{ id: "version-1", versionNumber: 1, previewUrl: "/api/projects/proj-demo/assets/edited-1/preview", width: 1000, height: 1000 }],
    }],
  };
  await page.route("**/api/suites/proj-demo/workbench", route => route.fulfill({ json: { data: { ...workbench, layout: state.layout } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/suites/proj-demo/board");
  const card = page.locator('[data-id="edit-child:edit-1"]');
  await expect(card).toBeAttached();
  const visibleInCanvas = async () => {
    const box = await card.boundingBox();
    const canvas = await page.locator(".ic-canvas").boundingBox();
    return Boolean(box && canvas && box.y < canvas.y + canvas.height && box.y + box.height > canvas.y);
  };
  expect(await visibleInCanvas()).toBe(false);
  await page.getByRole("button", { name: "查看最新修改图" }).click();
  await expect.poll(visibleInCanvas).toBe(true);
  await expect(card.locator("img")).toHaveAttribute("src", "/api/projects/proj-demo/assets/edited-1/preview");
  await page.reload();
  await expect(page.getByRole("button", { name: "查看最新修改图" })).toBeVisible();
});

test("旧风格可预览完整绑定正文，补全仅随确认提交且切换版本会重置", async ({ page }, testInfo) => {
  const state = await setup(page);
  state.assets.push(asset("hero-v2", "generated"));
  const step = { id: "hero", kind: "hero", title: "棚拍主图", sourceAssetIds: ["white-1"], outputAssetIds: ["hero-1"], outputVersionIds: [], finalPrompt: "历史短提示词", taskPrompt: "产品居中", constraints: { style: { content: "柔和棚拍光线与真实质感", source: "style_description", promptVersionId: "bound-version", promptTemplateId: "bound-template" } }, parameters: {} };
  const revisions = ["original", "v2"].map((id, i) => ({ ...step, id, number: i + 1, status: "succeeded", outputs: [{ index: 0, assetId: i ? "hero-v2" : "hero-1" }], createdAt: now }));
  const track = { stepId: step.id, title: step.title, kind: step.kind, originalAssetIds: ["hero-1"], currentAssetIds: ["hero-v2"], revisions };
  const body = "高级棚拍完整正文\n深色无缝背景，100mm 微距镜头，f/8，轮廓光勾勒边缘，无文字。";
  let submitted: any = null;
  let failPreview = false;
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "补全测试" }, tasks: [], inputImages: [], generationSteps: [step], generationTracks: [track], layout: null } } }));
  await page.route("**/api/projects/proj-demo/canvas/constraint-preview?*", (route) => failPreview
    ? route.fulfill({ status: 409, json: { error: { message: "绑定的提示词版本不可用" } } })
    : route.fulfill({ json: { data: { constraints: { style: { ...step.constraints.style, content: body, source: "prompt_version_body" } }, constraintsHash: "a".repeat(64) } } }));
  await page.route("**/api/projects/proj-demo/canvas/generations", (route) => { submitted = route.request().postDataJSON(); return route.fulfill({ status: 202, json: { data: revisions[1] } }); });
  await page.goto("/suites/proj-demo/board");
  await page.getByRole("button", { name: "修改提示词并生成", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "迭代生成" });
  await dialog.getByRole("button", { name: "补全已绑定提示词", exact: true }).click();
  await expect(dialog.locator(".ic-frozen-constraints")).toContainText(body);
  expect(submitted).toBeNull();
  await dialog.getByText("预览最终发送的提示词", { exact: true }).click();
  await expect(dialog.locator("pre")).toContainText(body);
  await page.screenshot({ path: testInfo.outputPath("restored-constraints.png") });
  await dialog.getByRole("combobox", { name: "提示词版本", exact: true }).selectOption("original");
  await expect(dialog.locator(".ic-frozen-constraints")).toContainText("柔和棚拍光线与真实质感");
  await expect(dialog.getByRole("button", { name: "恢复历史约束" })).toHaveCount(0);
  failPreview = true;
  await dialog.getByRole("button", { name: "补全已绑定提示词", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("绑定的提示词版本不可用");
  expect(submitted).toBeNull();
  failPreview = false;
  await dialog.getByRole("button", { name: "补全已绑定提示词", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "恢复历史约束" })).toBeVisible();
  await dialog.getByRole("button", { name: "确认生成新版本" }).click();
  await expect.poll(() => submitted?.restoredConstraintsHash).toBe("a".repeat(64));
  expect(submitted.baseRevisionId).toBe("original");
  expect(step.constraints.style.content).toBe("柔和棚拍光线与真实质感");
});

test("展示原图到白底再到主图的连线，展开生成时提示词并保存脉络布局", async ({ page }, testInfo) => {
  const state = await setup(page);
  const generationSteps = [
    { id: "white", kind: "white", title: "生成白底图", sourceAssetIds: ["source-1"], outputAssetIds: ["white-1"], outputVersionIds: [], finalPrompt: "保留产品真实结构，生成纯白背景", taskPrompt: "", constraints: {}, parameters: { ratio: "1:1", size: "标准 1K" } },
    { id: "hero", kind: "hero", title: "场景主图", sourceAssetIds: ["white-1"], outputAssetIds: ["hero-1"], outputVersionIds: [], finalPrompt: "实际发送的完整提示词", taskPrompt: "摆在书桌上，窗边自然光", constraints: { style: { content: "生成时的极简风格，保留留白" }, market: { content: "生成时的平台约束" } }, parameters: { aspectRatio: "1:1", resolution: "2K", providerModel: "example-model", moduleParameters: [{ name: "场景", value: "书桌" }] } },
  ];
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "商品生成脉络" }, tasks: [], inputImages: [], generationSteps, layout: state.layout } } }));
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto("/suites/proj-demo/board");
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await expect(page.locator(".ic-generation-node")).toHaveCount(2);
  await page.locator('[data-id="generation:hero"]').getByRole("button", { name: "查看生成依据" }).click();
  const dialog = page.getByRole("dialog", { name: "生成依据" });
  await expect(dialog).toContainText("生成时的极简风格，保留留白");
  await expect(dialog).toContainText("实际发送的完整提示词");
  await expect(dialog).toContainText("书桌");
  await page.getByRole("button", { name: "关闭生成依据" }).click();
  await page.getByRole("button", { name: "按生成脉络排列" }).click();
  await expect.poll(() => state.layout?.nodes.some((n: any) => n.nodeId === "generation:hero")).toBe(true);
  await page.reload();
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("canvas-lineage.png") });
  expect(state.generations).toBe(0);
});

test("修改生成卡片提示词从上游重新生成，图片版本选择持久化且同步提示词", async ({ page }, testInfo) => {
  const state = await setup(page);
  const step = { id: "hero-step", kind: "hero", title: "细节特写", sourceAssetIds: ["white-1"], outputAssetIds: ["hero-1"], outputVersionIds: [], finalPrompt: "旧的完整提示词", taskPrompt: "旧的特写", constraints: { style: { content: "冻结的风格约束" } }, parameters: { aspectRatio: "1:1", resolution: "2K" } };
  let tracks: any[] = [];
  let submitted: any = null;
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "迭代测试" }, tasks: [], inputImages: [], generationSteps: [step], generationTracks: tracks, layout: state.layout } } }));
  await page.route("**/api/projects/proj-demo/canvas/generations", async (route) => {
    submitted = route.request().postDataJSON();
    const revision = { ...step, id: "revision-2", number: 2, status: "succeeded", taskPrompt: submitted.taskPrompt, finalPrompt: "冻结的风格约束\n新的特写任务", outputs: [{ index: 0, assetId: "hero-v2" }], createdAt: now };
    tracks = [{ stepId: step.id, title: step.title, kind: "hero", originalAssetIds: ["hero-1"], currentAssetIds: ["hero-v2"], revisions: [{ ...step, id: "original", number: 1, status: "succeeded", outputs: [{ index: 0, assetId: "hero-1" }], createdAt: now }, revision] }];
    state.assets.push(asset("hero-v2", "generated"));
    await route.fulfill({ status: 202, json: { data: revision } });
  });
  await page.route("**/api/projects/proj-demo/canvas/version-selection", async (route) => {
    const value = route.request().postDataJSON();
    tracks[0].currentAssetIds[value.outputIndex] = value.assetId;
    await route.fulfill({ json: { data: tracks[0] } });
  });
  await page.setViewportSize({ width: 1500, height: 960 });
  await page.goto("/suites/proj-demo/board");
  await page.getByRole("button", { name: "修改提示词并生成", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "迭代生成" });
  await expect(dialog).toContainText("冻结的风格约束");
  await expect(dialog.getByRole("img", { name: "上游输入 1" })).toHaveAttribute("src", /white-1/);
  await dialog.getByRole("textbox", { name: "本次任务提示词" }).fill("新的特写任务");
  expect(submitted).toBeNull();
  await page.screenshot({ path: testInfo.outputPath("canvas-regenerate-dialog.png") });
  await dialog.getByRole("button", { name: "确认生成新版本" }).click();
  await expect(dialog).toHaveCount(0);
  expect(submitted).toMatchObject({ stepId: "hero-step", baseRevisionId: "original", sourceAssetIds: ["white-1"], taskPrompt: "新的特写任务" });
  const output = page.locator('[data-id="asset:hero-1"]');
  await expect(output.locator(".ic-node-picture img")).toHaveAttribute("src", /hero-v2/);
  await output.locator("h3").click();
  const inspector = page.getByRole("complementary", { name: "图片属性" });
  await expect(inspector.getByRole("textbox", { name: "图片提示词", exact: true })).toHaveValue(/新的特写任务/);
  await inspector.getByRole("button", { name: "版本 1 历史记录" }).click();
  await expect(inspector.getByRole("textbox", { name: "图片提示词", exact: true })).toHaveValue("旧的完整提示词");
  await expect(inspector.getByRole("button", { name: "设为终版", exact: true })).toHaveCount(0);
  await inspector.getByRole("button", { name: "关闭图片属性" }).click();
  await output.getByRole("combobox", { name: "图片版本" }).selectOption("hero-1");
  await expect(output.locator(".ic-node-picture img")).toHaveAttribute("src", /hero-1/);
  await expect(page.locator('[data-id="generation:hero-step"]')).toContainText("旧的特写");
  await page.reload();
  await expect(output.locator(".ic-node-picture img")).toHaveAttribute("src", /hero-1/);
  await expect(output.getByRole("combobox", { name: "图片版本" })).toHaveValue("hero-1");
});

test("版本立即切换且提示词原位更新，连续选择按顺序保存，失败回退", async ({ page }) => {
  const state = await setup(page);
  state.assets.push(asset("hero-v2", "generated"));
  state.layout = { layoutVersion: 1, viewport: { x: 0, y: 0, zoom: 0.65 }, nodes: [{ nodeId: "asset:hero-1", x: 760, y: 180 }, { nodeId: "generation:hero", x: 420, y: 180 }, { nodeId: "generation:hero:revision:r2", x: 48, y: 1820 }, { nodeId: "asset:white-1", x: 70, y: 180 }], groups: [] };
  const step = { id: "hero", kind: "hero", title: "场景主图", sourceAssetIds: ["white-1"], outputAssetIds: ["hero-1"], outputVersionIds: [], finalPrompt: "原版完整提示词", taskPrompt: "原版任务", constraints: {}, parameters: {} };
  const track = { stepId: "hero", kind: "hero", title: "场景主图", originalAssetIds: ["hero-1"], currentAssetIds: ["hero-1"], revisions: [
    { ...step, id: "original", number: 1, status: "succeeded", outputs: [{ index: 0, assetId: "hero-1" }], createdAt: now },
    { ...step, id: "r2", number: 2, status: "succeeded", taskPrompt: "新版任务", finalPrompt: "新版完整提示词", outputs: [{ index: 0, assetId: "hero-v2" }], createdAt: now },
  ] };
  let workbenchReads = 0;
  await page.route("**/api/suites/proj-demo/workbench", (route) => { workbenchReads++; return route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "版本切换" }, tasks: [], inputImages: [], generationSteps: [step], generationTracks: [track], layout: state.layout } } }); });
  const calls: string[] = [];
  let release: () => void = () => {};
  let fail = false;
  await page.route("**/api/projects/proj-demo/canvas/version-selection", async (route) => {
    const value = route.request().postDataJSON();
    calls.push(value.assetId);
    await new Promise<void>((resolve) => { release = resolve; });
    if (fail) return route.fulfill({ status: 503, json: { error: { message: "版本保存暂不可用" } } });
    track.currentAssetIds[0] = value.assetId;
    return route.fulfill({ json: { data: track } });
  });
  await page.setViewportSize({ width: 1500, height: 960 });
  await page.goto("/suites/proj-demo/board");
  const output = page.locator('[data-id="asset:hero-1"]');
  const prompt = page.locator('[data-id="generation:hero"]');
  await expect(prompt).toContainText("原版任务");
  const transform = await prompt.evaluate((el) => (el as HTMLElement).style.transform);
  const viewport = await page.locator(".react-flow__viewport").getAttribute("style");
  const reads = workbenchReads;
  await output.getByRole("combobox", { name: "图片版本", exact: true }).selectOption("hero-v2");
  await expect(output.locator(".ic-node-picture img")).toHaveAttribute("src", /hero-v2/, { timeout: 1500 });
  await expect(prompt).toContainText("新版任务");
  expect(await prompt.evaluate((el) => (el as HTMLElement).style.transform)).toBe(transform);
  await expect(prompt).toBeInViewport();
  await expect(page.getByRole("complementary", { name: "图片属性" })).toHaveCount(0);
  expect(await page.locator(".react-flow__viewport").getAttribute("style")).toBe(viewport);
  await expect.poll(() => calls.length).toBe(1);
  await output.getByRole("combobox", { name: "图片版本", exact: true }).selectOption("hero-1");
  await expect(prompt).toContainText("原版任务");
  release();
  await expect.poll(() => calls.length).toBe(2);
  release();
  await expect(output.getByText("保存版本中…", { exact: true })).toHaveCount(0);
  expect(calls).toEqual(["hero-v2", "hero-1"]);
  expect(track.currentAssetIds).toEqual(["hero-1"]);
  expect(workbenchReads).toBe(reads);
  fail = true;
  await output.getByRole("combobox", { name: "图片版本", exact: true }).selectOption("hero-v2");
  await expect(prompt).toContainText("新版任务");
  await expect.poll(() => calls.length).toBe(3);
  release();
  await expect(page.getByRole("status")).toContainText("版本保存暂不可用");
  await expect(output.locator(".ic-node-picture img")).toHaveAttribute("src", /hero-1/);
  await expect(prompt).toContainText("原版任务");
});

test("失败版本保留旧图和提示词，可再次打开修改，手机弹窗不溢出", async ({ page }, testInfo) => {
  await setup(page);
  const step = { id: "hero", kind: "hero", title: "场景主图", sourceAssetIds: ["white-1"], outputAssetIds: ["hero-1"], outputVersionIds: [], finalPrompt: "原完整提示词", taskPrompt: "原任务", constraints: {}, parameters: {} };
  const track = { stepId: "hero", kind: "hero", title: "场景主图", originalAssetIds: ["hero-1"], currentAssetIds: ["hero-1"], revisions: [
    { ...step, id: "original", number: 1, status: "succeeded", outputs: [{ index: 0, assetId: "hero-1" }], createdAt: now },
    { ...step, id: "failed", number: 2, status: "failed", taskPrompt: "失败时的修改内容", outputs: [], errors: [{ index: 0, message: "生成未完成，请检查后重新提交" }], createdAt: now },
  ] };
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "失败测试" }, tasks: [], inputImages: [], generationSteps: [step], generationTracks: [track], layout: null } } }));
  await page.goto("/suites/proj-demo/board");
  await expect(page.locator('[data-id="asset:hero-1"] .ic-node-picture img')).toHaveAttribute("src", /hero-1/);
  await expect(page.locator('[data-id="generation:hero"]')).toContainText("V2 · 生成失败");
  await page.getByRole("button", { name: "修改提示词并生成", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "迭代生成" });
  await dialog.getByRole("combobox", { name: "提示词版本", exact: true }).selectOption("failed");
  await expect(dialog.getByRole("textbox", { name: "本次任务提示词" })).toHaveValue("失败时的修改内容");
  await expect(dialog).toContainText("生成未完成，请检查后重新提交");
  await expect(dialog.getByRole("button", { name: "确认生成新版本" })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole("button", { name: "确认生成新版本" })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("canvas-version-mobile.png") });
});

test("右键拖动画布且滚轮直接缩放，无需切换工具", async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/suites/proj-demo/board");
  await expect(page.locator(".ic-image-node")).toHaveCount(3);
  const viewport = page.locator(".react-flow__viewport");
  const transform = () => viewport.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
  const pane = await page.locator(".react-flow__pane").boundingBox();
  const point = { x: pane!.x + pane!.width - 100, y: pane!.y + pane!.height - 150 };
  await page.mouse.move(point.x, point.y);
  const before = await transform();
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await transform()).zoom).toBeGreaterThan(before.zoom);
  const enlarged = await transform();
  await page.mouse.wheel(0, 300);
  await expect.poll(async () => (await transform()).zoom).toBeLessThan(enlarged.zoom);
  await expect.poll(() => state.layout?.viewport.zoom).toBeCloseTo(before.zoom, 2);
  const beforePan = await transform();
  await page.mouse.down({ button: "right" });
  await page.mouse.move(point.x - 80, point.y - 50, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect.poll(async () => (await transform()).x).toBeCloseTo(beforePan.x - 80, 1);
  await expect.poll(async () => (await transform()).y).toBeCloseTo(beforePan.y - 50, 1);
  const image = page.locator('[data-id="asset:hero-1"] .ic-node-picture');
  const imageBox = await image.boundingBox();
  const nodePosition = await page.locator('[data-id="asset:hero-1"]').getAttribute("style");
  const beforeImagePan = await transform();
  await page.mouse.move(imageBox!.x + imageBox!.width / 2, imageBox!.y + imageBox!.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(imageBox!.x + imageBox!.width / 2 + 60, imageBox!.y + imageBox!.height / 2 + 35, { steps: 6 });
  await page.mouse.up({ button: "right" });
  await expect.poll(async () => (await transform()).x).toBeCloseTo(beforeImagePan.x + 60, 1);
  await expect.poll(async () => (await transform()).y).toBeCloseTo(beforeImagePan.y + 35, 1);
  expect(await page.locator('[data-id="asset:hero-1"]').getAttribute("style")).toBe(nodePosition);
  await expect.poll(() => state.layout?.viewport.x).toBeCloseTo(beforeImagePan.x + 60, 1);
  await expect.poll(() => state.layout?.viewport.y).toBeCloseTo(beforeImagePan.y + 35, 1);
  const savedViewport = { ...state.layout.viewport };
  await page.reload();
  await expect.poll(async () => (await transform()).x).toBeCloseTo(savedViewport.x, 1);
  await expect.poll(async () => (await transform()).y).toBeCloseTo(savedViewport.y, 1);
  const restoredImage = await image.boundingBox();
  const beforeLeftDrag = await page.locator('[data-id="asset:hero-1"]').getAttribute("style");
  await page.mouse.move(restoredImage!.x + restoredImage!.width / 2, restoredImage!.y + restoredImage!.height / 2);
  await page.mouse.down();
  await page.mouse.move(restoredImage!.x + restoredImage!.width / 2 + 40, restoredImage!.y + restoredImage!.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('[data-id="asset:hero-1"]')).not.toHaveAttribute("style", beforeLeftDrag!);
  await expect.poll(async () => (await transform()).x).toBeCloseTo(savedViewport.x, 1);
  await page.getByRole("button", { name: "放大画布", exact: true }).click();
  await expect.poll(() => state.layout?.viewport.zoom).toBeGreaterThan(savedViewport.zoom);
  await expect(page.getByRole("button", { name: "选择工具", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "平移工具", exact: true }).click();
  await expect(page.getByRole("button", { name: "平移工具", exact: true })).toHaveAttribute("aria-pressed", "true");
  const panImageBox = await image.boundingBox();
  const beforeToolPan = await transform();
  const beforeToolNode = await page.locator('[data-id="asset:hero-1"]').getAttribute("style");
  await page.mouse.move(panImageBox!.x + panImageBox!.width / 2, panImageBox!.y + panImageBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(panImageBox!.x + panImageBox!.width / 2 + 50, panImageBox!.y + panImageBox!.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await transform()).x).toBeCloseTo(beforeToolPan.x + 50, 1);
  await expect.poll(async () => (await transform()).y).toBeCloseTo(beforeToolPan.y + 20, 1);
  expect(await page.locator('[data-id="asset:hero-1"]').getAttribute("style")).toBe(beforeToolNode);
  await page.getByRole("button", { name: "选择工具", exact: true }).click();
  await expect(page.getByRole("button", { name: "选择工具", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(state.generations).toBe(0);
});

test("无旧任务的项目也显示真实图片，移出后刷新不丢资产并可重新加入", async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/suites/proj-demo/board");
  await expect(page.getByRole("complementary", { name: "项目图片" })).toBeVisible();
  await expect(page.locator(".ic-image-node")).toHaveCount(3);
  await page.locator('.react-flow__node[data-id="asset:hero-1"]').click();
  await page.getByRole("button", { name: "移出画布", exact: true }).click();
  await expect(page.locator(".ic-image-node")).toHaveCount(2);
  await expect.poll(() => state.layout?.nodes.find((n: any) => n.nodeId === "asset:hero-1")?.hidden).toBe(true);
  await page.reload();
  await expect(page.locator(".ic-image-node")).toHaveCount(2);
  await page.getByRole("button", { name: "加入画布 hero-1-产品图片.png" }).click();
  await expect(page.locator(".ic-image-node")).toHaveCount(3);
  expect(state.deletes).toBe(0);
  expect(state.generations).toBe(0);
});

test("图片可多选对比、分组、保存和解散，桌面与手机无页面溢出", async ({ page }, testInfo) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/suites/proj-demo/board");
  await expect(page.locator(".ic-image-node")).toHaveCount(3);
  await page.locator('.react-flow__node[data-id="asset:source-1"]').click();
  await page.locator('.react-flow__node[data-id="asset:hero-1"]').click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "对比图片", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "图片对比" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "图片对比" }).locator("img")).toHaveCount(2);
  await page.getByRole("button", { name: "关闭图片对比" }).click();
  await page.getByRole("button", { name: "创建分组", exact: true }).click();
  await page.getByRole("textbox", { name: "分组名称" }).fill("候选主图");
  await page.getByRole("button", { name: "确认分组" }).click();
  await expect.poll(() => state.layout?.groups[0]?.title).toBe("候选主图");
  await page.reload();
  await expect(page.locator(".ic-group-node")).toContainText("候选主图");
  await page.screenshot({ path: testInfo.outputPath("canvas-desktop.png") });
  await page.locator(".ic-group-node").click();
  await page.getByRole("button", { name: "解散分组", exact: true }).click();
  await expect(page.locator(".ic-group-node")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".react-flow")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "项目图片", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "项目图片" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("canvas-mobile.png") });
  expect(state.generations).toBe(0);
});

test("布局版本冲突后可明确重载恢复，未关联资产的任务版本不能误传给编辑接口", async ({ page }) => {
  await setup(page);
  const version = { id: "workbench-version", taskId: "task", versionNumber: 1, isCurrent: true, previewUrl: "/fixture/image.png", promptSnapshot: {}, width: 800, height: 600 };
  const task = { id: "task", title: "历史任务图片", status: "generated", imageType: "main", versions: [version], generationParams: {}, promptDraft: "原提示词" };
  let revision = 2;
  let sessionCalls = 0;
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "测试项目" }, tasks: [task], inputImages: [], layout: { layoutVersion: revision, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [{ nodeId: "task:task", x: 40, y: 150 }], groups: [] } } } }));
  await page.route("**/api/suites/proj-demo/workbench/layout", (route) => route.fulfill({ status: 409, json: { error: { message: "画布布局已更新，请刷新后重试", code: "WORKBENCH_LAYOUT_CONFLICT" } } }));
  await page.route("**/api/image-editor/sessions", (route) => { sessionCalls++; return route.abort(); });
  await page.goto("/suites/proj-demo/board");
  await page.locator('.react-flow__node[data-id="task:task"]').click();
  await expect(page.getByRole("button", { name: "编辑图片", exact: true })).toBeDisabled();
  expect(sessionCalls).toBe(0);
  await page.getByRole("button", { name: "自动排列", exact: true }).click();
  await expect(page.getByRole("button", { name: "重试保存" })).toBeVisible();
  revision = 7;
  await page.getByRole("button", { name: "重试保存" }).click();
  await expect(page.getByRole("dialog", { name: "恢复布局保存" })).toBeVisible();
  await page.getByRole("button", { name: "重新加载已保存布局", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "恢复布局保存" })).toHaveCount(0);
  await expect(page.locator(".ic-save-state")).toHaveText("已保存");
});
test("首次项目图片加载失败不会覆盖隐藏与位置记录，重试后按原布局恢复", async ({ page }) => {
  const state = await setup(page);
  state.layout = { layoutVersion: 3, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [{ nodeId: "asset:source-1", x: 360, y: 180, hidden: true }, { nodeId: "asset:hero-1", x: 100, y: 180 }], groups: [] };
  let failing = true;
  let writes = 0;
  await page.route("**/api/projects/proj-demo/assets", (route) => failing ? route.fulfill({ status: 503, json: { error: { message: "资产读取暂不可用" } } }) : route.fulfill({ json: { data: state.assets } }));
  page.on("request", (request) => { if (request.method() === "PATCH") writes++; });
  await page.goto("/suites/proj-demo/board");
  await expect(page.getByRole("alert")).toContainText("资产读取暂不可用");
  expect(writes).toBe(0);
  failing = false;
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id="asset:source-1"]')).toHaveCount(0);
  await expect(page.locator(".ic-image-node")).toHaveCount(2);
  expect(state.layout.nodes.find((n: any) => n.nodeId === "asset:source-1")).toMatchObject({ x: 360, y: 180, hidden: true });
});

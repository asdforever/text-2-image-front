import { expect, test, type Page } from "playwright/test";

// Legacy board links now load the project shell before the embedded canvas.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/projects/proj-demo", route => route.fulfill({ json: { data: {
    id: "proj-demo", name: "画布测试项目", status: "active", assets: [], selections: {},
    createdAt: "2026-09-24T08:00:00Z", updatedAt: "2026-09-24T08:00:00Z",
  } } }));
});

async function setup(page: Page, styleRoutes = false) {
  const state = { posts: [] as any[], keys: [] as string[], reads: 0, fail: true, saved: [] as any[], generations: 0, assets: [] as any[] };
  if (!styleRoutes) await page.route("**/api/projects/proj-demo/style-harmonizations", (route) => route.fulfill({ json: { data: [] } }));
  const assets = ["hero-v1", "hero-v2"].map((id) => ({ id, kind: "generated", sourceAssetId: null, generationSnapshotId: null, state: "available", filename: `${id}.png`, mimeType: "image/png", byteSize: 100, width: 1000, height: 1000, sha256: id, createdAt: "2026-09-18T00:00:00Z" }));
  state.assets = assets;
  await page.route("**/api/projects/proj-demo/module-plans/latest?*", (route) => route.fulfill({ status: 404, json: { error: { code: "MODULE_PLAN_NOT_FOUND", message: "尚无自动规划" } } }));
  const step = { id: "hero", kind: "hero", title: "场景主图", sourceAssetIds: [], outputAssetIds: ["hero-v1"], outputVersionIds: [], finalPrompt: "", taskPrompt: "", constraints: {}, parameters: {} };
  const track = { stepId: "hero", title: "场景主图", kind: "hero", originalAssetIds: ["hero-v1"], currentAssetIds: ["hero-v2"], revisions: assets.map((asset, i) => ({ ...step, id: `r${i}`, number: i + 1, status: "succeeded", outputs: [{ index: 0, assetId: asset.id }], createdAt: asset.createdAt })) };
  await page.route("**/api/projects/proj-demo/assets", (route) => { state.reads++; return route.fulfill({ json: { data: assets } }); });
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: { suite: { id: "proj-demo", name: "长图测试项目" }, tasks: [], inputImages: [], batches: [], planSnapshot: null, generationSteps: [step], generationTracks: [track], layout: null } } }));
  await page.route("**/api/suites/proj-demo/workbench/layout", (route) => route.fulfill({ json: { data: { ...route.request().postDataJSON(), layoutVersion: 1 } } }));
  await page.route("**/api/projects/proj-demo/long-images", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: state.saved } });
    const body = route.request().postDataJSON(); state.posts.push(body); state.keys.push(route.request().headers()["idempotency-key"]);
    if (state.fail) return route.fulfill({ status: 503, json: { error: { message: "暂时无法保存，请重试" } } });
    const result = { assetId: `long-${state.saved.length}`, title: body.title, width: body.width, height: 1540, previewUrl: "/api/projects/proj-demo/assets/hero-v1/preview", recipe: body };
    state.saved.push(result); return route.fulfill({ json: { data: result } });
  });
  await page.route("**/api/projects/proj-demo/long-images/*/download*", (route) => route.fulfill({ contentType: "application/octet-stream", headers: { "content-disposition": "attachment; filename=detail.png" }, body: "test download" }));
  await page.route("**/api/**/generation*", (route) => { state.generations++; return route.abort(); });
  await page.goto("/suites/proj-demo/board");
  await page.getByRole("button", { name: "制作长图", exact: true }).click();
  return state;
}

test("规划建议只读展示，延迟返回也不覆盖用户拼接顺序", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "关闭长图制作" }).click();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const methods: string[] = [];
  await page.route("**/api/projects/proj-demo/module-plans/latest?*", async (route) => {
    methods.push(route.request().method());
    if (new URL(route.request().url()).searchParams.get("mode") === "hero") return route.fulfill({ status: 404, json: { error: { code: "MODULE_PLAN_NOT_FOUND" } } });
    await pending;
    return route.fulfill({ json: { data: { id: "outline", mode: "suite", status: "completed", summary: "先说明杯盖，再展示杯底", modules: [
      { taskId: "lid", moduleId: "suite-detail", resultCount: 1, moduleParameters: [{ key: "本图任务", value: "展示杯盖" }], reason: "便于了解开合结构" },
      { taskId: "base", moduleId: "suite-detail", resultCount: 1, moduleParameters: [{ key: "本图任务", value: "展示杯底" }], reason: "核对底部可见细节" },
    ] } } });
  });
  await page.getByRole("button", { name: "制作长图", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V2", exact: true }).click();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  release();
  const advice = dialog.getByRole("region", { name: "拼接顺序建议" });
  await expect(advice).toContainText("先说明杯盖，再展示杯底");
  await expect(advice.locator("li").first()).toContainText("展示杯盖");
  await expect(advice.locator("li").nth(1)).toContainText("展示杯底");
  await expect(dialog.locator('[data-long-item="0"]')).toContainText("V2");
  await dialog.getByRole("button", { name: "上移第 2 张" }).click();
  await expect(dialog.locator('[data-long-item="0"]')).toContainText("V1");
  expect(methods.length).toBeGreaterThanOrEqual(2);
  expect(methods.every((method) => method === "GET")).toBe(true);
  expect(state.posts).toHaveLength(0);
  expect(state.generations).toBe(0);
});

test("建议读取失败仍可选图，重试不会改变排版", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "关闭长图制作" }).click();
  let fail = true;
  await page.route("**/api/projects/proj-demo/module-plans/latest?*", (route) => route.fulfill({ status: fail ? 503 : 404, json: { error: { code: fail ? "UNAVAILABLE" : "MODULE_PLAN_NOT_FOUND" } } }));
  await page.getByRole("button", { name: "制作长图", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await expect(dialog.getByRole("button", { name: "重试读取建议" })).toBeVisible();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  fail = false;
  await dialog.getByRole("button", { name: "重试读取建议" }).click();
  await expect(dialog.getByRole("region", { name: "拼接顺序建议" })).toContainText("暂无已完成的规划建议");
  await expect(dialog.locator('[data-long-item="0"]')).toContainText("V1");
});

test("历史版本选图、排序、失败重试、保存刷新与恢复另存", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const state = await setup(page);
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V2", exact: true }).click();
  await dialog.getByRole("spinbutton", { name: "图片间距" }).fill("40");
  await dialog.getByRole("button", { name: "上移第 2 张" }).click();
  await dialog.getByRole("spinbutton", { name: "第 1 张上裁剪" }).fill("10");
  await dialog.getByRole("spinbutton", { name: "第 1 张上留白" }).fill("15");
  await page.screenshot({ path: testInfo.outputPath("long-image-desktop.png") });
  await dialog.getByRole("button", { name: "保存并归档", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("暂时无法保存");
  expect(state.posts[0].items.map((item: any) => item.assetId)).toEqual(["hero-v2", "hero-v1"]);
  expect(state.posts[0].items[0]).toMatchObject({ crop: { top: 10, left: 0, right: 0, bottom: 0 }, paddingTop: 15 });
  expect(state.posts[0].gap).toBe(40);
  const reads = state.reads;
  state.fail = false;
  await dialog.getByRole("button", { name: "保存并归档", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "下载整图 PNG" })).toBeEnabled();
  expect(state.keys[1]).toBe(state.keys[0]);
  expect(state.keys[0]).toBeTruthy();
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "下载整图 PNG" }).click();
  await download;
  await dialog.getByRole("spinbutton", { name: "切片高度" }).fill("1000");
  const zipRequest = page.waitForRequest((request) => request.url().includes("/long-0/download?sliceHeight=1000"));
  await dialog.getByRole("button", { name: "下载切片 ZIP" }).click();
  await zipRequest;
  await dialog.getByRole("spinbutton", { name: "图片间距" }).fill("50");
  await expect(dialog.getByRole("button", { name: "下载整图 PNG" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "另存新长图", exact: true }).click();
  await expect.poll(() => state.posts.length).toBe(3);
  expect(state.keys[2]).not.toBe(state.keys[1]);
  await dialog.getByRole("combobox", { name: "已保存方案" }).selectOption("long-0");
  await expect(dialog.getByRole("spinbutton", { name: "图片间距" })).toHaveValue("40");
  expect(state.generations).toBe(0);
});

test("无图时阻止保存，恢复缺失来源可下载旧结果但不能另存不完整方案", async ({ page }) => {
  const state = await setup(page);
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await expect(dialog.getByRole("button", { name: "保存并归档", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  state.fail = false;
  await dialog.getByRole("button", { name: "保存并归档", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "下载整图 PNG" })).toBeEnabled();
  await dialog.getByRole("button", { name: "关闭长图制作" }).click();
  state.saved[0].recipe.items[0].assetId = "missing-source";
  await page.getByRole("button", { name: "制作长图", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "已保存方案" }).locator("option")).toHaveCount(2);
  await dialog.getByRole("combobox", { name: "已保存方案" }).selectOption("long-0");
  await expect(dialog.locator(".lic-preview-notes")).toContainText("来源图片不可用");
  await expect(dialog.getByRole("button", { name: "下载整图 PNG" })).toBeEnabled();
  await dialog.getByRole("spinbutton", { name: "图片间距" }).fill("20");
  await expect(dialog.getByRole("button", { name: "另存新长图" })).toBeDisabled();
  expect(state.posts).toHaveLength(1);
});

test("窄屏保留预览与关闭确认，按钮改变顺序", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V2", exact: true }).click();
  await dialog.getByRole("button", { name: "上移第 2 张" }).click();
  await expect(dialog.locator('[data-long-item="0"]')).toContainText("V2");
  await dialog.getByRole("button", { name: "关闭长图制作" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("尚未保存");
  await page.getByRole("button", { name: "继续编辑" }).click();
  await expect(dialog.locator('[data-long-item="0"]')).toContainText("V2");
  await page.screenshot({ path: testInfo.outputPath("long-image-mobile.png") });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "关闭长图制作" }).click();
  await page.getByRole("button", { name: "放弃修改" }).click();
  await expect(dialog).toHaveCount(0);
});

test("拖动排序与预览顺序一致", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await setup(page);
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V2", exact: true }).click();
  await dialog.locator(".lic-editor").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await dialog.getByRole("button", { name: "拖动第 1 张排序" }).dragTo(dialog.getByRole("button", { name: "拖动第 2 张排序" }));
  await expect(dialog.locator('[data-long-item="0"]')).toContainText("V2");
  await expect(dialog.locator(".lic-preview image").first()).toHaveAttribute("href", /hero-v2/);
});

test("风格统一仅提交勾选图片，确认后生成且逐张采用候选", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const jobs: any[] = [], styleRequests: any[] = [];
  await page.route("**/api/projects/proj-demo/style-harmonizations/preview", (route) => route.fulfill({ json: { data: { finalPrompt: `保护商品与文字\n${route.request().postDataJSON().prompt}`, assetIds: ["hero-v1"], mode: "custom", previewHash: "a".repeat(64) } } }));
  await page.route("**/api/projects/proj-demo/style-harmonizations", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: jobs } });
    const body = route.request().postDataJSON(); styleRequests.push(body);
    const job = { id: "style-job", status: "succeeded", assetIds: body.assetIds, mode: body.mode, finalPrompt: body.prompt, tasks: body.assetIds.map((id: string) => ({ id: `task-${id}`, sourceAssetId: id, status: "succeeded", outputAssetId: `styled-${id}`, sourceAsset: { assetId: id, width: 1000, height: 1000, filename: id, mimeType: "image/png" }, error: null })), createdAt: "2026-09-18T00:00:00Z" };
    state.assets.push({ ...state.assets[0], id: "styled-hero-v1", filename: "风格候选.png", width: 600, height: 800 });
    jobs.push(job); return route.fulfill({ status: 202, json: { data: job } });
  });
  const state = await setup(page, true);
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V2", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "统一第 1 张风格" }).check();
  await dialog.getByRole("button", { name: "下移第 1 张" }).click();
  await expect(dialog.getByRole("checkbox", { name: "统一第 2 张风格" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "统一第 1 张风格" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "移除第 1 张" }).click();
  await expect(dialog.getByRole("checkbox", { name: "统一第 1 张风格" })).toBeChecked();
  await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V2", exact: true }).click();
  await dialog.getByRole("combobox", { name: "统一风格方式" }).selectOption("custom");
  await dialog.getByRole("textbox", { name: "自写风格提示词" }).fill("柔和暖光，浅米色背景，完整保留文字与商品");
  await dialog.getByRole("button", { name: "预览风格统一任务" }).click();
  const confirm = page.getByRole("alertdialog", { name: "确认风格统一" });
  await expect(confirm).toContainText("1 张");
  await expect(confirm).toContainText("柔和暖光");
  expect(styleRequests).toHaveLength(0);
  await confirm.getByRole("button", { name: "确认生成风格候选" }).click();
  await expect(dialog.getByRole("button", { name: "采用候选 task-hero-v1" })).toBeVisible();
  expect(styleRequests).toEqual([{ assetIds: ["hero-v1"], mode: "custom", prompt: "柔和暖光，浅米色背景，完整保留文字与商品", expectedPreviewHash: "a".repeat(64) }]);
  await expect(dialog.locator(".lic-preview image").first()).toHaveAttribute("href", /\/hero-v1\//);
  await dialog.getByRole("button", { name: "采用候选 task-hero-v1" }).click();
  await expect(dialog.locator(".lic-preview image").first()).toHaveAttribute("href", /styled-hero-v1/);
  await expect(dialog.locator(".lic-preview image").nth(1)).toHaveAttribute("href", /\/hero-v2\//);
  state.fail = false;
  await dialog.getByRole("button", { name: "保存并归档", exact: true }).click();
  await expect.poll(() => state.posts.length).toBe(1);
  expect(state.posts[0].items.map((item: any) => item.assetId)).toEqual(["styled-hero-v1", "hero-v2"]);
  await page.screenshot({ path: testInfo.outputPath("long-image-style-candidates.png") });
});

for (const mode of ["reference", "prompt"] as const) {
  test(`风格${mode === "reference" ? "参考图" : "提示词版本"}使用后端完整预览，失败重试保持同键`, async ({ page }) => {
    const submitted: any[] = [], keys: string[] = [];
    let previewInput: any;
    await page.route("**/api/projects/proj-demo/style-harmonizations/preview", (route) => {
      previewInput = route.request().postDataJSON();
      return route.fulfill({ json: { data: { finalPrompt: "后端冻结的完整要求：保留商品结构和所有文字；柔和光线", assetIds: previewInput.assetIds, mode, previewHash: "b".repeat(64) } } });
    });
    await page.route("**/api/projects/proj-demo/style-harmonizations", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { data: [] } });
      submitted.push(route.request().postDataJSON()); keys.push(route.request().headers()["idempotency-key"]);
      if (submitted.length === 1) return route.fulfill({ status: 503, json: { error: { message: "网络暂时不可用" } } });
      return route.fulfill({ json: { data: { id: "recovered-job", mode, assetIds: ["hero-v1"], status: "succeeded", finalPrompt: "已确认的完整要求", tasks: [], createdAt: "2026-09-18T00:00:00Z" } } });
    });
    await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [{ id: "style-template", name: "柔和棚拍", executionTarget: "image_model" }] } }));
    await page.route("**/api/prompt-templates/style-template/versions", (route) => route.fulfill({ json: { data: [{ id: "style-version", name: "完整风格正文", versionNo: 2, body: "说明正文", userPromptTemplate: "柔和光线的运行正文" }] } }));
    await setup(page, true);
    const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
    await dialog.getByRole("button", { name: "添加 场景主图 · 图 1 · V1", exact: true }).click();
    await dialog.getByRole("checkbox", { name: "统一第 1 张风格" }).check();
    await dialog.getByRole("combobox", { name: "统一风格方式" }).selectOption(mode);
    if (mode === "reference") await dialog.getByRole("combobox", { name: "风格参考图片" }).selectOption("hero-v2");
    else {
      await dialog.getByRole("combobox", { name: "风格提示词模板" }).selectOption("style-template");
      await dialog.getByRole("combobox", { name: "风格提示词版本" }).selectOption("style-version");
      await expect(dialog.locator(".lic-prompt-preview")).toContainText("运行正文");
    }
    await dialog.getByRole("button", { name: "预览风格统一任务" }).click();
    const confirm = page.getByRole("alertdialog", { name: "确认风格统一" });
    await expect(confirm).toContainText("后端冻结的完整要求");
    expect(previewInput).toEqual({ assetIds: ["hero-v1"], mode, ...(mode === "reference" ? { referenceAssetId: "hero-v2" } : { promptVersionId: "style-version" }) });
    expect(submitted).toHaveLength(0);
    await confirm.getByRole("button", { name: "确认生成风格候选" }).click();
    await expect(confirm.getByRole("alert")).toContainText("网络暂时不可用");
    await confirm.getByRole("button", { name: "确认生成风格候选" }).click();
    await expect(confirm).toHaveCount(0);
    expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]);
    expect(submitted[1]).toEqual({ ...previewInput, expectedPreviewHash: "b".repeat(64) });
    await dialog.getByRole("button", { name: "预览风格统一任务" }).click();
    await confirm.getByRole("button", { name: "确认生成风格候选" }).click();
    await expect(confirm).toHaveCount(0);
    expect(keys[2]).not.toBe(keys[1]);
  });
}

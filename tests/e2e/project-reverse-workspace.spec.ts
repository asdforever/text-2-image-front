import { test, expect, type Page } from "playwright/test";
import type { ReverseExecutionPlan, ReverseExecutionBatch } from "../../src/api/reverse-execution";

const now = "2026-09-30T08:00:00Z";
const structure = { goal: "介绍商品", layout: "浅木桌面，右侧商品", informationHierarchy: "标题与商品", typography: "简洁标题", colorAndLighting: "自然侧光", adaptationNotes: "使用当前商品" };
const published = {
  id: "reverse-one", name: "鼠标参考", category: "数码", summary: "", suitableFor: "鼠标", goal: "", requiredMaterials: "", notSuitableFor: "",
  references: [], modules: [], overall: { contentFlow: "", visualSystem: "", moduleStrategy: "", adaptationRules: "" },
  revision: 2, analysis: { status: "completed" }, createdAt: now, updatedAt: now,
  versions: [{ id: "version-one", versionNo: 1, createdAt: now, revision: 2 }, { id: "version-two", versionNo: 2, createdAt: now, revision: 2 }], latestVersionId: "version-two",
};

const sourceAsset = { id: "source-one", kind: "source", state: "available", filename: "商品原图.png", mimeType: "image/png", byteSize: 1024, width: 800, height: 600, sha256: "a".repeat(64), sourceAssetId: null, generationSnapshotId: null, createdAt: now };
const whiteAsset = { ...sourceAsset, id: "white-one", kind: "white_background", filename: "商品白底图.png" };

async function setup(page: Page, projects: unknown[], hasAssets = true, failGenerationOnce = false) {
  let plan: ReverseExecutionPlan | null = null;
  const plans: ReverseExecutionPlan[] = [];
  const batches: ReverseExecutionBatch[] = [];
  const assets = hasAssets ? [sourceAsset, whiteAsset] : [];
  let uploadCount = 0;
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const send = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "/api/projects/project-one") return send({ id: "project-one", name: "鼠标项目", status: "active", archivedAt: null, createdAt: now, updatedAt: now, assets, selections: {} });
    if (/\/assets\/[^/]+\/preview$/.test(path)) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    if (path === "/api/projects/project-one/assets" && request.method() === "POST") {
      uploadCount++;
      const uploaded = { ...whiteAsset, id: uploadCount === 1 ? "uploaded-white" : `uploaded-white-${uploadCount}`, filename: uploadCount === 1 ? "gan65-product.jpg" : `辅助角度${uploadCount}.png` };
      assets.push(uploaded);
      return send(uploaded);
    }
    if (path === "/api/reverse-projects") return send(projects);
    if (path.endsWith("/reverse-bindings")) return send([]);
    if (path.endsWith("/reverse-execution/plans")) return send([...plans].reverse());
    if (path.endsWith("/reverse-execution/batches")) return send(batches.filter(batch => batch.planId === new URL(request.url()).searchParams.get("planId")).reverse());
    if (path === "/api/projects/project-one/reverse-execution") {
      const selectedId = new URL(request.url()).searchParams.get("planId") ?? (request.method() === "PATCH" ? request.postDataJSON().planId : undefined);
      if (selectedId) plan = plans.find(item => item.id === selectedId) ?? null;
      if (request.method() === "POST") {
        const { name, versionId, sourceAssetId, auxiliarySourceAssetIds, productFacts, parameterBrief, outputSettings } = request.postDataJSON();
        plan = { id: plans.length ? `plan-${plans.length + 1}` : "plan-one", name: name || "方案一", projectId: "project-one", reverseVersionId: versionId, versionId, sourceAssetId, productFacts, parameterBrief, outputSettings, referenceCount: 1, revision: 1, createdAt: now, updatedAt: now,
          tasks: [{ id: "task-one", ordinal: 1, referenceImageId: "ref-one", referenceFilename: "参考图.png", referencePreviewUrl: "/assets/gan65-product.jpg", referenceModuleId: "module-one", title: "桌面场景", structure, promptDraft: "", status: "draft" }] };
        plan = { ...plan, ...(auxiliarySourceAssetIds ? { auxiliarySourceAssetIds } : {}) };
        plans.push(plan);
      }
      if (request.method() === "PATCH" && plan) {
        plan = { ...plan, ...request.postDataJSON().document, revision: plan.revision + 1 };
        plan.tasks = plan.tasks.map(task => ({ ...task, promptDraft: "" }));
        plans[plans.findIndex(item => item.id === plan!.id)] = plan;
      }
      return send(plan);
    }
    if (path.endsWith("/reverse-execution/compile") && plan) {
      const { productFacts } = request.postDataJSON();
      plan = { ...plan, revision: plan.revision + 1, productFacts };
      plans[plans.findIndex(item => item.id === plan!.id)] = plan;
      return send({ ...plan, tasks: plan.tasks.map(task => ({ ...task, status: "compiled", promptDraft: `商品：${Object.values(productFacts).join("；")}` })) });
    }
    if (path.endsWith("/reverse-execution/generate") && plan) {
      if (failGenerationOnce) {
        failGenerationOnce = false;
        plan = { ...plan, revision: plan.revision + 1 };
        plans[plans.findIndex(item => item.id === plan!.id)] = plan;
        return route.fulfill({ status: 503, json: { error: { message: "分配后生成失败" } } });
      }
      const input = request.postDataJSON();
      const prior = input.batchId ? batches.find(batch => batch.id === input.batchId) : undefined;
      const batch: ReverseExecutionBatch = prior ?? { id: `batch-${batches.length + 1}`, planId: plan.id, projectId: "project-one", batchNo: batches.filter(item => item.planId === plan!.id).length + 1, planName: plan.name || "方案一", status: "completed", createdAt: now, updatedAt: now, revision: 1, progress: { total: 1, succeeded: 1, failed: 0 }, document: { versionId: plan.versionId, sourceAssetId: plan.sourceAssetId || undefined }, tasks: plan.tasks.map(task => ({ ...task, attempts: [] })) };
      batch.tasks[0].attempts.push({ id: `attempt-${batch.tasks[0].attempts.length + 1}`, number: batch.tasks[0].attempts.length + 1, status: "succeeded", createdAt: now, generatedPreviewUrl: "/assets/gan65-product.jpg" });
      if (!prior) batches.push(batch);
      plan = { ...plan, revision: plan.revision + 1, tasks: plan.tasks.map(task => ({ ...task, promptDraft: "", status: "succeeded", generatedPreviewUrl: "/assets/gan65-product.jpg" })) };
      plans[plans.findIndex(item => item.id === plan!.id)] = plan;
      return send(plan);
    }
    return route.fulfill({ status: 404, json: { error: { message: "没有此测试资源" } } });
  });
}

test("项目未绑定也能直接选择已发布版本并生成方案，刷新保留来源", async ({ page }) => {
  await setup(page, [published, { ...published, id: "draft-one", name: "未发布参考", versions: [], latestVersionId: null }]);
  await page.goto("/projects/project-one?tab=reverse");
  const selector = page.getByRole("combobox", { name: "反推版本" });
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("option")).toHaveCount(2);
  await selector.selectOption("version-one");
  const creation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution"));
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  expect((await creation).postDataJSON()).toMatchObject({ versionId: "version-one" });
  await expect(page.getByRole("heading", { name: "桌面场景", exact: true })).toBeVisible();
  await expect(page.locator(".project-reverse-summary")).toContainText("鼠标参考 · v1");
  await page.reload();
  await expect(page.locator(".project-reverse-summary")).toContainText("鼠标参考 · v1");
});

test("主图与辅助视角共同保存，刷新后恢复并传给生成请求", async ({ page }) => {
  await setup(page, [published]);
  await page.goto("/projects/project-one?tab=reverse");
  const auxiliary = page.getByRole("checkbox", { name: "辅助图：商品原图.png", exact: true });
  await auxiliary.check();
  const creation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution"));
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  expect((await creation).postDataJSON()).toMatchObject({ sourceAssetId: "white-one", auxiliarySourceAssetIds: ["source-one"] });
  await page.reload();
  await expect(auxiliary).toBeChecked();
  const generation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution/generate"));
  await page.getByRole("button", { name: "生成此张", exact: true }).click();
  expect((await generation).postDataJSON()).toMatchObject({ sourceAssetId: "white-one", auxiliarySourceAssetIds: ["source-one"] });
});

test("一次上传多张商品图，首张为主图其余自动选为辅助图", async ({ page }) => {
  await setup(page, [published], false);
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByLabel("上传白底图", { exact: true }).setInputFiles(["public/assets/gan65-product.jpg", "public/assets/gan65-product.jpg"]);
  await expect(page.getByRole("combobox", { name: "商品图", exact: true })).toHaveValue("uploaded-white");
  await expect(page.getByRole("checkbox", { name: "辅助图：辅助角度2.png", exact: true })).toBeChecked();
  await page.getByRole("combobox", { name: "商品图", exact: true }).selectOption("uploaded-white-2");
  await expect(page.getByRole("checkbox", { name: "辅助图：辅助角度2.png", exact: true })).toHaveCount(0);
  await expect(page.getByText("辅助图 · 0/4", { exact: true })).toBeVisible();
});

test("批量上传中途失败仍保留并选中已上传图片", async ({ page }) => {
  await setup(page, [published], false);
  let uploads = 0;
  await page.route("**/api/projects/project-one/assets", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    uploads++;
    if (uploads === 2) return route.fulfill({ status: 503, json: { error: { message: "第二张上传失败" } } });
    return route.fallback();
  });
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByLabel("上传白底图", { exact: true }).setInputFiles(["public/assets/gan65-product.jpg", "public/assets/gan65-product.jpg"]);
  await expect(page.getByRole("combobox", { name: "商品图", exact: true })).toHaveValue("uploaded-white");
  await expect(page.getByRole("alert")).toContainText("第二张上传失败");
});

test("同一商品项目新增第二套方案，切换保存修改并保留独立批次历史", async ({ page }) => {
  await setup(page, [published]);
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "反推方案", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "场景与构图", exact: true }).fill("第一套专属布局");
  await page.getByRole("button", { name: "新增方案", exact: true }).click();
  await page.getByLabel("新方案名称", { exact: true }).fill("咖啡馆方案");
  await page.getByRole("button", { name: "创建方案", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "反推方案", exact: true }).getByRole("option")).toHaveCount(2);
  await page.getByRole("combobox", { name: "反推方案", exact: true }).selectOption("plan-one");
  await expect(page.getByRole("textbox", { name: "场景与构图", exact: true })).toHaveValue("第一套专属布局");
  await page.getByRole("button", { name: "整套生成", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "历史批次", exact: true }).getByRole("option")).toHaveCount(1);
  await page.getByRole("button", { name: "整套生成", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "历史批次", exact: true }).getByRole("option")).toHaveCount(2);
  await page.getByRole("combobox", { name: "历史批次", exact: true }).selectOption("batch-1");
  const retry = page.waitForRequest(request => request.url().endsWith("/reverse-execution/generate"));
  await page.getByRole("button", { name: "重试此图", exact: true }).click();
  expect((await retry).postDataJSON()).toMatchObject({ planId: "plan-one", batchId: "batch-1", taskIds: ["task-one"] });
  await expect(page.getByRole("combobox", { name: "历史批次", exact: true }).getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("img", { name: /批次 1 图 1 第.*次结果/ })).toHaveCount(2);
});

test("选定商品图和补充参数保存到方案，编译及出图使用当前输入", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, [published]);
  await page.goto("/projects/project-one?tab=reverse");
  await expect(page.getByRole("combobox", { name: "商品图", exact: true })).toHaveValue("white-one");
  await page.getByRole("combobox", { name: "商品图", exact: true }).selectOption("source-one");
  await page.getByLabel("参数填写", { exact: true }).fill("商品名称：蓝牙鼠标；商品参数：黑色，三模连接；核心卖点：轻量便携；补充要求：中文文案，保留品牌标识");
  await page.screenshot({ path: testInfo.outputPath("reverse-inputs-desktop.png") });
  const creation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution"));
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  expect((await creation).postDataJSON()).toEqual({ versionId: "version-two", sourceAssetId: "source-one", auxiliarySourceAssetIds: [], productFacts: { 商品名称: "鼠标项目" }, parameterBrief: "商品名称：蓝牙鼠标；商品参数：黑色，三模连接；核心卖点：轻量便携；补充要求：中文文案，保留品牌标识", outputSettings: { outputLanguage: "中文", model: "gpt-image-2-5", aspectRatio: "3:4", resolution: "标准 1K" } });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "商品图", exact: true })).toHaveValue("source-one");
  await expect(page.getByLabel("参数填写", { exact: true })).toHaveValue("商品名称：蓝牙鼠标；商品参数：黑色，三模连接；核心卖点：轻量便携；补充要求：中文文案，保留品牌标识");
  const generation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution/generate"));
  await page.getByRole("button", { name: "生成此张", exact: true }).click();
  expect((await generation).postDataJSON()).toMatchObject({ sourceAssetId: "source-one", taskIds: ["task-one"] });
  await expect(page.getByRole("img", { name: "图 1 生成结果" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("reverse-inputs-mobile.png") });
});

test("缺少商品图不能出图，可以直接上传白底图并使用", async ({ page }) => {
  await setup(page, [published], false);
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  await expect(page.getByRole("button", { name: "生成此张", exact: true })).toBeDisabled();
  await page.getByLabel("上传白底图", { exact: true }).setInputFiles("public/assets/gan65-product.jpg");
  await expect(page.getByRole("combobox", { name: "商品图", exact: true })).toHaveValue("uploaded-white");
  await expect(page.getByRole("img", { name: "当前商品图" })).toHaveAttribute("src", /uploaded-white\/preview$/);
  await expect(page.getByRole("button", { name: "生成此张", exact: true })).toBeEnabled();
});

test("保存新尺寸后单张生成使用当前设置，历史重试失败后仍可保存", async ({ page }) => {
  await setup(page, [published]);
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  await page.getByRole("button", { name: "整套生成", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "历史批次", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "宽高比", exact: true }).selectOption("16:9");
  await page.getByRole("button", { name: "保存方案", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存方案", exact: true })).toBeDisabled();
  const generation = page.waitForRequest(request => request.url().endsWith("/reverse-execution/generate"));
  await page.getByRole("button", { name: "生成此张", exact: true }).click();
  const body = (await generation).postDataJSON();
  expect(body.aspectRatio).toBe("16:9");
  expect(body.batchId).toBeUndefined();
  await expect(page.getByRole("combobox", { name: "历史批次", exact: true }).getByRole("option")).toHaveCount(2);
  await page.getByRole("textbox", { name: "场景与构图", exact: true }).fill("历史重试前保存的新布局");
  await page.route("**/reverse-execution/generate", route => route.fulfill({ status: 404, json: { error: { message: "原商品图不存在" } } }));
  await page.getByRole("button", { name: "重试此图", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("原商品图不存在");
  await expect(page.getByRole("button", { name: "保存方案", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "场景与构图", exact: true }).fill("失败后继续编辑");
  const saved = page.waitForRequest(request => request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/reverse-execution"));
  await page.getByRole("button", { name: "保存方案", exact: true }).click();
  expect((await saved).postDataJSON().expectedRevision).toBe(5);
});

test("编译只提供只读预览，保存和新生成不复用预览提示词", async ({ page }) => {
  await setup(page, [published]);
  let compilations = 0;
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/reverse-execution/compile")) compilations += 1; });
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  await page.getByRole("button", { name: "编译提示词", exact: true }).click();
  const preview = page.getByRole("textbox", { name: "提示词预览", exact: true });
  await expect(preview).toHaveValue("商品：鼠标项目");
  await expect(preview).toHaveAttribute("readonly", "");
  await page.getByRole("textbox", { name: "场景与构图", exact: true }).fill("修改后的新布局");
  await expect(preview).toHaveValue("");
  const saving = page.waitForRequest(request => request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/reverse-execution"));
  const generation = page.waitForRequest(request => new URL(request.url()).pathname.endsWith("/reverse-execution/generate"));
  await page.getByRole("button", { name: "生成此张", exact: true }).click();
  expect((await saving).postDataJSON().document.tasks[0]).toMatchObject({ promptDraft: "", structure: { layout: "修改后的新布局" } });
  await generation;
  await expect(page.getByRole("img", { name: "图 1 生成结果" })).toBeVisible();
  expect(compilations).toBe(1);
});

test("自动分配提交后生成失败仍能按最新修订保存", async ({ page }) => {
  await setup(page, [published], true, true);
  await page.goto("/projects/project-one?tab=reverse");
  await page.getByRole("button", { name: "生成项目方案", exact: true }).click();
  await page.getByRole("button", { name: "生成此张", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("分配后生成失败");
  await page.getByRole("textbox", { name: "场景与构图", exact: true }).fill("失败后保留的新布局");
  const saving = page.waitForRequest(request => request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/reverse-execution"));
  await page.getByRole("button", { name: "保存方案", exact: true }).click();
  expect((await saving).postDataJSON().expectedRevision).toBe(2);
  await expect(page.getByRole("textbox", { name: "场景与构图", exact: true })).toHaveValue("失败后保留的新布局");
});

test("没有已发布版本时说明先发布，并且不能生成方案", async ({ page }) => {
  await setup(page, [{ ...published, versions: [], latestVersionId: null }]);
  await page.goto("/projects/project-one?tab=reverse");
  await expect(page.getByText("暂无已发布的反推版本，请先在“爆品图反推”中完成分析并发布。", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "反推版本" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成项目方案", exact: true })).toHaveCount(0);
});

import { test, expect, type Page } from "playwright/test";
import type { ReverseExecutionPlan } from "../../src/api/reverse-execution";

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

async function setup(page: Page, projects: unknown[], hasAssets = true) {
  let plan: ReverseExecutionPlan | null = null;
  const assets = hasAssets ? [sourceAsset, whiteAsset] : [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const send = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "/api/projects/project-one") return send({ id: "project-one", name: "鼠标项目", status: "active", archivedAt: null, createdAt: now, updatedAt: now, assets, selections: {} });
    if (/\/assets\/[^/]+\/preview$/.test(path)) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    if (path === "/api/projects/project-one/assets" && request.method() === "POST") {
      const uploaded = { ...whiteAsset, id: "uploaded-white", filename: "gan65-product.jpg" };
      assets.push(uploaded);
      return send(uploaded);
    }
    if (path === "/api/reverse-projects") return send(projects);
    if (path.endsWith("/reverse-bindings")) return send([]);
    if (path === "/api/projects/project-one/reverse-execution") {
      if (request.method() === "POST") {
        const { versionId, sourceAssetId, productFacts, parameterBrief, outputSettings } = request.postDataJSON();
        plan = { id: "plan-one", projectId: "project-one", reverseVersionId: versionId, versionId, sourceAssetId, productFacts, parameterBrief, outputSettings, referenceCount: 1, revision: 1, createdAt: now, updatedAt: now,
          tasks: [{ id: "task-one", ordinal: 1, referenceImageId: "ref-one", referenceFilename: "参考图.png", referencePreviewUrl: "/assets/gan65-product.jpg", referenceModuleId: "module-one", title: "桌面场景", structure, promptDraft: "", status: "draft" }] };
      }
      if (request.method() === "PATCH" && plan) plan = { ...plan, ...request.postDataJSON().document, revision: plan.revision + 1 };
      return send(plan);
    }
    if (path.endsWith("/reverse-execution/compile") && plan) {
      const { productFacts } = request.postDataJSON();
      plan = { ...plan, revision: plan.revision + 1, productFacts, tasks: plan.tasks.map(task => ({ ...task, status: "compiled", promptDraft: `商品：${Object.values(productFacts).join("；")}` })) };
      return send(plan);
    }
    if (path.endsWith("/reverse-execution/generate") && plan) {
      plan = { ...plan, revision: plan.revision + 1, tasks: plan.tasks.map(task => ({ ...task, status: "succeeded", generatedPreviewUrl: "/assets/gan65-product.jpg" })) };
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
  expect((await creation).postDataJSON()).toEqual({ versionId: "version-two", sourceAssetId: "source-one", productFacts: { 商品名称: "鼠标项目" }, parameterBrief: "商品名称：蓝牙鼠标；商品参数：黑色，三模连接；核心卖点：轻量便携；补充要求：中文文案，保留品牌标识", outputSettings: { outputLanguage: "中文", model: "gpt-image-2-5", aspectRatio: "3:4", resolution: "标准 1K" } });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "商品图", exact: true })).toHaveValue("source-one");
  await expect(page.getByLabel("参数填写", { exact: true })).toHaveValue("商品名称：蓝牙鼠标；商品参数：黑色，三模连接；核心卖点：轻量便携；补充要求：中文文案，保留品牌标识");
  const compilation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution/compile"));
  const generation = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reverse-execution/generate"));
  await page.getByRole("button", { name: "生成此张", exact: true }).click();
  await compilation;
  await expect(page.getByLabel("编译后的提示词")).toContainText("商品：鼠标项目");
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

test("没有已发布版本时说明先发布，并且不能生成方案", async ({ page }) => {
  await setup(page, [{ ...published, versions: [], latestVersionId: null }]);
  await page.goto("/projects/project-one?tab=reverse");
  await expect(page.getByText("暂无已发布的反推版本，请先在“爆品图反推”中完成分析并发布。", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "反推版本" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成项目方案", exact: true })).toHaveCount(0);
});

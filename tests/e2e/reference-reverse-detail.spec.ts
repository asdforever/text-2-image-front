import { expect, test, type Page } from "playwright/test";

const now = "2026-10-14T00:00:00Z";
const references = [
  { id: "ref-1", ordinal: 1, filename: "商品主视觉.jpg", width: 900, height: 1200, mimeType: "image/jpeg", previewUrl: "/assets/gan65-product.jpg" },
  { id: "ref-2", ordinal: 2, filename: "使用场景.jpg", width: 1600, height: 900, mimeType: "image/jpeg", previewUrl: "/assets/tokyo-desk-v3.jpg" },
];
const modules = references.map((reference, index) => ({ id: `module-${index}`, title: index ? "办公场景" : "首屏主视觉", referenceImageId: reference.id, goal: index ? "解释办公环境的使用价值" : "建立商品识别", layout: index ? "桌面环境与自然光，保留标题区" : "产品占据中轴，参数沿右侧排布", informationHierarchy: "标题 → 核心卖点 → 补充参数", typography: "简洁无衬线，强调关键数字", colorAndLighting: "灰白背景，自然侧光", adaptationNotes: "使用商品已确认规格，保留参考图的信息层级" }));
const initial = { id: "reverse-design", name: "数码商品设计参考", category: "数码配件", summary: "通过产品细节与办公场景表达商品价值", suitableFor: "数码配件与桌面用品", goal: "解释参数，降低购买疑虑", requiredMaterials: "商品原图与已确认参数", notSuitableFor: "人物叙事", references, overall: { contentFlow: "商品识别 → 参数解释 → 使用场景", visualSystem: "灰白背景、侧光与克制的蓝色强调", moduleStrategy: "主视觉建立识别，场景解释使用价值", adaptationRules: "迁移设计方式，使用当前商品的真实参数" }, modules, revision: 3, analysis: { status: "completed" }, versions: [{ id: "version-1", versionNo: 1, revision: 3, createdAt: now }], latestVersionId: "version-1", createdAt: now, updatedAt: now };

async function setup(page: Page, category = initial.category) {
  let project = { ...structuredClone(initial), category };
  const fixed = { ...initial.versions[0], reverseProjectId: initial.id, document: structuredClone(initial) };
  await page.route(url => url.pathname.startsWith(`/api/reverse-projects/${initial.id}`), route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data: unknown) => route.fulfill({ json: { data } });
    if (path.endsWith("/versions/version-1")) return send(fixed);
    if (path.endsWith("/reference-order")) {
      const { referenceIds, expectedRevision } = route.request().postDataJSON();
      expect(expectedRevision).toBe(project.revision);
      project = { ...project, revision: project.revision + 1, references: referenceIds.map((id: string, index: number) => ({ ...project.references.find(image => image.id === id)!, ordinal: index + 1 })) };
      return send(project);
    }
    if (path.endsWith("/bindings")) return send([{ id: "binding-1", projectId: "business", projectName: "无线鼠标项目", target: "suite", scope: "overall", versionId: "version-1", versionNo: 1, reverseProjectId: project.id, sourceModuleId: null, sourceModuleTitle: null, targetModuleId: null, createdAt: now }]);
    if (path === `/api/reverse-projects/${initial.id}`) return send(project);
    return route.fulfill({ status: 404, json: { error: { message: "测试资源不存在" } } });
  });
}

test("模块拆解选择后展示对应原图，可键盘打开大图，手机无溢出", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto(`/reverse-projects/${initial.id}?tab=modules`);
  const list = page.getByLabel("反推模块列表");
  await list.getByRole("button", { name: "办公场景", exact: true }).click();
  await expect(list.getByRole("button", { name: "办公场景", exact: true })).toHaveAttribute("aria-pressed", "true");
  const previewButton = page.getByRole("button", { name: "查看模块参考图 使用场景.jpg" });
  await expect(previewButton.getByRole("img")).toHaveAttribute("src", references[1].previewUrl);
  await expect(page.getByText("桌面环境与自然光，保留标题区", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("modules-desktop.png") });
  await previewButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "使用场景.jpg" });
  await expect(dialog.getByRole("img", { name: "使用场景.jpg" })).toHaveAttribute("src", references[1].previewUrl);
  await expect(dialog.getByRole("link", { name: "打开原尺寸图片" })).toHaveAttribute("href", references[1].previewUrl);
  await page.keyboard.press("Escape");
  await expect(previewButton).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("modules-mobile.png") });
});

test("手机端长英文品类换行，内容区不会产生横向滚动", async ({ page }) => {
  await setup(page, "longcategory".repeat(6));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/reverse-projects/${initial.id}?tab=references`);
  await expect(page.locator(".rp-detail-meta")).toContainText("longcategory".repeat(6));
  expect(await page.locator(".rp-main").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

test("参考图顺序、版本只读与编辑返回草稿保持正确，四个页签适配手机", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto(`/reverse-projects/${initial.id}?tab=references`);
  await expect(page.locator(".rp-image-card")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("references-desktop.png") });
  await page.getByRole("button", { name: "下移 商品主视觉.jpg" }).click();
  await expect(page.locator(".rp-image-caption strong").first()).toHaveText("1. 使用场景.jpg");
  await page.getByRole("tab", { name: "整体反推", exact: true }).click();
  await page.getByRole("button", { name: /v1 · 已发布/ }).click();
  await expect(page.getByText(/正在查看固定版本 v1/)).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑整体反推", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "参考套图", exact: true }).click();
  await expect(page.getByLabel("上传参考套图")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "下移 商品主视觉.jpg" })).toHaveCount(0);
  await expect(page.locator(".rp-image-caption strong").first()).toHaveText("1. 商品主视觉.jpg");
  await page.getByRole("button", { name: "返回当前草稿", exact: true }).click();
  await expect(page.getByLabel("上传参考套图")).toBeVisible();
  await expect(page.locator(".rp-image-caption strong").first()).toHaveText("1. 使用场景.jpg");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [tab, filename] of [["参考套图", "references-mobile.png"], ["整体反推", "overall-mobile.png"], ["模块拆解", "module-layout-mobile.png"], ["绑定记录", "bindings-mobile.png"]]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    if (tab === "绑定记录") await expect(page.getByLabel("绑定记录列表")).toContainText("无线鼠标项目");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(filename) });
  }
  await page.getByRole("button", { name: "打开对应工作台", exact: true }).click();
  await expect(page).toHaveURL(/projects\/business\?tab=suite$/);
});

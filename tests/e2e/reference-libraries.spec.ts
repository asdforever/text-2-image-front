import { expect, test } from "playwright/test";

const now = "2026-10-14T00:00:00Z";
const libraries = [
  { id: "images", name: "鼠标商品图", description: "原图与白底图", assetType: "image", createdAt: now, updatedAt: now },
  { id: "references", name: "设计参考", description: "主图设计参考", assetType: "image", createdAt: now, updatedAt: now },
  { id: "copy", name: "商品卖点", description: "鼠标参数与文案", assetType: "text", createdAt: now, updatedAt: now },
];

test("素材库搜索与类型筛选组合，刷新失败保留卡片，删除需要确认", async ({ page }, testInfo) => {
  let fail = false;
  let deletes = 0;
  await page.route(url => url.pathname === "/api/asset-libraries", route => route.fulfill(fail
    ? { status: 503, json: { error: { message: "素材库暂时不可用" } } }
    : { json: { data: libraries } }));
  await page.route(url => url.pathname === "/api/asset-libraries/images", route => {
    if (route.request().method() !== "DELETE") return route.fulfill({ json: { data: libraries[0] } });
    deletes++;
    return route.fulfill({ status: 503, json: { error: { message: "删除失败，请重试" } } });
  });
  await page.goto("/asset-libraries");
  await expect(page.locator(".reference-asset-card")).toHaveCount(3);
  await page.getByRole("searchbox", { name: "搜索素材库" }).fill("鼠标");
  await expect(page.locator(".reference-asset-card")).toHaveCount(2);
  await page.getByRole("combobox", { name: "素材类型筛选" }).selectOption("text");
  await expect(page.locator(".reference-asset-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "打开素材库 商品卖点" })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索素材库" }).fill("");
  await page.getByRole("combobox", { name: "素材类型筛选" }).selectOption("all");
  fail = true;
  await page.getByRole("button", { name: "刷新素材库" }).click();
  await expect(page.getByRole("alert")).toContainText("素材库暂时不可用");
  await expect(page.locator(".reference-asset-card")).toHaveCount(3);
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("assets-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("assets-mobile.png") });
  await page.getByRole("button", { name: "删除素材库 鼠标商品图" }).click();
  expect(deletes).toBe(0);
  const dialog = page.getByRole("dialog", { name: "确认删除" });
  await expect(dialog).toContainText("会同时删除库内所有素材");
  await dialog.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("删除失败");
  expect(deletes).toBe(1);
  await expect(dialog).toBeVisible();
  await expect(page.locator(".reference-asset-card")).toHaveCount(3);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "打开素材库 鼠标商品图" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/asset-libraries\/images$/);
});

test("手动创建素材库等待请求完成，防止重复提交", async ({ page }) => {
  let posts = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname === "/api/asset-libraries", async route => {
    if (route.request().method() === "POST") {
      posts++;
      expect(route.request().postDataJSON()).toEqual({ name: "新参考", assetType: "text" });
      await gate;
      return route.fulfill({ json: { data: { ...libraries[2], id: "new", name: "新参考" } } });
    }
    return route.fulfill({ json: { data: libraries } });
  });
  await page.goto("/asset-libraries");
  await page.getByRole("button", { name: "新建素材库", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新建素材库" });
  await dialog.getByLabel("名称", { exact: true }).fill(" 新参考 ");
  await dialog.getByLabel("素材类型", { exact: true }).selectOption("text");
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "创建中…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(posts).toBe(1);
  release();
  await expect(dialog).toHaveCount(0);
});

test("成品封面优先生成图，搜索筛选不丢失独立档案与图片浏览", async ({ page }, testInfo) => {
  let fail = false;
  const asset = (id: string, kind: string) => ({ id, kind, sourceKind: "upload", originalFilename: `${id}.jpg`, previewUrl: `/assets/${id}.jpg`, sourceSnapshot: {}, versions: [], mimeType: "image/jpeg", width: 900, height: 900, fileSize: 1000 });
  const products = [
    { id: "mouse", name: "无线鼠标", projectId: "project-mouse", libraryId: "lib", archivedAt: null, versions: [], assets: [asset("original", "source"), asset("gan65-product", "generated")] },
    { id: "keyboard", name: "键盘档案", projectId: null, libraryId: "lib", archivedAt: null, versions: [], assets: [asset("keyboard-source", "source")] },
    { id: "empty", name: "等待生图", projectId: "project-empty", libraryId: "lib", archivedAt: null, versions: [], assets: [] },
  ];
  await page.route(url => url.pathname === "/api/product-libraries", route => route.fulfill(fail
    ? { status: 503, json: { error: { message: "成品库暂时不可用" } } }
    : { json: { data: [{ id: "lib", name: "项目成品库" }] } }));
  await page.route(url => url.pathname === "/api/product-libraries/lib/products", route => route.fulfill({ json: { data: products } }));
  await page.goto("/product-libraries");
  const card = page.locator(".workflow-project-card").filter({ hasText: "无线鼠标" });
  await expect(card.locator("img")).toHaveAttribute("src", "/assets/gan65-product.jpg");
  fail = true;
  await page.getByRole("button", { name: "刷新成品档案" }).click();
  await expect(page.getByRole("alert")).toContainText("成品库暂时不可用");
  await expect(page.locator(".workflow-project-card")).toHaveCount(3);
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("combobox", { name: "成品状态筛选" }).selectOption("empty");
  await expect(page.locator(".workflow-project-card")).toHaveCount(1);
  await expect(page.getByText("等待生图", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "成品状态筛选" }).selectOption("all");
  await page.getByRole("searchbox", { name: "搜索成品档案" }).fill("键盘");
  await expect(page.locator(".workflow-project-card")).toHaveCount(1);
  await page.locator(".workflow-project-card").click();
  await expect(page.getByRole("combobox", { name: "项目批次" })).toBeVisible();
  await expect(page.getByText("keyboard-source.jpg", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索成品档案" }).fill("鼠标");
  await expect(page.locator(".product-library-inline-archive")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "搜索成品档案" }).fill("");
  await page.screenshot({ path: testInfo.outputPath("products-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("products-mobile.png") });
  await card.click();
  await expect(page).toHaveURL(/product-libraries\/projects\/mouse$/);
});

test("反推列表保留套图预览、发布筛选和手机操作", async ({ page }, testInfo) => {
  const reference = { id: "ref", ordinal: 1, filename: "参考.jpg", width: 900, height: 900, mimeType: "image/jpeg", previewUrl: "/assets/gan65-product.jpg" };
  const draft = { id: "reverse-draft", name: "鼠标场景参考", category: "数码", summary: "从办公场景表达产品价值", suitableFor: "鼠标", references: [reference, { ...reference, id: "ref-2" }], modules: [], revision: 1, analysis: { status: "completed" }, versions: [], latestVersionId: null, createdAt: now, updatedAt: now };
  const published = { ...draft, id: "reverse-published", name: "键盘详情参考", latestVersionId: "v1", versions: [{ id: "v1", revision: 1, versionNo: 1, createdAt: now }] };
  await page.route(url => url.pathname === "/api/reverse-projects", route => route.fulfill({ json: { data: [draft, published] } }));
  await page.goto("/reverse-projects");
  await expect(page.locator(".rp-project-card")).toHaveCount(2);
  await expect(page.locator(".rp-project-card").first().locator(".rp-cover img")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("reverse-desktop.png") });
  await page.getByRole("button", { name: "已发布", exact: true }).click();
  await expect(page.locator(".rp-project-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "键盘详情参考", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "草稿", exact: true }).click();
  await expect(page.getByRole("heading", { name: "鼠标场景参考", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "全部项目", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "新建反推项目", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("reverse-mobile.png") });
});

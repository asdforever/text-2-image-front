import { expect, test } from "playwright/test";

const imageLibrary = {
  id: "library-images",
  name: "产品原图库",
  description: "可复用商品原图",
  assetType: "image",
  createdAt: "2026-09-10T00:00:00Z",
  updatedAt: "2026-09-10T00:00:00Z",
};

const textLibrary = {
  id: "library-texts",
  name: "商品文案库",
  description: "测试文本",
  assetType: "text",
  createdAt: "2026-09-10T00:00:00Z",
  updatedAt: "2026-09-10T00:00:00Z",
};

const secondImageLibrary = {
  ...imageLibrary,
  id: "library-images-b",
  name: "备用原图库",
};

const images = [
  { id: "asset-front", libraryId: imageLibrary.id, name: "library-front.png", assetType: "image", url: "/assets/gan65-product.jpg", width: 1200, height: 1200, createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" },
  { id: "asset-side", libraryId: imageLibrary.id, name: "这是一个用于验证窄屏省略显示的非常非常长的商品侧面素材文件名.png", assetType: "image", url: "/assets/gan65-product-tight.jpg", width: 900, height: 1200, createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("picagent-project-store"));
  await page.route("**/api/projects/proj-demo", (route) => route.fulfill({ json: { data: {
    id: "proj-demo", name: "演示项目", status: "active", archivedAt: null,
    createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z",
    assets: [], selections: {},
  } } }));
});

test("selects multiple image-library assets and reports duplicate imports", async ({ page }) => {
  await page.route("**/api/asset-libraries", (route) => route.fulfill({ json: { data: [imageLibrary, textLibrary] } }));
  await page.route(`**/api/asset-libraries/${imageLibrary.id}/assets`, (route) => route.fulfill({ json: { data: images } }));
  await page.goto("/projects/proj-demo?tab=base");

  await expect(page.getByRole("button", { name: "提交素材" })).toBeVisible();
  await page.getByRole("button", { name: "从素材库选择" }).click();
  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("combobox", { name: "图片素材库" })).toHaveValue(imageLibrary.id);
  await expect(picker.getByRole("option", { name: "产品原图库" })).toHaveCount(1);
  await expect(picker.getByRole("option", { name: "商品文案库" })).toHaveCount(0);

  await picker.getByRole("button", { name: "选择 library-front.png" }).click();
  await picker.getByRole("button", { name: /选择 这是一个用于验证/ }).click();
  await picker.getByRole("button", { name: "确认添加 2 张" }).click();
  await expect(page.getByRole("status")).toContainText("新增 2 张");
  await expect(page.getByText("library-front.png", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "从素材库选择" }).click();
  await page.getByRole("dialog", { name: "从素材库选择原图" }).getByRole("button", { name: "选择 library-front.png" }).click();
  await page.getByRole("button", { name: "确认添加 1 张" }).click();
  await expect(page.getByRole("status")).toContainText("跳过重复 1 张");

  const importedCard = page.locator(".base-card", { hasText: "library-front.png" }).first();
  const importedSideCard = page.locator(".base-card", { hasText: images[1].name }).first();
  await page.getByTitle("批量选择").click();
  await importedCard.getByRole("checkbox", { name: "选择 library-front.png" }).click();
  await importedSideCard.getByRole("checkbox", { name: `选择 ${images[1].name}` }).click();
  await page.getByRole("button", { name: "批量生成 (2)" }).click();
  await page.getByRole("dialog", { name: "批量生成白底图" }).getByRole("button", { name: "确认批量生成" }).click();
  await expect(page.getByRole("status")).toContainText("已完成 2 张白底图生成", { timeout: 5_000 });

  await importedCard.hover();
  await importedCard.getByTitle("生成白底图").click();
  const templateDialog = page.getByRole("dialog", { name: "选择白底精修模板" });
  await templateDialog.getByRole("button", { name: "生成白底图" }).click();
  await expect(page.getByRole("status")).toContainText("白底图生成完成", { timeout: 5_000 });
});

test("cancels a pending library selection without importing it", async ({ page }) => {
  await page.route("**/api/asset-libraries", (route) => route.fulfill({ json: { data: [imageLibrary] } }));
  await page.route(`**/api/asset-libraries/${imageLibrary.id}/assets`, (route) => route.fulfill({ json: { data: images } }));
  await page.goto("/projects/proj-demo?tab=base");
  await page.getByRole("button", { name: "从素材库选择" }).click();
  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await picker.getByRole("button", { name: "选择 library-front.png" }).click();
  await picker.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("library-front.png", { exact: true })).toHaveCount(0);
});

test("shows a retryable loading error without disabling local submission", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/asset-libraries", (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: { message: "数据库暂不可用" } } });
    return route.fulfill({ json: { data: [imageLibrary] } });
  });
  await page.route(`**/api/asset-libraries/${imageLibrary.id}/assets`, (route) => route.fulfill({ json: { data: [] } }));
  await page.goto("/projects/proj-demo?tab=base");
  await page.getByRole("button", { name: "从素材库选择" }).click();

  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await expect(picker).toContainText("数据库暂不可用");
  await picker.getByRole("button", { name: "重试" }).click();
  await expect(picker.getByRole("combobox", { name: "图片素材库" })).toHaveValue(imageLibrary.id);
  await expect(picker).toContainText("这个素材库还没有可用图片");
  await picker.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("button", { name: "提交素材" })).toBeEnabled();
});

test("retries a failed image-list request for the selected library", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/asset-libraries", (route) => route.fulfill({ json: { data: [imageLibrary] } }));
  await page.route(`**/api/asset-libraries/${imageLibrary.id}/assets`, (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: { message: "图片服务暂不可用" } } });
    return route.fulfill({ json: { data: images } });
  });
  await page.goto("/projects/proj-demo?tab=base");
  await page.getByRole("button", { name: "从素材库选择" }).click();
  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await expect(picker).toContainText("图片服务暂不可用");
  await picker.getByRole("button", { name: "重试" }).click();
  await expect(picker.getByRole("button", { name: "选择 library-front.png" })).toBeVisible();
});

test("keeps the latest library visible when an older request resolves last", async ({ page }) => {
  let releaseFirst!: () => void;
  let markFirstFinished!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const firstFinished = new Promise<void>((resolve) => { markFirstFinished = resolve; });
  const secondAssets = [{ ...images[0], id: "asset-back", libraryId: secondImageLibrary.id, name: "back.png" }];
  await page.route("**/api/asset-libraries", (route) => route.fulfill({ json: { data: [imageLibrary, secondImageLibrary] } }));
  await page.route(`**/api/asset-libraries/${imageLibrary.id}/assets`, async (route) => {
    await firstGate;
    await route.fulfill({ json: { data: images } });
    markFirstFinished();
  });
  await page.route(`**/api/asset-libraries/${secondImageLibrary.id}/assets`, (route) => route.fulfill({ json: { data: secondAssets } }));
  await page.goto("/projects/proj-demo?tab=base");
  const trigger = page.getByRole("button", { name: "从素材库选择" });
  await trigger.click();
  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await picker.getByRole("combobox", { name: "图片素材库" }).selectOption(secondImageLibrary.id);
  await expect(picker.getByRole("button", { name: "选择 back.png" })).toBeVisible();

  releaseFirst();
  await firstFinished;
  await expect(picker.getByRole("button", { name: "选择 back.png" })).toBeVisible();
  await expect(picker.getByRole("button", { name: "选择 library-front.png" })).toHaveCount(0);

  await picker.getByRole("button", { name: "取消", exact: true }).click();
  await expect(trigger).toBeFocused();
});

test("shows an empty state when there are no image libraries", async ({ page }) => {
  await page.route("**/api/asset-libraries", (route) => route.fulfill({ json: { data: [textLibrary] } }));
  await page.goto("/projects/proj-demo?tab=base");
  await page.getByRole("button", { name: "从素材库选择" }).click();
  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await expect(picker).toContainText("暂无图片素材库");
  await expect(picker.getByRole("button", { name: "确认添加 0 张" })).toBeDisabled();
});

test("keeps the picker contained on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/asset-libraries", (route) => route.fulfill({ json: { data: [imageLibrary] } }));
  await page.route(`**/api/asset-libraries/${imageLibrary.id}/assets`, (route) => route.fulfill({ json: { data: images } }));
  await page.goto("/projects/proj-demo?tab=base");
  await page.getByRole("button", { name: "从素材库选择" }).click();

  const picker = page.getByRole("dialog", { name: "从素材库选择原图" });
  await expect(picker).toBeFocused();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBeTruthy();
  }
  const box = await picker.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  const longName = picker.getByText(images[1].name, { exact: true });
  await expect(longName).toBeVisible();
  expect(await longName.evaluate((node) => {
    const card = node.closest("button");
    return Boolean(card && card.scrollWidth <= card.clientWidth);
  })).toBeTruthy();
});

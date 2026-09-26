import { expect, test } from "playwright/test";

test("成品库按项目展示自动归档的全部资产", async ({ page }) => {
  const library = {
    id: "prod-lib-1",
    name: "项目成品库",
    description: "按项目自动归档的全部资产",
    archivedAt: null,
    createdAt: "2026-09-10T00:00:00Z",
  };
  const product = {
    id: "prod-1",
    libraryId: library.id,
    name: "无线键盘项目",
    projectId: "proj-demo",
    archivedAt: null,
    versions: [],
    assets: [
      {
        id: "asset-source",
        kind: "source",
        sourceKind: "upload",
        originalFilename: "keyboard.png",
        mimeType: "image/png",
        fileSize: 2048,
        width: 1200,
        height: 1200,
        previewUrl: "/api/projects/proj-demo/assets/asset-source/preview",
        sourceSnapshot: {},
        versions: [],
      },
      {
        id: "asset-hero",
        kind: "generated",
        sourceKind: "generation",
        originalFilename: "hero.png",
        mimeType: "image/png",
        fileSize: 4096,
        width: 1600,
        height: 1600,
        previewUrl: "/api/projects/proj-demo/assets/asset-hero/preview",
        sourceSnapshot: {},
        versions: [
          { id: "version-hero", productType: "hero", sourceSnapshot: { assetId: "asset-hero" }, previewUrl: null, status: "published" },
        ],
      },
    ],
  };

  await page.route("**/api/product-libraries?includeArchived=false", (route) =>
    route.fulfill({ json: { data: [library] } }),
  );
  await page.route(`**/api/product-libraries/${library.id}`, (route) =>
    route.fulfill({ json: { data: library } }),
  );
  await page.route(`**/api/product-libraries/${library.id}/products?includeArchived=false`, (route) =>
    route.fulfill({ json: { data: [product] } }),
  );

  await page.goto("/product-libraries");
  await expect(page.getByText("1 个项目", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建成品库" })).toHaveCount(0);
  await page.getByText("项目成品库", { exact: true }).first().click();

  await expect(page.getByText("无线键盘项目", { exact: true })).toBeVisible();
  await expect(page.getByText("原图 1", { exact: true })).toBeVisible();
  await expect(page.getByText("主图 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开项目" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发布成功版本" })).toHaveCount(0);
  await expect(page.getByText("keyboard.png", { exact: true })).toBeVisible();
  await expect(page.getByText("1600 × 1600", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /keyboard\.png/ })).toHaveAttribute(
    "href",
    "/api/projects/proj-demo/assets/asset-source/preview",
  );
  await page.getByRole("button", { name: "打开项目" }).click();
  await expect(page).toHaveURL(/\/projects\/proj-demo\?tab=base$/);
});

test("空项目档案和加载失败都有明确状态", async ({ page }) => {
  const library = { id: "prod-lib-empty", name: "项目成品库", description: "", archivedAt: null };
  const emptyProduct = { id: "prod-empty", libraryId: library.id, name: "空项目", projectId: "project-empty", archivedAt: null, versions: [], assets: [] };
  await page.route(`**/api/product-libraries/${library.id}`, (route) =>
    route.fulfill({ json: { data: library } }),
  );
  await page.route(`**/api/product-libraries/${library.id}/products?includeArchived=false`, (route) =>
    route.fulfill({ json: { data: [emptyProduct] } }),
  );
  await page.goto(`/product-libraries/${library.id}`);
  await expect(page.getByText("项目已建档，暂无图片资产", { exact: true })).toBeVisible();

  await page.route("**/api/product-libraries?includeArchived=false", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "成品库暂时不可用" } } }),
  );
  await page.goto("/product-libraries");
  await expect(page.getByRole("alert")).toContainText("成品库暂时不可用");
});

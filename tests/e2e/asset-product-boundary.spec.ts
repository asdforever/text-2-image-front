import { expect, test } from "playwright/test";

test("项目上传由后端自动归档且不会写入测试库", async ({ page }) => {
  const now = "2026-09-16T00:00:00Z";
  const project = { id: "proj-demo", name: "演示项目", status: "active", archivedAt: null, createdAt: now, updatedAt: now, assets: [] as Array<Record<string, unknown>>, selections: {} };
  const library = { id: "project-library", name: "项目成品库", description: "按项目自动归档的全部资产", archivedAt: null };
  let projectUploadCalls = 0;
  let productionPublishCalls = 0;
  let testProductCalls = 0;

  await page.route("**/api/projects/proj-demo", (route) => route.fulfill({ json: { data: project } }));
  await page.route("**/api/projects/proj-demo/assets", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: project.assets } });
    projectUploadCalls += 1;
    const asset = { id: "asset-upload-1", kind: "source", sourceAssetId: null, generationSnapshotId: null, state: "available", filename: "商品原图.png", mimeType: "image/png", byteSize: 68, width: 1, height: 1, sha256: "a".repeat(64), createdAt: now };
    project.assets = [asset];
    await route.fulfill({ status: 201, json: { data: asset } });
  });
  await page.route("**/api/product-libraries?includeArchived=false", (route) => route.fulfill({ json: { data: [library] } }));
  await page.route(`**/api/product-libraries/${library.id}/products?includeArchived=false`, (route) => route.fulfill({
    json: {
      data: project.assets.length === 0 ? [] : [{ id: "project-product", libraryId: library.id, name: project.name, projectId: project.id, archivedAt: null, versions: [], assets: [] }],
    },
  }));
  await page.route("**/api/product-libraries/**/versions/publish", (route) => {
    productionPublishCalls += 1;
    return route.fulfill({ status: 500, json: { error: { message: "项目上传不应由前端发布版本" } } });
  });
  await page.route("**/api/test-product-libraries/**", (route) => {
    testProductCalls += 1;
    return route.fulfill({ status: 500, json: { error: { message: "项目上传不应写入测试库" } } });
  });

  await page.goto("/projects/proj-demo?tab=base");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "商品原图.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.getByRole("status").filter({ hasText: "已提交 1 个素材" })).toContainText("已提交 1 个素材");
  expect(projectUploadCalls).toBe(1);
  expect(productionPublishCalls).toBe(0);
  expect(testProductCalls).toBe(0);

  await page.goto("/product-libraries");
  await expect(page.getByText("演示项目", { exact: true })).toBeVisible();
  expect(productionPublishCalls).toBe(0);
  expect(testProductCalls).toBe(0);
});

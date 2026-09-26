import { expect, test } from "playwright/test";

for (const unavailable of [null, "asset", "production", "test", "one-library", "all"] as const) {
  test(`白底图库从现有 API 读取，单一来源失败不阻断其余来源：${unavailable ?? "全部正常"}`, async ({ page }) => {
    const requests: string[] = [];
    let failure = unavailable;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith("/api/")) return route.fallback();
      requests.push(path);
      const fail = () => route.fulfill({ status: 503, json: { error: { message: "来源暂不可用" } } });
      const ok = (data: unknown) => route.fulfill({ json: { data } });
      if (path === "/api/projects/proj-demo") return ok({ id: "proj-demo", name: "测试项目", status: "active", createdAt: "2026-09-21", updatedAt: "2026-09-21", assets: [], selections: {} });
      if (path === "/api/asset-libraries") return failure === "asset" || failure === "all" ? fail() : ok([{ id: "shared", name: "图片库", assetType: "image" }, { id: "broken", name: "失效图片库", assetType: "image" }]);
      if (path === "/api/asset-libraries/broken/assets") return failure === "one-library" ? fail() : ok([]);
      if (path === "/api/asset-libraries/shared/assets") return ok([
        { id: "asset-white", libraryId: "shared", name: "素材白底图", assetType: "image", url: "/fixture.png", metadata: { assetType: "white_background" } },
        { id: "ordinary", libraryId: "shared", name: "普通场景图片", assetType: "image", url: "/fixture.png" },
      ]);
      if (path === "/api/product-libraries") return failure === "production" || failure === "all" ? fail() : ok([{ id: "production", name: "成品库" }]);
      if (path === "/api/product-libraries/production/products") return ok([{ id: "product", name: "正式白底图" }]);
      if (path === "/api/products/product/versions") return ok([{ id: "version", productType: "white_background", status: "published", previewUrl: "/fixture.png", sourceSnapshot: {} }]);
      if (path === "/api/test-product-libraries") return failure === "test" || failure === "all" ? fail() : ok([{ id: "test", name: "测试库" }]);
      if (path === "/api/test-product-libraries/test/products") return ok([{ id: "test-white", name: "测试白底图", productType: "white_background", url: "/fixture.png" }]);
      return route.fulfill({ status: 404, json: { error: { message: "不存在的旧接口" } } });
    });
    await page.route("**/fixture.png", route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
    await page.goto("/projects/proj-demo?tab=base");
    await page.getByRole("button", { name: "从已有库选择", exact: true }).click();
    const picker = page.getByRole("dialog");
    if (unavailable === "all") {
      await expect(picker.getByRole("alert")).toContainText("测试库加载失败");
      await expect(picker.locator(".library-source-item")).toHaveCount(0);
      failure = null;
      await picker.getByRole("button", { name: "重新加载图库" }).click();
    }
    for (const [source, label] of [["asset", "素材白底图"], ["production", "正式白底图"], ["test", "测试白底图"]]) {
      if (source !== unavailable) await expect(picker.getByRole("button", { name: new RegExp(label) })).toBeVisible();
    }
    await expect(picker.getByText("普通场景图片")).toHaveCount(0);
    if (failure) await expect(picker.getByRole("alert")).toBeVisible();
    else await expect(picker.getByRole("alert")).toHaveCount(0);
    expect(requests.some(path => path.startsWith("/api/library/"))).toBe(false);
  });
}

import { expect, test, type Page } from "playwright/test";

const now = "2026-10-14T00:00:00Z";
const library = { id: "mouse-images", name: "鼠标素材", description: "产品原图与设计参考", assetType: "image", createdAt: now, updatedAt: now };
const image = { id: "image-1", libraryId: library.id, name: "商品白底图", assetType: "image", url: "/assets/gan65-product.jpg", width: 900, height: 1200, fileSize: 2048, createdAt: now, updatedAt: now };
const second = { ...image, id: "image-2", name: "场景参考", url: "/assets/tokyo-desk-v3.jpg" };

test("素材详情可搜索、键盘打开大图，刷新失败保留内容，手机无溢出", async ({ page }, testInfo) => {
  let fail = false;
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}`, route => route.fulfill({ json: { data: library } }));
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}/assets`, route => route.fulfill(fail
    ? { status: 503, json: { error: { message: "素材暂时不可用" } } }
    : { json: { data: [image, second] } }));
  await page.goto(`/asset-libraries/${library.id}`);
  await expect(page.getByRole("heading", { name: library.name, exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索库内素材" }).fill("白底");
  await expect(page.locator(".reference-media-card")).toHaveCount(1);
  await page.getByRole("button", { name: "预览素材 商品白底图" }).focus();
  await page.keyboard.press("Enter");
  const preview = page.getByRole("dialog", { name: "商品白底图" });
  await expect(preview.getByRole("img", { name: "商品白底图" })).toHaveAttribute("src", image.url);
  await page.screenshot({ path: testInfo.outputPath("asset-preview.png") });
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole("button", { name: "预览素材 商品白底图" })).toBeFocused();
  await page.getByRole("searchbox", { name: "搜索库内素材" }).fill("");
  fail = true;
  await page.getByRole("button", { name: "刷新素材" }).click();
  await expect(page.getByRole("alert")).toContainText("素材暂时不可用");
  await expect(page.locator(".reference-media-card")).toHaveCount(2);
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("asset-detail-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("asset-detail-mobile.png") });
  await page.getByRole("button", { name: "返回素材库列表" }).click();
  await expect(page).toHaveURL(/asset-libraries$/);
});

test("素材上传等待完成，失败保留输入，编辑可清空描述，删除需确认", async ({ page }) => {
  let current = { ...library };
  let items = [image, second];
  let uploads = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}`, route => {
    if (route.request().method() === "PATCH") {
      const patch = route.request().postDataJSON();
      expect(patch).toEqual({ name: "商品参考", description: "" });
      current = { ...current, ...patch };
    }
    return route.fulfill({ json: { data: current } });
  });
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}/assets`, async route => {
    if (route.request().method() === "POST") {
      uploads++;
      expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
      expect(route.request().postDataBuffer()?.toString()).toContain("新图片");
      if (uploads === 1) { await gate; return route.fulfill({ status: 503, json: { error: { message: "上传失败，请重试" } } }); }
      return route.fulfill({ json: { data: image } });
    }
    return route.fulfill({ json: { data: items } });
  });
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}/assets/${image.id}`, route => {
    expect(route.request().method()).toBe("DELETE");
    items = [second];
    return route.fulfill({ json: { data: { id: image.id } } });
  });
  await page.goto(`/asset-libraries/${library.id}`);
  await page.getByRole("button", { name: "添加素材", exact: true }).click();
  const upload = page.getByRole("dialog", { name: "添加素材" });
  await upload.getByLabel("素材名称", { exact: true }).fill("新图片");
  await upload.getByLabel("图片文件", { exact: true }).setInputFiles({ name: "product.png", mimeType: "image/png", buffer: Buffer.from("image-fixture") });
  await upload.getByRole("button", { name: "上传", exact: true }).click();
  await expect(upload.getByRole("button", { name: "上传中…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(upload).toBeVisible();
  expect(uploads).toBe(1);
  release();
  await expect(upload.getByRole("alert")).toContainText("上传失败");
  await expect(upload.getByLabel("素材名称", { exact: true })).toHaveValue("新图片");
  await upload.getByRole("button", { name: "上传", exact: true }).click();
  await expect(upload).toHaveCount(0);
  await page.getByRole("button", { name: "编辑信息", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "编辑素材库" });
  await edit.getByLabel("名称", { exact: true }).fill("商品参考");
  await edit.getByLabel("描述", { exact: true }).fill("");
  await edit.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "商品参考", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除素材 商品白底图" }).click();
  const confirm = page.getByRole("dialog", { name: "确认删除" });
  await expect(confirm).toContainText("无法恢复");
  await confirm.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.locator(".reference-media-card")).toHaveCount(1);
});

test("文本详情搜索正文并显示全文，首次加载失败可重试", async ({ page }) => {
  const textLibrary = { ...library, assetType: "text" };
  const fullText = `无线鼠标参数\n${"支持多设备切换，适合办公场景。".repeat(16)}\n末尾特别说明`;
  let fail = true;
  let textUploads = 0;
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}`, route => route.fulfill(fail
    ? { status: 503, json: { error: { message: "加载素材失败" } } }
    : { json: { data: textLibrary } }));
  await page.route(url => url.pathname === `/api/asset-libraries/${library.id}/assets`, route => {
    if (route.request().method() === "POST") {
      textUploads++;
      const body = route.request().postDataBuffer()?.toString();
      expect(body).toContain('name="content"');
      expect(body).toContain("新的商品卖点");
      expect(body).not.toContain('name="file"');
      return route.fulfill({ json: { data: { ...image, assetType: "text", content: "新的商品卖点" } } });
    }
    return route.fulfill({ json: { data: [{ ...image, assetType: "text", url: undefined, content: fullText }] } });
  });
  await page.goto(`/asset-libraries/${library.id}`);
  await expect(page.getByRole("alert")).toContainText("加载素材失败");
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索库内素材" }).fill("末尾特别说明");
  await expect(page.locator(".reference-media-card")).toHaveCount(1);
  await page.getByRole("button", { name: "预览素材 商品白底图" }).click();
  await expect(page.getByRole("dialog", { name: "商品白底图" })).toContainText("末尾特别说明");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "添加素材", exact: true }).click();
  const upload = page.getByRole("dialog", { name: "添加素材" });
  await upload.getByLabel("素材名称", { exact: true }).fill("新文案");
  await upload.getByLabel("文本内容", { exact: true }).fill("新的商品卖点");
  await upload.getByRole("button", { name: "上传", exact: true }).click();
  await expect(upload).toHaveCount(0);
  expect(textUploads).toBe(1);
});

test("切换素材库隔离提交状态，旧请求完成不会关闭新库的提交", async ({ page }) => {
  const otherLibrary = { ...library, id: "library-b", name: "第二个素材库", assetType: "text" };
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const secondGate = new Promise<void>(resolve => { releaseSecond = resolve; });
  let firstDone = false;
  for (const [lib, gate] of [[library, firstGate], [otherLibrary, secondGate]] as const) {
    await page.route(url => url.pathname === `/api/asset-libraries/${lib.id}`, route => route.fulfill({ json: { data: lib } }));
    await page.route(url => url.pathname === `/api/asset-libraries/${lib.id}/assets`, async route => {
      if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
      await gate;
      await route.fulfill({ json: { data: { ...image, libraryId: lib.id } } });
      if (lib.id === library.id) firstDone = true;
    });
  }
  await page.goto(`/asset-libraries/${library.id}`);
  await page.getByRole("button", { name: "添加素材", exact: true }).click();
  let upload = page.getByRole("dialog", { name: "添加素材" });
  await upload.getByLabel("素材名称", { exact: true }).fill("第一张图片");
  await upload.getByLabel("图片文件", { exact: true }).setInputFiles({ name: "product.png", mimeType: "image/png", buffer: Buffer.from("image-fixture") });
  await upload.getByRole("button", { name: "上传", exact: true }).click();
  await expect(upload.getByRole("button", { name: "上传中…" })).toBeDisabled();
  // Model an in-app route change that reuses the detail component.
  await page.evaluate(async id => {
    const modulePath = "/src/routes/router.tsx";
    const { router } = await import(modulePath);
    await router.navigate({ to: "/asset-libraries/$libraryId", params: { libraryId: id } });
  }, otherLibrary.id);
  await expect(page.getByRole("heading", { name: otherLibrary.name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加素材", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "添加素材", exact: true }).click();
  upload = page.getByRole("dialog", { name: "添加素材" });
  await upload.getByLabel("素材名称", { exact: true }).fill("第二份素材");
  await upload.getByLabel("文本内容", { exact: true }).fill("第二个库的文本");
  await upload.getByRole("button", { name: "上传", exact: true }).click();
  await expect(upload.getByRole("button", { name: "上传中…" })).toBeDisabled();
  releaseFirst();
  await expect.poll(() => firstDone).toBe(true);
  await expect(upload.getByRole("button", { name: "上传中…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(upload).toBeVisible();
  releaseSecond();
  await expect(upload).toHaveCount(0);
});

const productionLibrary = { id: "production", name: "项目成品库", description: "项目图片自动归档", archivedAt: null };
const productionAsset = (id: string, kind: string, module: string) => ({ id, kind, sourceKind: "upload", originalFilename: `${id}.jpg`, previewUrl: "/assets/gan65-product.jpg", mimeType: "image/jpeg", fileSize: 2048, width: 900, height: 1200, sourceSnapshot: {}, versions: kind === "generated" ? [{ id: `v-${id}`, productType: "hero", sourceSnapshot: { batchId: "batch-one", batchCreatedAt: now, configSnapshot: { selection: { module: { id: "kv", label: module, mode: "hero" } } } }, previewUrl: null, status: "published" }] : [] });
const product = { id: "product-one", name: "无线鼠标项目", libraryId: productionLibrary.id, projectId: "business-one", archivedAt: null, versions: [], assets: [productionAsset("source", "source", ""), productionAsset("hero", "generated", "首屏 KV")] };

async function mockProduction(page: Page, shouldFail: () => boolean) {
  await page.route(url => url.pathname === `/api/products/${product.id}`, route => route.fulfill(shouldFail()
    ? { status: 503, json: { error: { message: "成品图片加载失败" } } }
    : { json: { data: product } }));
  await page.route(url => url.pathname === `/api/product-libraries/${productionLibrary.id}`, route => route.fulfill(shouldFail()
    ? { status: 503, json: { error: { message: "成品库加载失败" } } }
    : { json: { data: productionLibrary } }));
  await page.route(url => url.pathname === `/api/product-libraries/${productionLibrary.id}/products`, route => route.fulfill({ json: { data: [product] } }));
}

test("项目成品详情搜索与批次模块组合，刷新失败仍可查看，手机布局", async ({ page }, testInfo) => {
  let fail = false;
  await mockProduction(page, () => fail);
  await page.goto(`/product-libraries/projects/${product.id}`);
  await page.getByRole("searchbox", { name: "搜索成品图片" }).fill("hero");
  await page.getByRole("combobox", { name: "项目批次" }).selectOption("batch-one");
  await expect(page.getByRole("link", { name: /hero.jpg/ })).toHaveAttribute("href", product.assets[1].previewUrl);
  await expect(page.getByRole("link", { name: /source.jpg/ })).toHaveCount(0);
  await page.getByRole("combobox", { name: "图片模块类型" }).selectOption("source");
  await expect(page.getByText("当前筛选没有图片", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重置筛选", exact: true }).click();
  await expect(page.locator(".project-asset-tile")).toHaveCount(2);
  fail = true;
  await page.getByRole("button", { name: "刷新成品图片" }).click();
  await expect(page.getByRole("alert")).toContainText("成品图片加载失败");
  await expect(page.locator(".project-asset-tile")).toHaveCount(2);
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("product-detail-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("product-detail-mobile.png") });
});

test("成品库详情首次加载失败显示重试，搜索项目后仍可打开业务项目", async ({ page }, testInfo) => {
  let fail = true;
  await mockProduction(page, () => fail);
  await page.goto(`/product-libraries/${productionLibrary.id}`);
  await expect(page.getByRole("alert")).toContainText("成品库加载失败");
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索归档项目" }).fill("不存在");
  await expect(page.getByText("没有匹配的项目档案", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索归档项目" }).fill("鼠标");
  await expect(page.locator(".project-archive")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("production-library-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("production-library-mobile.png") });
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await expect(page).toHaveURL(/projects\/business-one\?tab=base$/);
});

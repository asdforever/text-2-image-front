import { expect, test, type Page } from "playwright/test";

const now = "2026-10-14T00:00:00Z";
const source = { id: "source-one", kind: "source", state: "available", filename: "商品原图.jpg", mimeType: "image/jpeg", byteSize: 2048, width: 900, height: 1200, sha256: "a".repeat(64), sourceAssetId: null, generationSnapshotId: null, createdAt: now };
const white = { ...source, id: "white-one", kind: "white_background", filename: "透明图.png", sourceSnapshot: { background: "transparent" } };
const detail = { id: "workspace-demo", name: "商品图片设计项目", status: "active", archivedAt: null, createdAt: now, updatedAt: now, assets: [source, white], selections: { source: source.id } };

async function setup(page: Page) {
  await page.route(url => url.pathname === "/api/projects/workspace-demo", route => route.fulfill({ json: { data: detail } }));
  await page.route(url => /\/assets\/[^/]+\/preview$/.test(url.pathname), route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route(url => url.pathname === "/api/asset-libraries", route => route.fulfill({ json: { data: [] } }));
  await page.route(url => url.pathname.endsWith("/white-background-generations"), route => route.fulfill({ json: { data: [] } }));
}

test("白底图完整显示，手机卡片操作可见，素材弹窗支持 Escape 和焦点返回", async ({ page }, info) => {
  await setup(page);
  await page.goto("/projects/workspace-demo?tab=base");
  await expect(page.locator(".base-card")).toHaveCount(2);
  await expect(page.locator(".base-card-image.is-transparent")).toHaveCSS("background-image", /conic-gradient/);
  const contrast = await page.getByRole("button", { name: "上传原图", exact: true }).evaluate(element => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    const foreground = luminance(style.color); const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator(".base-card-image img").first()).toBeVisible();
  for (const card of await page.locator(".base-card-image").all()) {
    const img = card.locator("img");
    await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    const frame = await card.boundingBox(); const image = await img.boundingBox();
    expect(image!.height).toBeLessThanOrEqual(frame!.height + 1);
    expect(image!.width).toBeLessThanOrEqual(frame!.width + 1);
  }
  const trigger = page.getByRole("button", { name: "选择素材库", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "选择素材库" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.screenshot({ path: info.outputPath("base-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const actions = page.locator(".base-card-hover").first();
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toHaveCSS("opacity", "1");
  expect(await page.locator(".c-base-layout").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.locator(".workbench").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("base-mobile.png") });
});

test("生成确认保留背景选项，提交中锁定弹窗，失败可重新提交", async ({ page }) => {
  await setup(page);
  let posts = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => /\/assets\/[^/]+\/white-background-generations$/.test(url.pathname), async route => {
    posts++;
    expect(route.request().postDataJSON().background).toBe("transparent");
    await gate;
    return route.fulfill({ status: 503, json: { error: { message: "模型暂时不可用" } } });
  });
  await page.goto("/projects/workspace-demo?tab=base");
  await page.getByRole("button", { name: "生成白底图", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "生成商品图" });
  await dialog.getByRole("radio", { name: "透明图", exact: true }).check();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "生成白底图", exact: true }).click();
  await dialog.getByRole("radio", { name: "透明图", exact: true }).check();
  await dialog.getByRole("button", { name: "生成透明图", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "提交中…" })).toBeDisabled();
  const close = dialog.getByRole("button", { name: "关闭", exact: true });
  await close.focus(); await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); expect(posts).toBe(1);
  release();
  await expect(page.getByRole("status")).toContainText("模型暂时不可用");
  await expect(dialog.getByRole("radio", { name: "透明图", exact: true })).toBeChecked();
  await expect(dialog.getByRole("button", { name: "生成透明图", exact: true })).toBeEnabled();
});

test("项目反推手机布局保留参数编辑，模块名称和图片不会撑宽页面", async ({ page }, info) => {
  await setup(page);
  const plan = { id: "plan-one", name: "场景设计方案", projectId: detail.id, versionId: "version-one", reverseVersionId: "version-one", sourceAssetId: white.id, productFacts: {}, parameterBrief: "", outputSettings: {}, referenceCount: 1, revision: 1, createdAt: now, updatedAt: now, tasks: [{ id: "task-one", ordinal: 1, referenceImageId: "ref-one", referenceFilename: "参考图片名称".repeat(12), referencePreviewUrl: "/assets/gan65-product.jpg", referenceModuleId: "module-".repeat(20), title: "商品场景设计", structure: { goal: "办公场景", layout: "桌面与商品", informationHierarchy: "商品与参数", typography: "清晰标题", colorAndLighting: "自然侧光", adaptationNotes: "保留真实外观" }, promptDraft: "", status: "draft" }] };
  await page.route(url => url.pathname === "/api/reverse-projects", route => route.fulfill({ json: { data: [] } }));
  await page.route(url => url.pathname.startsWith("/api/") && url.pathname.includes("/reverse-execution"), route => route.fulfill({ json: { data: route.request().url().includes("/plans") ? [plan] : route.request().url().includes("/batches") ? [] : plan } }));
  await page.goto("/projects/workspace-demo?tab=reverse");
  await page.getByLabel("参数填写", { exact: true }).fill("续航：60天；重量：80克");
  await expect(page.getByRole("heading", { name: "商品场景设计", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("project-reverse-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("参数填写", { exact: true })).toHaveValue("续航：60天；重量：80克");
  for (const selector of [".project-reverse-workspace", ".project-reverse-card", ".workbench"]) {
    expect(await page.locator(selector).first().evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.locator(".project-reverse-card").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("project-reverse-mobile.png") });
});

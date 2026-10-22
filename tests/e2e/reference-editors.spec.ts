import { expect, test, type Page } from "playwright/test";

// Mount the production dialogs with deterministic sources; every API write is mocked.
async function openDialog(page: Page, mode: "image" | "regenerate" | "long") {
  const [editorModule, entryModule] = await Promise.all([
    page.request.get("/src/components/image-canvas/ImageEditorModal.tsx"),
    page.request.get("/src/main.tsx"),
  ]);
  const reactUrl = (await editorModule.text()).match(/"([^"\n]*\/deps\/react\.js\?[^"\n]*)"/)?.[1];
  const reactDomUrl = (await entryModule.text()).match(/"([^"\n]*\/deps\/react-dom_client\.js\?[^"\n]*)"/)?.[1];
  expect(reactUrl).toBeTruthy();
  expect(reactDomUrl).toBeTruthy();
  await page.route(url => url.pathname.startsWith("/api/"), route => route.fulfill({ status: 404, json: { error: { message: "未配置接口" } } }));
  await page.route("**/api/projects/editor/assets/*/preview", route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/image-editor/capabilities", route => route.fulfill({ json: { data: { capabilities: { promptEdit: true, addText: true, changeText: true, redraw: true, erase: true, cropResize: true } } } }));
  const session = { id: "session", projectId: "editor", sourceVersionId: "source", revision: 1, status: "draft", operations: [] as any[] };
  await page.route("**/api/image-editor/sessions?*", route => route.fulfill({ json: { data: [session] } }));
  await page.route("**/api/image-editor/sessions/session/operations", route => {
    const { operation, expectedRevision } = route.request().postDataJSON();
    expect(expectedRevision).toBe(session.revision);
    session.operations = [...session.operations.filter(item => item.operationId !== operation.operationId), operation];
    session.revision++;
    return route.fulfill({ json: { data: session } });
  });
  await page.route("**/api/projects/editor/long-images", route => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/projects/editor/style-harmonizations", route => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/projects/editor/module-plans/latest?*", route => route.fulfill({ status: 404, json: { error: { code: "MODULE_PLAN_NOT_FOUND" } } }));
  await page.route("**/reference-editor-fixture", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/suite-workbench.css"><link rel="stylesheet" href="/src/components/image-canvas/reference-editors.css?direct"></head><body><div id="fixture"></div><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script><script type="module">
    import React from ${JSON.stringify(reactUrl)};
    import ReactDOM from ${JSON.stringify(reactDomUrl)};
    import '/src/index.css'; import '/src/studio.css'; import '/src/components/image-canvas/canvas.css';
    import { ImageEditorModal } from '/src/components/image-canvas/ImageEditorModal.tsx';
    import { CanvasRegenerateDialog } from '/src/components/image-canvas/CanvasRegenerateDialog.tsx';
    import { LongImageComposer } from '/src/components/image-canvas/LongImageComposer.tsx';
    const source = { id:'source', kind:'generated', state:'available', filename:'商品主图.png', width:1000, height:1000 };
    const step = { id:'hero', kind:'hero', title:'场景主图', sourceAssetIds:['source'], outputAssetIds:['source'], outputVersionIds:[], sourceNodeIds:[], outputNodeIds:[], missingSource:false, finalPrompt:'保留商品外观', taskPrompt:'保留商品外观', constraints:{}, parameters:{} };
    const wb = { suite:{id:'editor',name:'编辑测试'},tasks:[],inputImages:[],batches:[],generationSteps:[],layout:null };
    const root = ReactDOM.createRoot(document.getElementById('fixture'));
    const close = () => root.unmount();
    const props = ${JSON.stringify(mode)} === 'image' ? {task:{id:'task',suiteId:'editor',title:'商品主图'},version:{id:'source',versionNumber:1,width:1000,height:1000,previewUrl:'/api/projects/editor/assets/source/preview'},onClose:close,onSubmit:async(spec)=>{const r=await fetch('/api/reference-editor-submit',{method:'POST',body:JSON.stringify(spec)});if(!r.ok)throw new Error('暂时无法提交，请重试');close();}}
      : ${JSON.stringify(mode)} === 'regenerate' ? {projectId:'editor',step,tracks:[],assets:[source],close,submitted:async()=>{}}
      : {projectId:'editor',assets:[source],workbench:wb,close,saved:async()=>{}};
    root.render(React.createElement(${JSON.stringify(mode)} === 'image' ? ImageEditorModal : ${JSON.stringify(mode)} === 'regenerate' ? CanvasRegenerateDialog : LongImageComposer,props));
  </script></body></html>` }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/reference-editor-fixture");
}

test("暗色图片编辑保留裁剪与描述，提交期间锁定关闭，失败可继续修改", async ({ page }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: undefined }); });
  await openDialog(page, "image");
  const dialog = page.getByRole("dialog", { name: "图片编辑器" });
  await expect(dialog).toHaveCSS("background-color", "rgb(20, 20, 20)");
  await dialog.getByRole("button", { name: "裁剪与尺寸 可用", exact: true }).click();
  await dialog.getByRole("combobox", { name: /^裁剪比例/ }).selectOption("4:3");
  await dialog.getByLabel("输出宽度").fill("800");
  await expect(dialog.getByLabel("输出高度")).toHaveValue("600");
  await dialog.getByRole("button", { name: "描述修改 可用", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "确认生成修改图", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await dialog.getByLabel("修改要求", { exact: true }).fill("背景换成木质桌面，保留商品轮廓");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let submitted: any;
  await page.route("**/api/reference-editor-submit", async route => { submitted = route.request().postDataJSON(); await pending; return route.fulfill({ status: 503 }); });
  await page.screenshot({ path: testInfo.outputPath("image-editor-desktop.png") });
  await dialog.getByRole("button", { name: "确认生成修改图", exact: true }).click();
  try {
    await expect(dialog.getByRole("button", { name: "关闭图片编辑器" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally { release(); }
  await expect(dialog.getByRole("alert")).toContainText("暂时无法提交");
  await expect(dialog.getByLabel("修改要求", { exact: true })).toHaveValue("背景换成木质桌面，保留商品轮廓");
  expect(submitted.operations.find((item: any) => item.type === "crop_resize").payload).toMatchObject({ width: 800, height: 600 });
  expect(submitted.operations.find((item: any) => item.type === "prompt_edit").operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("image-editor-mobile.png") });
});

test("暗色风格确认提交期间锁定关闭，失败保留提示词与重试幂等键", async ({ page }, testInfo) => {
  await openDialog(page, "long");
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await dialog.getByRole("button", { name: /添加 商品主图/ }).click();
  await dialog.getByLabel("统一第 1 张风格").check();
  await dialog.getByLabel("统一风格方式").selectOption("custom");
  await dialog.getByLabel("自写风格提示词").fill("暖色自然光，保留商品文字");
  await page.route("**/api/projects/editor/style-harmonizations/preview", route => route.fulfill({ json: { data: { finalPrompt: "暖色自然光，保留商品文字", assetIds: ["source"], mode: "custom", previewHash: "hash" } } }));
  await dialog.getByRole("button", { name: "预览风格统一任务" }).click();
  const confirm = page.getByRole("alertdialog", { name: "确认风格统一" });
  await expect(confirm).toHaveCSS("background-color", "rgb(23, 23, 23)");
  await expect(confirm).toContainText("暖色自然光，保留商品文字");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const keys: string[] = [];
  await page.route("**/api/projects/editor/style-harmonizations", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: [] } });
    keys.push(route.request().headers()["idempotency-key"]);
    await pending;
    return route.fulfill({ status: 503, json: { error: { message: "风格服务暂时不可用" } } });
  });
  await confirm.getByRole("button", { name: "确认生成风格候选" }).click();
  try {
    await expect(confirm.getByRole("button", { name: "返回调整" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeVisible();
  } finally { release(); }
  await expect(confirm.getByRole("alert")).toContainText("风格服务暂时不可用");
  await confirm.getByRole("button", { name: "确认生成风格候选" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
  await page.screenshot({ path: testInfo.outputPath("style-confirm-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await confirm.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("style-confirm-mobile.png") });
  await confirm.getByRole("button", { name: "返回调整" }).click();
  await expect(dialog.getByLabel("自写风格提示词")).toHaveValue("暖色自然光，保留商品文字");
});

test("暗色迭代对话框提交锁定，失败保留提示词且重试使用相同幂等键", async ({ page }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: undefined }); });
  await openDialog(page, "regenerate");
  const dialog = page.getByRole("dialog", { name: "迭代生成" });
  await expect(dialog).toHaveCSS("background-color", "rgb(20, 20, 20)");
  await dialog.getByLabel("本次任务提示词").fill("桌面自然光，保留商品全部细节");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const keys: string[] = [];
  await page.route("**/api/projects/editor/canvas/generations", async route => { keys.push(route.request().headers()["idempotency-key"]); await pending; return route.fulfill({ status: 503, json: { error: { message: "生成服务暂时不可用" } } }); });
  await dialog.getByRole("button", { name: "确认生成新版本" }).click();
  try { await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); await expect(dialog.getByRole("button", { name: "关闭迭代生成" })).toBeDisabled(); } finally { release(); }
  await expect(dialog.getByRole("alert")).toContainText("生成服务暂时不可用");
  await expect(dialog.getByLabel("本次任务提示词")).toHaveValue("桌面自然光，保留商品全部细节");
  await dialog.getByRole("button", { name: "确认生成新版本" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(keys[1]).toBe(keys[0]);
  await page.screenshot({ path: testInfo.outputPath("regenerate-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("regenerate-mobile.png") });
});

test("暗色长图设置失败保留排版，预览遵循输出尺寸，手机无溢出", async ({ page }, testInfo) => {
  await openDialog(page, "long");
  const dialog = page.getByRole("dialog", { name: "制作长图", exact: true });
  await expect(dialog).toHaveCSS("background-color", "rgb(20, 20, 20)");
  await dialog.getByRole("button", { name: /添加 商品主图/ }).click();
  await dialog.getByLabel("长图名称").fill("鼠标详情页");
  await dialog.getByLabel("输出宽度", { exact: true }).fill("800");
  await dialog.getByLabel("图片间距").fill("24");
  const requests: any[] = [];
  await page.route("**/api/projects/editor/long-images", route => { requests.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { error: { message: "长图保存暂时失败" } } }); });
  await dialog.getByRole("button", { name: "保存并归档" }).click();
  await expect(dialog.getByRole("alert")).toContainText("长图保存暂时失败");
  await expect(dialog.getByLabel("长图名称")).toHaveValue("鼠标详情页");
  expect(requests[0]).toMatchObject({ width: 800, gap: 24, title: "鼠标详情页" });
  await expect(dialog.locator("svg.lic-preview")).toHaveAttribute("viewBox", /^0 0 800 /);
  await page.screenshot({ path: testInfo.outputPath("long-image-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("long-image-mobile.png") });
  await dialog.locator("svg.lic-preview").scrollIntoViewIfNeeded();
  await expect(dialog.locator("svg.lic-preview")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("long-image-mobile-preview.png") });
});

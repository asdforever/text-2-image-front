import { expect, test, type Page } from "playwright/test";

const now = "2026-09-16T00:00:00Z";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/projects/proj-demo", route => route.fulfill({ json: { data: {
    id: "proj-demo", name: "画布测试项目", status: "active", assets: [], selections: {},
    createdAt: now, updatedAt: now,
  } } }));
});

async function openCoreEditor(page: Page) {
  const state = createWorkbenchState();
  state.session.operations = [];
  let submitted: any = null;
  let ocrCalls = 0;
  await page.route("**/api/projects/proj-demo/assets/*/preview", route => route.fulfill({ contentType:"image/svg+xml", body:'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#ccd9dd"/></svg>' }));
  await page.route("**/api/projects/proj-demo/assets", route => route.fulfill({json:{data:[{id:"asset-source",state:"available",kind:"generated",filename:"首屏详情.png",width:1024,height:1024}]}}));
  await page.route("**/api/suites/proj-demo/workbench", route => route.fulfill({json:{data:{...state.workbench,imageEditChildren:[]}}}));
  await page.route("**/api/suites/proj-demo/workbench/layout", route => route.fulfill({json:{data:{...route.request().postDataJSON(),layoutVersion:2}}}));
  await page.route("**/api/image-editor/capabilities", route => route.fulfill({json:{data:{capabilities:{promptEdit:true,addText:true,changeText:true,redraw:true,erase:true,cropResize:true,ocr:false}}}}));
  await page.route("**/api/image-editor/sessions?projectId=*", route => route.fulfill({json:{data:[state.session]}}));
  await page.route("**/api/image-editor/sessions/session-1/operations", async route => {
    const body = route.request().postDataJSON();
    expect(body.expectedRevision).toBe(state.session.revision);
    state.session.operations = [...state.session.operations.filter(item => item.operationId !== body.operation.operationId),body.operation];
    state.session.revision++;
    await route.fulfill({json:{data:state.session}});
  });
  await page.route("**/api/image-editor/sessions/session-1/submit", async route => { submitted = route.request().postDataJSON(); await route.fulfill({status:202,json:{data:{id:"edit-new",status:"queued"}}}); });
  await page.route("**/api/image-editor/sessions/session-1/ocr", route => {ocrCalls++;return route.abort();});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/suites/proj-demo/board");
  await page.locator(".ic-image-node").filter({has:page.getByRole("heading",{name:"首屏详情",exact:true})}).dispatchEvent("click");
  await page.getByRole("complementary",{name:"图片属性"}).getByRole("button",{name:"编辑图片"}).click();
  const editor = page.getByRole("dialog",{name:"图片编辑器"});
  await expect(editor.getByRole("button",{name:"添加文本 可用",exact:true})).toBeEnabled();
  return {editor,state,submitted:()=>submitted,ocrCalls:()=>ocrCalls};
}

test("描述修改发送当前图片和最终输入，保存恢复后可以与裁剪一起提交", async ({ page }, testInfo) => {
  const { editor, submitted } = await openCoreEditor(page);
  await editor.getByRole("button", { name: "描述修改 可用", exact: true }).click();
  await editor.getByRole("button", { name: "确认生成修改图", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("请填写修改要求");
  expect(submitted()).toBeNull();
  await editor.getByLabel("修改要求", { exact: true }).fill("背景改成木质桌面，保留商品与文字");
  await editor.getByRole("button", { name: "添加修改", exact: true }).click();
  await editor.getByRole("button", { name: "关闭图片编辑器", exact: true }).click();
  await page.getByRole("complementary", { name: "图片属性" }).getByRole("button", { name: "编辑图片" }).click();
  await editor.getByRole("button", { name: "描述修改 可用", exact: true }).click();
  await expect(editor.getByLabel("修改要求", { exact: true })).toHaveValue("背景改成木质桌面，保留商品与文字");
  await editor.getByRole("button", { name: "裁剪与尺寸 可用", exact: true }).click();
  await editor.getByLabel("输出宽度").fill("800");
  await editor.getByRole("button", { name: "描述修改 可用", exact: true }).click();
  await editor.getByLabel("修改要求", { exact: true }).fill("背景改成浅色木桌，自然光，保留商品与文字");
  await page.screenshot({ path: testInfo.outputPath("prompt-edit-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await editor.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await editor.getByRole("button", { name: "确认生成修改图", exact: true }).click();
  await expect.poll(() => submitted()?.promptSnapshot.operations.length).toBe(2);
  expect(submitted().configSnapshot.sourceVersionId).toBe("asset-source");
  expect(submitted().promptSnapshot.operations.find((op: any) => op.type === "prompt_edit").payload).toEqual({ schemaVersion: 2, prompt: "背景改成浅色木桌，自然光，保留商品与文字" });
  expect(submitted().promptSnapshot.operations.find((op: any) => op.type === "crop_resize").payload.width).toBe(800);
});

test("未接 OCR 也能框选改文字，确认生成先保存最后输入的内容", async ({page}, testInfo) => {
  const {editor,state,submitted,ocrCalls} = await openCoreEditor(page);
  await editor.getByRole("button",{name:"改文字 可用",exact:true}).click();
  await editor.getByLabel("原文字",{exact:true}).fill("旧标题");
  await editor.getByLabel("新文字",{exact:true}).fill("新品上市");
  await editor.getByLabel("替换要求").fill("保留原字体，改为深绿色");
  await expect(editor.getByText("当前使用手工框选。",{exact:false})).toBeVisible();
  expect(ocrCalls()).toBe(0);
  await page.screenshot({path:testInfo.outputPath("editor-core-desktop.png")});
  await editor.getByRole("button",{name:"确认生成修改图",exact:true}).click();
  await expect.poll(()=>submitted()?.promptSnapshot.operations[0]?.payload.newText).toBe("新品上市");
  expect((state.session.operations[0].payload as any).prompt).toBe("保留原字体，改为深绿色");
  expect(submitted().configSnapshot.sourceVersionId).toBe("asset-source");
});

test("裁剪按比例调整尺寸并以本地修改操作提交", async ({page},testInfo) => {
  const {editor,submitted} = await openCoreEditor(page);
  await editor.getByRole("button",{name:"裁剪与尺寸 可用",exact:true}).click();
  await editor.getByRole("combobox",{name:/^裁剪比例/}).selectOption("4:3");
  await editor.getByLabel("输出宽度").fill("800");
  await expect(editor.getByLabel("输出高度")).toHaveValue("600");
  await editor.getByRole("button",{name:"撤销",exact:true}).click();
  await expect(editor.getByLabel("输出宽度")).toHaveValue("1024");
  await editor.getByRole("button",{name:"重做",exact:true}).click();
  await expect(editor.getByLabel("输出宽度")).toHaveValue("800");
  await page.setViewportSize({width:390,height:844});
  expect(await editor.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath("editor-core-mobile.png")});
  await editor.getByRole("button",{name:"确认保存修改图",exact:true}).click();
  await expect.poll(()=>submitted()?.promptSnapshot.operations[0]?.type).toBe("crop_resize");
  expect(submitted().promptSnapshot.operations[0].payload).toMatchObject({schemaVersion:2,width:800,height:600,region:{x:0,y:.125,width:1,height:.75}});
});

test("局部重绘中移除内容，笔画可撤销且作为遮罩提交", async ({page}) => {
  const {editor,submitted} = await openCoreEditor(page);
  await editor.getByRole("button",{name:"局部重绘 可用",exact:true}).click();
  await editor.getByLabel("修改方式").selectOption("erase");
  const box = await editor.locator(".wb-editor-canvas img").boundingBox();
  await page.mouse.move(box!.x+box!.width*.3,box!.y+box!.height*.4);
  await page.mouse.down();
  await page.mouse.move(box!.x+box!.width*.6,box!.y+box!.height*.4,{steps:5});
  await page.mouse.up();
  await expect(editor.getByText("已记录 1 条选区笔画")).toBeVisible();
  await editor.getByRole("button",{name:"撤销",exact:true}).click();
  await expect(editor.getByText("已记录 0 条选区笔画")).toBeVisible();
  await editor.getByRole("button",{name:"重做",exact:true}).click();
  await editor.getByRole("button",{name:"隐藏选区",exact:true}).click();
  await expect(editor.getByRole("button",{name:"显示选区",exact:true})).toBeVisible();
  await editor.getByRole("button",{name:"确认生成修改图",exact:true}).click();
  await expect.poll(()=>submitted()?.promptSnapshot.operations[0]?.type).toBe("erase");
  expect(submitted().promptSnapshot.operations[0].payload.strokes[0].points.length).toBeGreaterThan(1);
});

test("加字自动排版，切换工具保留内容并与裁剪一起提交", async ({page}, testInfo) => {
  const {editor,submitted} = await openCoreEditor(page);
  await editor.getByRole("button",{name:"添加文本 可用",exact:true}).click();
  await editor.getByLabel("精确文字").fill("新品上市");
  await expect(editor.getByLabel("字号",{exact:true})).toHaveCount(0);
  await expect(editor.getByLabel("字体",{exact:true})).toHaveCount(0);
  await expect(editor.getByLabel("文字颜色",{exact:true})).toHaveCount(0);
  await expect(editor.getByLabel("描边宽度",{exact:true})).toHaveCount(0);
  await expect(editor.getByLabel("左侧位置 %")).not.toBeVisible();
  await editor.getByLabel("添加文字要求").fill("暖色手写标题，靠左排列");
  await page.screenshot({path:testInfo.outputPath("auto-text-desktop.png")});
  await editor.getByRole("button",{name:"裁剪与尺寸 可用",exact:true}).click();
  await editor.getByLabel("输出宽度").fill("800");
  await editor.getByRole("button",{name:"添加文本 可用",exact:true}).click();
  await expect(editor.getByLabel("精确文字")).toHaveValue("新品上市");
  await expect(editor.getByLabel("添加文字要求")).toHaveValue("暖色手写标题，靠左排列");
  await page.setViewportSize({width:390,height:844});
  expect(await editor.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath("auto-text-mobile.png")});
  await editor.getByRole("button",{name:"确认生成修改图",exact:true}).click();
  await expect.poll(()=>submitted()?.promptSnapshot.operations.length).toBe(2);
  const textPayload = submitted().promptSnapshot.operations.find((item:any)=>item.type==="add_text").payload;
  expect(textPayload).not.toHaveProperty("textStyle");
  expect(textPayload).toMatchObject({text:"新品上市",prompt:"暖色手写标题，靠左排列"});
  expect(submitted().promptSnapshot.operations.find((item:any)=>item.type==="crop_resize").payload.width).toBe(800);
});

test("拖动文字区域后新增文字框保留上一项，保存刷新后仍能继续编辑", async ({ page }) => {
  const { editor, state } = await openCoreEditor(page);
  await editor.getByRole("button", { name: "添加文本 可用", exact: true }).click();
  await editor.getByLabel("精确文字").fill("新品上市");
  const box = (await editor.locator(".wb-editor-canvas img").boundingBox())!;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .475);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .275, { steps: 8 });
  await page.mouse.up();
  await editor.getByRole("button", { name: "新建文字框", exact: true }).click();
  await expect(editor.getByRole("button", { name: "添加文本：新品上市", exact: true })).toBeVisible();
  await expect(editor.getByLabel("精确文字")).toHaveValue("");
  await editor.getByLabel("精确文字").fill("清新一整天");
  await editor.getByRole("button", { name: "添加文本：新品上市", exact: true }).click();
  await expect(editor.getByRole("button", { name: "添加文本：清新一整天", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "添加文本：清新一整天", exact: true }).click();
  await expect(editor.getByLabel("精确文字")).toHaveValue("清新一整天");
  await editor.getByRole("button", { name: "更新修改", exact: true }).click();
  await expect.poll(() => state.session.operations.length).toBe(2);
  const first = state.session.operations[0].payload as any;
  expect(first.region.x).toBeCloseTo(.1, 1);
  expect(first.region.y).toBeCloseTo(.2, 1);
  expect(first).not.toHaveProperty("textStyle");
  await editor.getByRole("button", { name: "关闭图片编辑器" }).click();
  await page.reload();
  await page.locator(".ic-image-node").filter({ has: page.getByRole("heading", { name: "首屏详情", exact: true }) }).dispatchEvent("click");
  await page.getByRole("complementary", { name: "图片属性" }).getByRole("button", { name: "编辑图片" }).click();
  await editor.getByRole("button", { name: "添加文本：新品上市", exact: true }).click();
  await expect(editor.getByLabel("精确文字")).toHaveValue("新品上市");
  await expect(editor.getByRole("button", { name: "添加文本：清新一整天", exact: true })).toBeVisible();
  await expect(editor.getByLabel("字号", { exact: true })).toHaveCount(0);
});

test("图片编辑会话刷新可恢复，并支持失败重试与终版选择", async ({ page }) => {
  const state = createWorkbenchState();
  const calls = { session: 0, retry: 0, select: 0, ordinaryRegenerate: 0 };
  await page.route("**/api/projects/proj-demo/assets/*/preview", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white"/></svg>' }));

  await page.route("**/api/suites/proj-demo/workbench", (route) => route.fulfill({ json: { data: state.workbench } }));
  await page.route("**/api/image-editor/capabilities", (route) => route.fulfill({ json: { data: { provider: { name: "fake", version: "1", capabilitiesVersion: "1" }, capabilities: { imageToImage: true, currentVersionInput: true, addText: true, changeText: true, redraw: true, erase: true, outpaint: true, ocr: true } } } }));
  await page.route("**/api/image-editor/sessions", async (route) => {
    calls.session += 1;
    expect(route.request().postDataJSON().sourceVersionId).toBe("asset-source");
    await route.fulfill({ json: { data: state.session } });
  });
  await page.route("**/api/image-editor/sessions?projectId=*", route => route.fulfill({json:{data:[]}}));
  await page.route("**/api/image-editor/attempts/edit-attempt-1/retry", async (route) => {
    calls.retry += 1;
    await route.fulfill({ status: 201, json: { data: { id: "edit-attempt-2", status: "queued" } } });
  });
  await page.route("**/api/image-editor/tasks/edit-task-1/versions/edit-v2/select", async (route) => {
    calls.select += 1;
    state.workbench.imageEditChildren[0].task.finalVersionId = "edit-v2";
    await route.fulfill({ json: { data: { id: "edit-v2", isFinal: true } } });
  });
  await page.route("**/api/suite-tasks/edit-task-1/generation", async (route) => {
    calls.ordinaryRegenerate += 1;
    await route.fulfill({ status: 409, json: { error: { message: "编辑子卡片不应调用普通任务生成接口" } } });
  });
  await page.route("**/api/suites/proj-demo/workbench/layout", (route) => route.fulfill({ json: { data: { id: "layout-1", suiteId: "proj-demo", layoutVersion: 2, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], groups: [], updatedAt: now } } }));

  await page.route("**/api/projects/proj-demo/assets", (route) => route.fulfill({ json: { data: [{ id: "asset-source", state: "available", kind: "generated", filename: "首屏详情.png", width: 1024, height: 1024 }] } }));
  await page.goto("/suites/proj-demo/board");
  await page.addStyleTag({ content: ".wb-canvas-panel,.wb-canvas{min-height:700px;height:700px!important}.wb-workspace{min-height:700px}" });
  const sourceTaskCard = page.locator(".ic-image-node").filter({ has: page.getByRole("heading", { name: "首屏详情", exact: true }) });
  await sourceTaskCard.dispatchEvent("click");
  await expect(page.locator(".ic-detail-title h2")).toHaveText("首屏详情");
  await page.getByRole("complementary", { name: "图片属性" }).getByRole("button", { name: "编辑图片" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "图片编辑器" })).toBeVisible();
  const editor = page.getByRole("dialog", { name: "图片编辑器" });
  await expect(editor.getByRole("button", { name: /描述修改/ })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: /^再次生成|^扩图|^消除笔/ })).toHaveCount(0);
  await expect(editor.getByLabel("修改要求", { exact: true })).toHaveCount(0);
  await expect(editor.getByText("需要修改提示词时，请返回前面的提示词节点修改并生成新版本。", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "添加文本 可用", exact: true }).click();
  await expect(editor.getByLabel("添加文字要求")).toHaveValue("醒目");
  await expect(page.getByText("添加文本：新品主视觉", { exact: true })).toBeVisible();
  await editor.getByLabel("精确文字").fill("夏日上新");
  await editor.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(editor.getByLabel("精确文字")).toHaveValue("新品主视觉");
  await editor.getByRole("button", { name: "重做", exact: true }).click();
  await expect(editor.getByLabel("精确文字")).toHaveValue("夏日上新");
  await editor.getByRole("button", { name: "查看原图", exact: true }).click();
  await expect(editor.getByText("原图对照中", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "返回编辑", exact: true }).click();
  expect(calls.ordinaryRegenerate).toBe(0);

  await page.getByRole("button", { name: "关闭图片编辑器" }).click();
  await page.reload();
  await page.addStyleTag({ content: ".wb-canvas-panel,.wb-canvas{min-height:700px;height:700px!important}.wb-workspace{min-height:700px}" });
  await page.locator(".ic-image-node").filter({ has: page.getByRole("heading", { name: "首屏详情", exact: true }) }).dispatchEvent("click");
  await page.getByRole("complementary", { name: "图片属性" }).getByRole("button", { name: "编辑图片" }).dispatchEvent("click");
  await expect(page.getByText("添加文本：新品主视觉", { exact: true })).toBeVisible();
  expect(calls.session).toBeGreaterThanOrEqual(2);
  expect(calls.ordinaryRegenerate).toBe(0);

  await page.getByRole("button", { name: "关闭图片编辑器" }).click();
  const editChildCard = page.locator(".ic-image-node").filter({ hasText: "详情页润色" }).first();
  await editChildCard.dispatchEvent("click");
  expect(calls.ordinaryRegenerate).toBe(0);
  await page.getByRole("button", { name: "再次生成", exact: true }).click();
  await page.getByRole("button", { name: "确认生成", exact: true }).click();
  await expect.poll(() => calls.retry).toBe(1);
  expect(calls.ordinaryRegenerate).toBe(0);
  await page.getByLabel("选择详情页润色版本").selectOption("edit-v2");
  await page.getByRole("button", { name: "设为终版" }).click();
  await expect.poll(() => calls.select).toBe(1);
  await expect(page.getByRole("status")).toContainText("已设为终版");
});

function createWorkbenchState() {
  const version = { id: "ver-1", taskId: "task-1", slotId: "slot-1", attemptId: "attempt-1", versionNumber: 1, objectKey: "", processObjectKeys: [], sha256: "a".repeat(64), width: 1024, height: 1024, mimeType: "image/png", promptSnapshot: { finalPrompt: "初始提示词" }, contextSnapshot: {}, isCurrent: true, isFinal: false, createdAt: now, previewUrl: "/api/projects/proj-demo/assets/asset-source/preview" };
  const task = { id: "task-1", suiteId: "proj-demo", planSnapshotId: "plan-1", planItemId: "item-1", ordinal: 1, imageType: "detail", title: "首屏详情", purpose: "展示核心卖点", promptDraft: "初始提示词", promptRevision: 1, sourceInputImageId: null, generationParams: { ratio: "1:1", size: "1K", quality: "medium", model: "gpt-image-2" }, status: "generated", archivedAt: null, createdAt: now, updatedAt: now, versions: [version], attempts: [], slots: [] };
  const editChild = { task: { id: "edit-task-1", sourceCardId: "task-1", sourceVersionId: "asset-source", summary: "详情页润色", status: "failed", currentVersionId: "edit-v1", finalVersionId: null, createdAt: now }, snapshot: { sourceVersionId: "asset-source", operations: [{ type: "re_edit" }] }, attempts: [{ id: "edit-attempt-1", attemptNo: 1, status: "failed", errorMessage: "生成失败" }], versions: [{ id: "edit-v1", attemptId: "edit-attempt-1", versionNumber: 1, width: 1024, height: 1024, mimeType: "image/png", previewUrl: "/fixture/edit-v1.png" }, { id: "edit-v2", attemptId: "edit-attempt-2", versionNumber: 2, width: 1024, height: 1024, mimeType: "image/png", previewUrl: "/fixture/edit-v2.png" }] };
  const workbench = { suite: { id: "proj-demo", name: "演示项目", status: "in_progress", createdAt: now, updatedAt: now, inputImages: [] }, inputImages: [], planSnapshot: { id: "plan-1", revisionNumber: 1, revisionKind: "human", templateVersionId: "template-1", dynamicInput: {}, humanInput: {}, chunks: [], inputImageIds: [], provider: { name: "fake", model: "fake", isFake: true }, items: [{ id: "item-1", ordinal: 1, imageType: "detail", title: "首屏详情", purpose: "展示核心卖点", prompt: "初始提示词" }], confirmationStatus: "confirmed", createdAt: now }, tasks: [task], batches: [], references: [], imageEditChildren: [editChild], layout: null };
  return { workbench, session: { id: "session-1", projectId: "proj-demo", sourceVersionId: "asset-source", sourceSnapshot: {}, operations: [{ operationId: "op-1", type: "add_text", summary: "添加文本：新品主视觉", sourceVersionId: "asset-source", payload: { text: "新品主视觉", prompt: "醒目" } }], revision: 1, status: "draft" } };
}

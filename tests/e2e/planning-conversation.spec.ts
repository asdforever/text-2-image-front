import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../../src/lib/generation-workspace";
import { modulePlanRequestInput, applyModulePlan } from "../../src/lib/planning-master";
import { materializeEffectiveSnapshot } from "../../src/lib/planning-conversation";
import type { ApiModulePlan } from "../../src/api/client";
import type { PlanningConversation } from "../../src/api/planning-conversations";
const catalog = createDefaultGenerationConfig();
async function installPlanningConversationApiStub(page: Page, mode: "hero" | "suite" = "suite", creationMode: "regular" | "professional" = "regular", planned = true, selected = true) {
  const normalize = mode === "hero" ? normalizeHeroConfig : normalizeSuiteConfig;
  const ids = mode === "hero" ? ["hero-kv", "hero-scene"] : ["suite-hero", "suite-detail"];
  let config = normalize({ creationMode, selectedAssetIds: selected ? ["source-1"] : [], selectedModuleIds: ids, planningBrief: "真实鼠标，已确认材质为塑料", styleId: catalog.styleCategories[0].styles[0].id, model: catalog.models[0].id });
  const plan: ApiModulePlan = { id: "plan-1", mode, planningContractVersion: creationMode === "regular" ? "regular-design-v1" : "commerce-design-v1", input: modulePlanRequestInput(mode, config), status: "completed", summary: "真实商品信息", warnings: [], createdAt: "2026-10-08", modules: ids.map((moduleId, i) => ({ moduleId, taskId: `task-${i + 1}`, taskTitle: `模块 ${i + 1}`, reason: `目标 ${i + 1}`, suggestedCopy: `批准标题 ${i + 1}`, moduleParameters: [{ key: "任意自定义", value: "保留此值" }], resultCount: 1, informationQuestion: "表达确认事实", productPresence: "detail", visualMechanism: "商品微距", compositionBrief: "商品靠左", designGuideIds: ["visual-hierarchy"] })) };
  if (planned) config = applyModulePlan(config, plan);
  await page.addInitScript(({ config, mode }) => { if (sessionStorage.getItem("conversation-seeded")) return; sessionStorage.setItem("conversation-seeded", "1"); localStorage.setItem("picagent-project-store", JSON.stringify({ state: { generationDrafts: { [`proj-demo:${mode}`]: { config, updatedAt: "2026-10-08" } } }, version: 0 })); }, { config, mode });
  const planningRequests: any[] = [];
  let planAvailable = planned;
  let session: PlanningConversation | null = null;
  const versions: any[] = [];
  const requests: { path: string; body: any; key?: string }[] = [];
  const keys = new Map<string, any>();
  let unknownOnce = false, failedOnce = false, conflictOnce = false, deferredOnce = false, answerOnce = false;
  let completion: PlanningConversation | null = null;
  let polls = 0;
  await page.route((url) => url.pathname.startsWith("/api/"), async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const body = req.method() === "POST" ? req.postDataJSON() : null;
    const ok = (data: unknown) => route.fulfill({ json: { data } });
    if (path.includes("/planning-conversations")) {
      if (body) requests.push({ path, body, key: req.headers()["idempotency-key"] });
      if (path.endsWith("/bootstrap")) { session = { id: "session-1", mode, creationMode, revision: 1, input: body.input, currentSnapshot: body.snapshot, appliedSnapshot: body.snapshot, currentPlanId: plan.id, currentVersionId: null, previewSnapshot: null, previewPlanId: null, activeTurnId: null, currentTurn: null, messages: [], diff: [] }; return ok(session); }
      if (!session) return ok(null);
      if (path.endsWith("/sync")) { session.currentSnapshot = body.snapshot; session.input = body.input; session.revision++; return ok(session); }
      if (path.endsWith("/turns")) {
        const key = req.headers()["idempotency-key"];
        if (keys.has(key)) return ok(keys.get(key));
        if (conflictOnce) { conflictOnce = false; return route.fulfill({ status: 409, json: { error: { code: "REVISION_CONFLICT", message: "另一窗口已更新规划，请检查当前方案" } } }); }
        const turn = { id: `turn-${keys.size + 1}`, status: failedOnce ? "failed" : answerOnce ? "completed" : body.text.includes("澄清") ? "clarification" : "preview", result: failedOnce ? { error: { code: "MODEL_FAILED", message: "模型暂不可用，请重试" } } : { input: body.input, kind: answerOnce ? "answer" : body.text.includes("澄清") ? "clarification" : "revision", message: answerOnce ? "可以只展示糖粒，但目前没有单独安排这一张。这里先讨论，方案保持原样。" : body.text.includes("澄清") ? "请确认使用哪个标题？" : "已仅修改第二张标题" } } as any;
        turn.requestKey = key;
        failedOnce = false; answerOnce = false;
        session.messages.push({ id: turn.id + "user", turnId: turn.id, role: "user", text: body.text }, { id: turn.id + "assistant", turnId: turn.id, role: "assistant", text: turn.result.message || turn.result.error.message }); session.currentTurn = turn; session.revision++;
        if (turn.status === "preview") { const preview = structuredClone(session.previewSnapshot ?? body.snapshot); preview.plan.id = "candidate"; preview.plan.input = body.input; preview.plan.modules[1].suggestedCopy = body.text.includes("再短") ? "短" : "短标题"; session.previewSnapshot = preview; session.previewPlanId = "candidate"; session.diff = [{ kind: "field", taskId: "task-2", field: "suggestedCopy", before: "批准标题 2", after: preview.plan.modules[1].suggestedCopy }]; }
        if (deferredOnce) { deferredOnce = false; completion = structuredClone(session); polls = 0; session.activeTurnId = turn.id; session.currentTurn = { ...turn, status: "generating" }; session.previewSnapshot = null; session.previewPlanId = null; }
        const result = structuredClone({ session, turn: session.currentTurn }); keys.set(key, result);
        if (unknownOnce) { unknownOnce = false; return route.fulfill({ status: 202, body: "{}", contentType: "application/json" }); } return ok(result);
      }
      if (path.endsWith("/apply") || path.endsWith("/restore")) { const snapshot = path.endsWith("/restore") ? structuredClone(versions.find(v => v.id === body.versionId).snapshot) : structuredClone(session.previewSnapshot); session.currentSnapshot = snapshot; session.appliedSnapshot = snapshot; session.currentPlanId = snapshot.plan.id; session.currentVersionId = `version-${versions.length + 1}`; versions.unshift({ id: session.currentVersionId, versionNumber: versions.length + 1, planId: session.currentPlanId, snapshot, createdAt: "2026-10-08T08:00:00Z" }); session.previewSnapshot = null; session.previewPlanId = null; session.diff = []; session.revision++; return ok(session); }
      if (path.endsWith("/discard")) { session.previewSnapshot = null; session.previewPlanId = null; session.diff = []; session.revision++; return ok(session); }
      if (path.endsWith("/versions")) return ok({ items: versions, nextCursor: null });
      if (path.endsWith("/messages")) return ok({ items: session.messages, nextCursor: null });
      if (completion && ++polls >= 2) { session = completion; session.activeTurnId = null; completion = null; }
      const query = new URL(req.url()).searchParams;
      return ok(query.get("mode") === mode && query.get("creationMode") === creationMode ? session : null);
    }
    if (path.includes("/module-plans")) { if (req.method() === "POST") { planAvailable = true; plan.input = body; planningRequests.push(body); } return ok(planAvailable ? plan : null); }
    if (path === "/api/generation-config/resolve") return ok({ configVersion: 1, contentSha256: "a".repeat(64), config: catalog, runtimeModules: { version: "runtime-modules-v1", contentSha256: "c".repeat(64), heroModules: catalog.heroModules, suiteModules: catalog.suiteModules } });
    if (path === "/api/projects/proj-demo") return ok({ id: "proj-demo", name: "规划对话测试", status: "active", archivedAt: null, selections: {}, createdAt: "2026-10-08", updatedAt: "2026-10-08", assets: [{ id: "source-1", kind: "source", state: "available", filename: "鼠标.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-10-08" }] });
    if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    return route.fulfill({ status: 404, json: { error: { message: "尚无记录" } } });
  });
  return { plan, requests, planningRequests, answer: () => { answerOnce = true; }, deferred: () => { deferredOnce = true; }, unknown: () => { unknownOnce = true; }, fail: () => { failedOnce = true; }, conflict: () => { conflictOnce = true; } };
}
const openDialog = async (page: Page) => { await page.getByRole("button", { name: "打开规划大师" }).click(); await expect(page.getByRole("dialog")).toBeVisible(); };
const send = async (page: Page, text: string) => { await page.getByLabel("规划对话", { exact: true }).fill(text); await page.getByRole("button", { name: "发送", exact: true }).click(); };
for (const mode of ["hero", "suite"] as const) for (const creation of ["regular", "professional"] as const) {
  test(`${mode}/${creation}: Enter sends, Shift+Enter and IME confirmation do not send`, async ({ page }) => {
    const stub = await installPlanningConversationApiStub(page, mode, creation);
    await page.goto(`/projects/proj-demo?tab=${mode}`); await openDialog(page);
    const input = page.getByLabel("规划对话", { exact: true });
    await input.fill("为什么这样规划？"); await input.press("Shift+Enter");
    await expect(input).toHaveValue("为什么这样规划？\n");
    expect(stub.requests.filter(r => r.path.endsWith("/turns"))).toHaveLength(0);
    await input.evaluate(el => {
      el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }));
      el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }));
    });
    expect(stub.requests.filter(r => r.path.endsWith("/turns"))).toHaveLength(0);
    stub.answer(); await input.press("Enter");
    await expect(page.getByRole("log")).toContainText("这里先讨论，方案保持原样");
    expect(stub.requests.filter(r => r.path.endsWith("/turns"))).toHaveLength(1);
    await expect(input).toHaveValue("");
  });
}
test("sending shows the message immediately before a delayed acknowledgement, without duplicates", async ({ page }) => {
  const stub = await installPlanningConversationApiStub(page);
  await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/planning-conversations/session-1/turns", async route => { await gate; await route.fallback(); });
  const input = page.getByLabel("规划对话", { exact: true });
  await input.fill("为什么第二张这样安排？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  try {
    await expect(page.getByRole("log")).toContainText("为什么第二张这样安排？", { timeout: 800 });
    await expect(input).toHaveValue("");
    await expect(page.getByRole("status").filter({ hasText: "正在发送" })).toBeVisible();
    await expect(page.getByRole("button", { name: "发送中…", exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(page.getByRole("log")).toContainText("已仅修改第二张标题");
  await expect(page.getByRole("log").getByText("为什么第二张这样安排？", { exact: true })).toHaveCount(1);
  expect(stub.requests.filter(r => r.path.endsWith("/turns"))).toHaveLength(1);
});
test("sending latest requirements does not wait for a redundant sync and a rejected request restores input", async ({ page }) => {
  const stub = await installPlanningConversationApiStub(page);
  await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page);
  await page.getByLabel("商品信息与规划需求", { exact: true }).fill("真实商品；新增需求：只保留已确认的卖点");
  const before = stub.requests.length;
  await send(page, "按最新需求调整第二张");
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
  const submission = stub.requests.slice(before);
  expect(submission[0].path).toMatch(/\/turns$/);
  expect(submission[0].body.input.brief).toContain("新增需求");
  stub.conflict(); await send(page, "这条请求请保留");
  await expect(page.getByRole("alert")).toContainText("另一窗口已更新");
  await expect(page.getByLabel("规划对话", { exact: true })).toHaveValue("这条请求请保留");
  await expect(page.getByRole("log").getByText("这条请求请保留", { exact: true })).toHaveCount(0);
});
for (const mode of ["hero", "suite"] as const) for (const creation of ["regular", "professional"] as const) {
  test(`${mode}/${creation}: questions answer without edits and preserve pending preview`, async ({ page }) => {
    const stub = await installPlanningConversationApiStub(page, mode, creation);
    await page.goto(`/projects/proj-demo?tab=${mode}`); await openDialog(page);
    const readDraft = () => page.evaluate(mode => JSON.parse(localStorage.getItem("picagent-project-store")!).state.generationDrafts[`proj-demo:${mode}`].config, mode);
    const before = await readDraft();
    stub.answer(); await send(page, "这里面应该有不展示商品整体，只展示糖的那种吧");
    await expect(page.getByRole("log")).toContainText("这里先讨论，方案保持原样");
    await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "应用修改", exact: true })).toHaveCount(0);
    expect(await readDraft()).toEqual(before);
    await send(page, "请把第二张标题缩短");
    await expect(page.locator(".planning-diff ins")).toHaveText("短标题");
    stub.answer(); await send(page, "为什么你建议这样安排？");
    await expect(page.getByRole("log").getByText(/这里先讨论，方案保持原样/)).toHaveCount(2);
    await expect(page.locator(".planning-diff ins")).toHaveText("短标题");
    expect(await readDraft()).toEqual(before);
    await page.keyboard.press("Escape"); await page.reload(); await openDialog(page);
    await expect(page.getByRole("log")).toContainText("为什么你建议这样安排？");
    await page.getByRole("button", { name: "应用修改", exact: true }).click();
    await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
    expect((await readDraft()).planningAppliedVersionId).toBe("version-1");
  });
}
for (const mode of ["hero", "suite"] as const) {
  test(`${mode}: mouse wheel over either column scrolls the whole page`, async ({ page }) => {
    await installPlanningConversationApiStub(page, mode, "regular");
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await page.getByRole("button", { name: "打开规划大师", exact: true }).waitFor();
    const scroller = page.locator(".workbench");
    for (const selector of [".generation-config-scroll", ".generation-result-body"]) {
      const panel = page.locator(selector);
      await expect(panel).toHaveCSS("overflow-y", "visible");
      await scroller.evaluate(el => { el.scrollTop = 0; });
      await panel.hover({ position: { x: 20, y: 20 } });
      await page.mouse.wheel(0, 500);
      await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      expect(await panel.evaluate(el => el.scrollTop)).toBe(0);
    }
    await page.locator(".generation-config-footer").scrollIntoViewIfNeeded();
    await expect(page.locator(".generation-config-footer")).toBeInViewport();
    expect(await page.locator(".generation-config-scroll").evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });
}
for (const mode of ["hero", "suite"] as const) for (const creation of ["regular", "professional"] as const) {
  test(`${mode}/${creation}: close, refresh and apply preserve preview and arbitrary parameters`, async ({ page }, testInfo) => {
    const stub = await installPlanningConversationApiStub(page, mode, creation);
    await page.setViewportSize({ width: 1500, height: 1000 }); await page.goto(`/projects/proj-demo?tab=${mode}`);
    await openDialog(page); await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
    await send(page, "仅缩短第二张标题，其余保持"); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
    if (mode === "suite" && creation === "regular") await page.screenshot({ path: testInfo.outputPath("planning-dialog-desktop.png") });
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible(); await expect(page.getByRole("button", { name: "打开规划大师" })).toBeFocused();
    await openDialog(page); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
    await page.reload(); await openDialog(page); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "应用修改", exact: true }).click(); await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
    const draft = await page.evaluate(mode => JSON.parse(localStorage.getItem("picagent-project-store")!).state.generationDrafts[`proj-demo:${mode}`].config, mode);
    expect(draft.planningAppliedVersionId).toBe("version-1"); expect(draft.moduleParameters["task-2"]).toEqual([{ key: "任意自定义", value: "保留此值" }]);
    expect(stub.requests.filter(r => r.path.endsWith("/turns"))).toHaveLength(1);
    await page.keyboard.press("Escape"); await page.reload(); await openDialog(page); await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); expect(await page.getByRole("dialog").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    if (mode === "suite" && creation === "regular") await page.screenshot({ path: testInfo.outputPath("planning-dialog-mobile.png") });
  });
}
for (const mode of ["hero", "suite"] as const) for (const creation of ["regular", "professional"] as const) {
  test(`${mode}/${creation}: product information is edited in the dialog and persists before initial planning`, async ({ page }) => {
    const stub = await installPlanningConversationApiStub(page, mode, creation, false);
    await page.goto(`/projects/proj-demo?tab=${mode}`);
    await expect(page.locator(".generation-config .generation-section-title").filter({ hasText: /参数填写|商品资料/ })).toHaveCount(0);
    await openDialog(page);
    await page.getByLabel("商品信息与规划需求", { exact: true }).fill("真实商品，新确认颜色：银色");
    await page.keyboard.press("Escape"); await page.reload(); await openDialog(page);
    await expect(page.getByLabel("商品信息与规划需求", { exact: true })).toHaveValue("真实商品，新确认颜色：银色");
    expect(stub.requests).toHaveLength(0);
    await page.getByRole("button", { name: "初始规划", exact: true }).click();
    await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
    expect(stub.requests.find(r => r.path.endsWith("/bootstrap"))!.body.input.brief).toBe("真实商品，新确认颜色：银色");
    await expect(page.getByLabel("商品信息与规划需求", { exact: true })).toBeEditable();
  });
}
for (const mode of ["hero", "suite"] as const) for (const creation of ["regular", "professional"] as const) {
  test(`${mode}/${creation}: missing product selection explains the disabled button and can be completed in the dialog`, async ({ page }) => {
    const stub = await installPlanningConversationApiStub(page, mode, creation, false, false);
    await page.goto(`/projects/proj-demo?tab=${mode}`); await openDialog(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("请先选择至少一张产品图，再开始规划。", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "初始规划", exact: true })).toBeDisabled();
    await dialog.getByLabel("商品信息与规划需求", { exact: true }).fill("商品：真实鼠标。需求：面向办公人群，突出握持细节，整套简洁，保留真实外观。");
    await dialog.getByRole("button", { name: "选择产品素材", exact: true }).click();
    await dialog.getByRole("button", { name: "鼠标.jpg 可用", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "初始规划", exact: true })).toBeEnabled();
    await expect(dialog.getByText("请先选择至少一张产品图，再开始规划。", { exact: true })).toHaveCount(0);
    expect(stub.planningRequests).toHaveLength(0);
    await dialog.getByRole("button", { name: "初始规划", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
    expect(stub.planningRequests).toHaveLength(1);
    expect(stub.planningRequests[0].sourceAssetIds).toEqual(["source-1"]);
    expect(stub.planningRequests[0].brief).toContain("需求：面向办公人群");
  });
}
test("unknown response replays the same request, clarification and conflict stay visible", async ({ page }) => {
  const stub = await installPlanningConversationApiStub(page); await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page);
  stub.unknown(); await send(page, "只改第二张"); await expect(page.getByRole("button", { name: "重新读取同一请求" })).toBeVisible(); await page.reload(); await openDialog(page);
  await expect(page.getByRole("log").getByText("只改第二张", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "重新读取同一请求" }).click(); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
  const calls = stub.requests.filter(r => r.path.endsWith("/turns")); expect(calls[0].key).toBe(calls[1].key); expect(calls[0].body).toEqual(calls[1].body);
  await page.getByRole("button", { name: "放弃预览" }).click(); await send(page, "澄清使用标题"); await expect(page.getByRole("log")).toContainText("请确认使用哪个标题");
  stub.conflict(); await send(page, "用短标题"); await expect(page.getByRole("alert")).toContainText("另一窗口已更新");
  stub.fail(); await send(page, "重试"); await expect(page.getByRole("alert")).toContainText("模型暂不可用");
});
test("multiple previews and version restore preserve cumulative state", async ({ page }) => {
  await installPlanningConversationApiStub(page); await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page);
  await send(page, "只改第二张"); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible(); await send(page, "再短一点"); await expect(page.locator(".planning-diff ins")).toHaveText("短");
  await page.getByRole("button", { name: "应用修改", exact: true }).click(); await send(page, "仅缩短第二张标题"); await page.getByRole("button", { name: "应用修改", exact: true }).click();
  await page.getByRole("button", { name: "版本历史" }).click(); await page.getByRole("button", { name: "恢复版本 1", exact: true }).click(); await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
});

test("manual edits use latest parameters and explicit copy permission, then input changes mark preview stale", async ({ page }) => {
  const stub = await installPlanningConversationApiStub(page); await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page);
  await send(page, "只改第二张"); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
  const card = page.locator(".module-task-card").first(); await card.getByRole("button", { name: "编辑第 1 张任务", exact: true }).click();
  await card.getByLabel("内容目标", { exact: true }).fill("最新人工目标"); await card.getByLabel("批准文案", { exact: true }).fill("人工批准文案");
  await card.getByLabel("允许规划大师拟写本图文案").check(); await card.getByLabel("视觉要求（选填）").fill("左侧留白");
  await card.getByLabel("参数名", { exact: true }).fill("任意新参数名"); await card.getByRole("textbox", { name: "参数值", exact: true }).fill("人工新值");
  await openDialog(page); await send(page, "其余保持"); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
  const body = stub.requests.filter(r => r.path.endsWith("/turns")).at(-1)!.body;
  expect(body.snapshot.plan.modules[0].reason).toBe("最新人工目标"); expect(body.snapshot.plan.modules[0].suggestedCopy).toBe("人工批准文案");
  expect(body.snapshot.parameterOverrides["task-1"]).toEqual([{ key: "任意新参数名", value: "人工新值" }]);
  expect(body.snapshot.regularOptions["task-1"]).toEqual({ copyPolicy: "flexible", visualRequirements: "左侧留白" });
  await page.getByLabel("商品信息与规划需求", { exact: true }).fill("更新的商品资料");
  await expect(page.getByText("当前资料已变化，请发送新的修改意见更新预览。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "应用修改", exact: true })).toBeDisabled();
});
test("persisted generating turn polls after closing and refreshing, keyboard focus stays in dialog", async ({ page }) => {
  const stub = await installPlanningConversationApiStub(page); await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page); stub.deferred(); await send(page, "只改第二张");
  await expect(page.getByText("正在按当前资料和规则规划…可以关闭窗口，稍后继续查看。", { exact: true })).toBeVisible(); await page.keyboard.press("Escape"); await page.reload(); await openDialog(page);
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "应用修改", exact: true }).focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  expect(stub.requests.filter(r => r.path.endsWith("/turns"))).toHaveLength(1);
});

test("switching creation scopes does not show or apply another scope preview", async ({ page }) => {
  await installPlanningConversationApiStub(page); await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page); await send(page, "只改第二张");
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "专业版", exact: true }).click(); await openDialog(page);
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "应用修改", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "常规版", exact: true }).click(); await openDialog(page);
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
});

test("both established creation sessions resume feedback with their own plan and manual parameters", async ({ page }) => {
  const regular = await installPlanningConversationApiStub(page);
  let professionalPlan = { ...structuredClone(regular.plan), id: "pro-plan", planningContractVersion: "commerce-design-v1" } as ApiModulePlan;
  let pro: PlanningConversation | null = null;
  const proFeedback: any[] = [];
  await page.route("**/api/projects/proj-demo/module-plans**", async route => {
    const request = route.request();
    if (request.method() === "POST") { professionalPlan.input = request.postDataJSON(); return route.fulfill({ json: { data: professionalPlan } }); }
    if (new URL(request.url()).pathname.endsWith("/pro-plan")) return route.fulfill({ json: { data: professionalPlan } });
    return route.fallback();
  });
  await page.route("**/api/projects/proj-demo/planning-conversations**", async route => {
    const request = route.request(), url = new URL(request.url()), body = request.method() === "POST" ? request.postDataJSON() : null;
    if (!(url.searchParams.get("creationMode") === "professional" || body?.creationMode === "professional" || url.pathname.includes("/pro-session/"))) return route.fallback();
    const ok = (data: unknown) => route.fulfill({ json: { data } });
    if (url.pathname.endsWith("/bootstrap")) { pro = { id: "pro-session", mode: "suite", creationMode: "professional", input: body.input, revision: 1, currentSnapshot: body.snapshot, appliedSnapshot: body.snapshot, currentPlanId: professionalPlan.id, currentVersionId: null, previewPlanId: null, previewSnapshot: null, activeTurnId: null, currentTurn: null, messages: [], diff: [] }; return ok(pro); }
    if (!pro) return ok(null);
    if (url.pathname.endsWith("/sync")) { pro.currentSnapshot = body.snapshot; pro.input = body.input; pro.revision++; return ok(pro); }
    if (url.pathname.endsWith("/turns")) { proFeedback.push(body); pro.currentSnapshot = body.snapshot; pro.previewSnapshot = structuredClone(body.snapshot); pro.previewPlanId = "pro-preview"; pro.currentTurn = { id: "pro-turn", status: "preview", result: { input: body.input, message: "专业规划已更新" } }; pro.messages = [{ id: "pro-message", turnId: "pro-turn", role: "assistant", text: "专业规划已更新" }]; pro.revision++; return ok({ session: pro, turn: pro.currentTurn }); }
    return ok(pro);
  });
  await page.goto("/projects/proj-demo?tab=suite"); await openDialog(page); await send(page, "常规只改第二张"); await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
  const card = page.locator(".module-task-card").first(); await card.getByRole("button", { name: "编辑第 1 张任务", exact: true }).click(); await card.getByRole("textbox", { name: "参数值", exact: true }).fill("常规独立手改");
  await page.getByRole("button", { name: "专业版", exact: true }).click(); await openDialog(page); await page.getByRole("button", { name: "初始规划", exact: true }).click(); await expect(page.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
  await send(page, "专业反馈"); await expect(page.getByRole("log")).toContainText("专业规划已更新"); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "常规版", exact: true }).click(); await openDialog(page); await send(page, "继续常规反馈"); await expect(page.getByRole("log")).toContainText("已仅修改第二张标题");
  const body = regular.requests.filter(r => r.path.endsWith("/turns")).at(-1)!.body; expect(body.snapshot.plan.planningContractVersion).toBe("regular-design-v1"); expect(body.snapshot.plan.id).toBe("plan-1"); expect(body.snapshot.parameterOverrides["task-1"][0].value).toBe("常规独立手改");
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "专业版", exact: true }).click(); await openDialog(page); await send(page, "继续专业反馈");
  await expect.poll(() => proFeedback.length).toBe(2); expect(proFeedback[1].snapshot.plan.id).toBe("pro-plan"); expect(proFeedback[1].snapshot.plan.planningContractVersion).toBe("commerce-design-v1");
  await page.reload(); await openDialog(page); await send(page, "刷新后专业反馈"); await expect.poll(() => proFeedback.length).toBe(3);
});

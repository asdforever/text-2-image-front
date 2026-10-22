import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";
import { normalizeSuiteConfig } from "../../src/lib/generation-workspace";
import { applyModulePlan, modulePlanRequestInput } from "../../src/lib/planning-master";
import type { ApiModulePlan } from "../../src/api/client";
import type { PlanningConversation, ConversationVersion } from "../../src/api/planning-conversations";

async function installPlanner(page: Page, options: { planned?: boolean; failInitial?: boolean } = {}) {
  const planned = options.planned ?? true;
  const catalog = createDefaultGenerationConfig();
  let config = normalizeSuiteConfig({ creationMode: "regular", selectedAssetIds: ["source-1"], selectedModuleIds: ["suite-hero", "suite-detail"], planningBrief: "办公鼠标，塑料材质，突出握持舒适和真实细节。", styleId: catalog.styleCategories[0].styles[0].id, model: catalog.models[0].id });
  const plan: ApiModulePlan = { id: "reference-plan", mode: "suite", planningContractVersion: "regular-design-v1", input: modulePlanRequestInput("suite", config), status: "completed", summary: "先展示商品全貌，再说明握持与材质细节。", warnings: [], createdAt: "2026-10-14", modules: ["suite-hero", "suite-detail"].map((moduleId, index) => ({ moduleId, taskId: `task-${index + 1}`, taskTitle: index ? "握持与细节" : "商品全貌", reason: index ? "展示真实材质与握持细节" : "清晰介绍产品", suggestedCopy: index ? "握持舒适，细节清晰" : "每天使用的舒适鼠标", moduleParameters: [{ key: "材质", value: "塑料" }], resultCount: 1, informationQuestion: "表达已确认的商品信息", productPresence: "detail", visualMechanism: "商品近景", compositionBrief: "商品靠左，右侧留白", designGuideIds: ["visual-hierarchy"] })) };
  if (planned) config = applyModulePlan(config, plan);
  await page.addInitScript(config => localStorage.setItem("picagent-project-store", JSON.stringify({ state: { generationDrafts: { "reference-planner:suite": { config, updatedAt: "2026-10-14" } } }, version: 0 })), config);
  let session: PlanningConversation | null = null;
  const versions: ConversationVersion[] = [];
  let gate: Promise<void> | undefined;
  let release: (() => void) | undefined;
  let rejectNext = false;
  let planAvailable = planned;
  let rejectInitial = options.failInitial ?? false;
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    const ok = (data: unknown) => route.fulfill({ json: { data } });
    if (path.includes("/planning-conversations")) {
      if (path.endsWith("/bootstrap")) {
        session = { id: "reference-session", mode: "suite", creationMode: "regular", revision: 1, input: body.input, currentSnapshot: body.snapshot, appliedSnapshot: body.snapshot, currentPlanId: plan.id, currentVersionId: null, previewSnapshot: null, previewPlanId: null, activeTurnId: null, currentTurn: null, messages: [], diff: [] };
        return ok(session);
      }
      if (!session) return ok(null);
      if (path.endsWith("/sync")) { session.currentSnapshot = body.snapshot; session.input = body.input; session.revision++; }
      if (path.endsWith("/turns")) {
        if (gate) { await gate; gate = undefined; }
        if (rejectNext) { rejectNext = false; return route.fulfill({ status: 409, json: { error: { code: "REVISION_CONFLICT", message: "当前方案已更新，请检查后重试" } } }); }
        const turn = { id: `turn-${session.revision}`, status: "preview" as const, result: { input: body.input, kind: "revision" as const, message: "已缩短第二张文案，请确认修改。" } };
        session.previewSnapshot = structuredClone(body.snapshot);
        session.previewSnapshot!.plan.id = "reference-candidate";
        session.previewSnapshot!.plan.input = structuredClone(body.input);
        session.previewSnapshot!.plan.modules[1].suggestedCopy = "舒适握持";
        session.previewPlanId = "reference-candidate";
        session.currentTurn = turn;
        session.messages.push({ id: `${turn.id}-user`, turnId: turn.id, role: "user", text: body.text }, { id: `${turn.id}-assistant`, turnId: turn.id, role: "assistant", text: turn.result.message });
        session.diff = [{ kind: "field", taskId: "task-2", field: "suggestedCopy", before: "握持舒适，细节清晰", after: "舒适握持" }];
        session.revision++;
        return ok({ session, turn });
      }
      if (path.endsWith("/apply")) {
        session.currentSnapshot = structuredClone(session.previewSnapshot!);
        session.appliedSnapshot = session.currentSnapshot;
        session.currentPlanId = session.currentSnapshot.plan.id;
        session.currentVersionId = "reference-version";
        versions.push({ id: "reference-version", versionNumber: 1, planId: session.currentPlanId, snapshot: session.currentSnapshot, createdAt: "2026-10-14T08:00:00Z" });
        session.previewSnapshot = null; session.previewPlanId = null; session.diff = []; session.revision++;
      }
      if (path.endsWith("/discard")) { session.previewSnapshot = null; session.previewPlanId = null; session.diff = []; session.revision++; }
      if (path.endsWith("/versions")) return ok({ items: versions, nextCursor: null });
      if (path.endsWith("/messages")) return ok({ items: session.messages, nextCursor: null });
      return ok(session);
    }
    if (path.includes("/module-plans")) {
      if (request.method() === "POST") {
        if (rejectInitial) { rejectInitial = false; return route.fulfill({ status: 502, json: { error: { code: "MODULE_PLANNER_INVALID_RESPONSE", message: "内容规划返回格式无效，请重新规划" } } }); }
        planAvailable = true;
        plan.input = body;
      }
      return ok(planAvailable ? plan : null);
    }
    if (path === "/api/generation-config/resolve") return ok({ configVersion: 1, config: catalog, runtimeModules: { version: "runtime-modules-v1", heroModules: catalog.heroModules, suiteModules: catalog.suiteModules } });
    if (path === "/api/projects/reference-planner") return ok({ id: "reference-planner", name: "办公鼠标 · 商品图片", status: "active", archivedAt: null, selections: {}, createdAt: "2026-10-14", updatedAt: "2026-10-14", assets: [{ id: "source-1", kind: "source", state: "available", filename: "鼠标.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: "2026-10-14" }] });
    if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
  });
  await page.goto("/projects/reference-planner?tab=suite");
  await page.getByRole("button", { name: "打开规划大师" }).click();
  await expect(page.getByRole("dialog", { name: "规划大师" })).toBeVisible();
  await expect(page.getByLabel("规划对话", { exact: true })).toHaveCount(1);
  if (planned) await expect(page.getByLabel("规划对话", { exact: true })).toBeEnabled();
  else await expect(page.getByRole("button", { name: "初始规划", exact: true })).toBeEnabled();
  return { pause: () => { gate = new Promise<void>(resolve => { release = resolve; }); }, resume: () => release?.(), reject: () => { rejectNext = true; } };
}

test("desktop planner keeps delayed feedback, preview approval and history usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const api = await installPlanner(page);
  const dialog = page.getByRole("dialog", { name: "规划大师" });
  const input = page.getByLabel("规划对话", { exact: true });
  api.pause();
  await input.fill("把第二张文案缩短");
  await input.press("Enter");
  try {
    await expect(page.getByRole("log")).toContainText("把第二张文案缩短");
    await expect(page.getByRole("button", { name: "发送中…", exact: true })).toBeDisabled();
    await expect(input).toBeDisabled();
  } finally { api.resume(); }
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
  await expect(page.locator(".planning-diff ins")).toHaveText("舒适握持");
  await expect(dialog).toHaveCSS("background-color", "rgb(20, 20, 20)");
  await page.screenshot({ path: testInfo.outputPath("planner-desktop-preview.png"), fullPage: true });
  await input.fill("未发送的后续想法");
  await expect(page.getByRole("button", { name: "应用修改", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "应用修改", exact: true }).click();
  await expect(page.getByRole("button", { name: "应用修改", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已应用版本", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "恢复版本 1", exact: true })).toBeDisabled();
  await expect(input).toHaveValue("未发送的后续想法");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "打开规划大师" })).toBeFocused();
});

test("mobile planner switches panels without losing feedback and opens history in preview", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPlanner(page);
  const dialog = page.getByRole("dialog", { name: "规划大师" });
  const previewTab = page.getByRole("tab", { name: "方案预览" });
  const chatTab = page.getByRole("tab", { name: "规划对话", exact: true });
  await expect(previewTab).toBeVisible();
  await chatTab.click();
  const input = page.getByLabel("规划对话", { exact: true });
  await input.fill("保留这个草稿");
  await page.screenshot({ path: testInfo.outputPath("planner-mobile-chat.png"), fullPage: true });
  await previewTab.click();
  await expect(page.getByLabel("商品信息与规划需求", { exact: true })).toBeVisible();
  await expect(input).not.toBeVisible();
  await previewTab.press("ArrowRight");
  await expect(chatTab).toBeFocused();
  await expect(input).toHaveValue("保留这个草稿");
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  await expect(previewTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "已应用版本", exact: true })).toBeVisible();
  await expect(dialog).toHaveCSS("background-color", "rgb(20, 20, 20)");
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("planner-mobile-preview.png"), fullPage: true });
});

test("planner restores rejected feedback for retry without removing the current preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const api = await installPlanner(page);
  const input = page.getByLabel("规划对话", { exact: true });
  await input.fill("把第二张文案缩短");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "修改预览", exact: true })).toBeVisible();
  api.reject();
  await input.fill("这一条需要重试");
  await input.press("Enter");
  await expect(page.getByRole("alert")).toContainText("当前方案已更新，请检查后重试");
  await expect(input).toHaveValue("这一条需要重试");
  await expect(page.locator(".planning-diff ins")).toHaveText("舒适握持");
  await expect(page.getByRole("button", { name: "发送", exact: true })).toBeEnabled();
});

test("mobile initial planning failure stays visible on preview and can be retried", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPlanner(page, { planned: false, failInitial: true });
  const dialog = page.getByRole("dialog", { name: "规划大师" });
  const previewTab = page.getByRole("tab", { name: "方案预览" });
  await expect(previewTab).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "初始规划", exact: true }).click();
  const error = dialog.getByRole("alert");
  await expect(error).toBeVisible();
  await expect(error).toContainText("内容规划返回格式无效，请重新规划");
  await expect(previewTab).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("planner-mobile-initial-failure.png"), fullPage: true });
  await dialog.getByRole("button", { name: "初始规划", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "当前规划", exact: true })).toBeVisible();
  await expect(error).toHaveCount(0);
});

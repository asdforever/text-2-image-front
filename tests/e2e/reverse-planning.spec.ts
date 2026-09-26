import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../../src/lib/generation-workspace";
import type { ApiModulePlan } from "../../src/api/client";

const catalog = createDefaultGenerationConfig();
const now = "2026-09-25T08:00:00Z";
const module = { id: "ref-module", title: "商品特写", referenceImageId: "ref-image", goal: "呈现细节", layout: "大特写", informationHierarchy: "商品优先", typography: "无衬线", colorAndLighting: "柔光", adaptationNotes: "只参考设计" };
const document = { name: "数码表达参考", category: "数码", summary: "通过局部细节呈现价值", suitableFor: "电子产品", goal: "建立信任", requiredMaterials: "清晰产品图", notSuitableFor: "服饰", references: [], overall: { contentFlow: "整体 → 细节", visualSystem: "白底柔光", moduleStrategy: "特写补充信息", adaptationRules: "替换商品事实" }, modules: [module] };
const version = { id: "ref-version", reverseProjectId: "ref-project", versionNo: 2, revision: 4, createdAt: now, document };
const reverseProject = { ...document, id: "ref-project", revision: 4, analysis: { status: "completed" }, versions: [version], latestVersionId: version.id, createdAt: now, updatedAt: now };

async function setup(page: Page, mode: "hero" | "suite", recover = false) {
  const normalize = mode === "hero" ? normalizeHeroConfig : normalizeSuiteConfig;
  const config = normalize({ selectedAssetIds: ["source-1"], selectedModuleIds: [mode === "hero" ? "hero-kv" : "suite-hero"], planningBrief: "", styleId: catalog.styleCategories[0].styles[0].id, model: catalog.models[0].id });
  await page.addInitScript(({ config, mode }) => {
    if (sessionStorage.getItem("reverse-test")) return;
    sessionStorage.setItem("reverse-test", "1");
    localStorage.setItem("picagent-project-store", JSON.stringify({ state: { generationDrafts: { ["proj-demo:" + mode]: { config, updatedAt: "2026-09-25" } } }, version: 0 }));
  }, { config, mode });
  const calls = { plans: [] as any[], compiles: [] as any[], bindings: [] as any[] };
  const overallBinding = { id: "bind-overall", projectId: "proj-demo", projectName: "耳机项目", reverseProjectId: "ref-project", reverseProjectName: document.name, versionId: version.id, versionNo: 2, target: mode, scope: "overall", targetModuleId: null, sourceModuleId: null, sourceModuleTitle: null, createdAt: now };
  let bindings = recover ? [overallBinding] : [];
  function plan(input: any): ApiModulePlan {
    return { id: "master-ref", mode, input, status: "completed", summary: "根据反推选择细节表现", warnings: [], createdAt: now, modules: [{ moduleId: mode === "hero" ? "hero-detail" : "suite-detail", taskId: "detail-task", resultCount: 1, moduleParameters: [], compositionBrief: "保留商品，展示结构细节", reason: "解释价值", referenceModuleId: module.id }] };
  }
  let saved = recover ? plan({ mode, sourceAssetIds: ["source-1"], referenceAssetIds: [], marketId: config.market, aspectRatio: config.aspectRatio, outputLanguage: config.outputLanguage, brief: "", reverseVersionId: version.id }) : undefined;
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const send = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "/api/generation-config") return send({ id: "v1", version: 1, content: catalog, contentSha256: "a".repeat(64), createdAt: now });
    if (path === "/api/projects/proj-demo") return send({ id: "proj-demo", name: "耳机项目", status: "active", selections: {}, createdAt: now, updatedAt: now, assets: [{ id: "source-1", kind: "source", state: "available", filename: "耳机.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "b".repeat(64), createdAt: now }] });
    if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
    if (path === "/api/reverse-projects") return send([reverseProject]);
    if (path.endsWith("/versions/ref-version")) return send(version);
    if (path === "/api/projects/proj-demo/reverse-bindings") {
      if (req.method() === "PUT") {
        const input = req.postDataJSON(); calls.bindings.push(input);
        const binding = { ...overallBinding, ...input, id: "bind-" + input.scope, sourceModuleTitle: input.sourceModuleId ? module.title : null };
        bindings = [...bindings.filter(b => b.scope !== input.scope), binding]; return send(binding);
      }
      if (recover) await new Promise(resolve => setTimeout(resolve, 150));
      return send(bindings.filter(b => b.target === url.searchParams.get("target")));
    }
    if (path.includes("/module-plans")) {
      if (req.method() === "POST") { const input = req.postDataJSON(); calls.plans.push(input); saved = plan(input); }
      if (saved) return send(saved);
    }
    if (req.method() === "POST") { calls.compiles.push(req.postDataJSON()); return route.fulfill({ status: 503, json: { error: { message: "测试已捕获编译请求" } } }); }
    return route.fulfill({ status: 404, json: { error: { message: "尚无记录" } } });
  });
  return calls;
}

for (const mode of ["hero", "suite"] as const) {
  test(mode + " 从工作台选择固定版本，规划与模块编译携带正确引用", async ({ page }) => {
    const calls = await setup(page, mode);
    await page.goto("/projects/proj-demo?tab=" + mode);
    await page.getByRole("button", { name: "选择反推项目", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "选择反推项目" });
    await dialog.getByRole("button", { name: /数码表达参考/ }).click();
    await dialog.getByRole("button", { name: "使用这个版本" }).click();
    await expect(page.getByLabel("规划大师反推参考")).toContainText("数码表达参考 · v2");
    await page.getByRole("button", { name: "自动规划", exact: true }).click();
    await expect(page.getByText("根据反推选择细节表现", { exact: true })).toBeVisible();
    expect(calls.plans).toHaveLength(1);
    expect(calls.plans[0].reverseVersionId).toBe(version.id);
    await expect(page.getByLabel("模块反推参考")).toContainText("使用规划大师匹配的模块");
    await page.getByRole("button", { name: "选择模块参考", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "选择模块参考" });
    await dialog.getByRole("button", { name: /数码表达参考/ }).click();
    await dialog.getByLabel("参考模块", { exact: true }).selectOption(module.id);
    await dialog.getByRole("button", { name: "使用这个版本" }).click();
    await expect(page.getByLabel("模块反推参考")).toContainText("商品特写 · v2");
    expect(calls.bindings[1]).toMatchObject({ target: mode, scope: "module", targetModuleId: "detail-task", sourceModuleId: module.id, versionId: version.id });
    await page.reload();
    await expect(page.getByLabel("模块反推参考")).toContainText("商品特写 · v2");
    expect(calls.plans).toHaveLength(1);
    await page.getByRole("button", { name: mode === "hero" ? "编译提示词" : "生成套图提示词", exact: true }).click();
    await expect.poll(() => calls.compiles.length).toBe(1);
    expect(calls.compiles[0]).toMatchObject({ reverseVersionId: version.id, modulePlanId: "master-ref", modules: [{ taskId: "detail-task", reverseReference: { versionId: version.id, moduleId: module.id } }] });
  });
  test(mode + " 先同步服务端绑定再恢复已有规划，不重复请求模型", async ({ page }) => {
    const calls = await setup(page, mode, true);
    await page.goto("/projects/proj-demo?tab=" + mode);
    await expect(page.getByLabel("规划大师反推参考")).toContainText("数码表达参考 · v2");
    await expect(page.getByText("根据反推选择细节表现", { exact: true })).toBeVisible();
    await expect(page.getByLabel("模块反推参考")).toContainText("使用规划大师匹配的模块");
    expect(calls.plans).toHaveLength(0);
  });
}

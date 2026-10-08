import { expect, test, type Page } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

for (const mode of ["hero", "suite"] as const) {
  test(`${mode}: regular auto-fill and compile require explicit generation confirmation`, async ({ page }, testInfo) => {
    page.on("pageerror", error => console.error(error.message));
    const config = createDefaultGenerationConfig();
    const modules = mode === "hero" ? config.heroModules : config.suiteModules;
    const chosen = modules[0];
    const project = { id: "regular-demo", name: "随行杯商品图", status: "active", archivedAt: null, createdAt: "2026-09-28", updatedAt: "2026-09-28", selections: {}, assets: [{ id: "source", kind: "source", filename: "商品正面.jpg", state: "available", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, sha256: "a".repeat(64), createdAt: "2026-09-28" }] };
    let planned: any;
    let compiled: any;
    let compileInput: any;
    let confirmCalls = 0;
    let planningCalls = 0;
    let releasePlanning!: () => void;
    const planningGate = new Promise<void>(resolve => { releasePlanning = resolve; });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("regular-test")) { localStorage.clear(); sessionStorage.setItem("regular-test", "1"); }
      localStorage.setItem("picagent-theme", JSON.stringify({ state: { theme: "light" }, version: 0 }));
    });
    await page.route(url => url.pathname.startsWith("/api/"), async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const body = route.request().postDataJSON();
      const data = (value: any) => route.fulfill({ json: { data: value } });
      if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
      if (path === "/api/projects/regular-demo") return data(project);
      if (path === "/api/generation-config/resolve") return data({ config, configVersion: 1, runtimeModules: { version: "runtime-modules-v1", heroModules: config.heroModules, suiteModules: config.suiteModules } });
      if (path.includes("reverse-bindings")) return data([]);
      if (path.endsWith("/module-plans") && body) {
        planningCalls++;
        await planningGate;
        expect(body.brief).toContain("颜色：银色");
        expect(body.creationMode).toBe("regular");
        expect(body.selectedModules).toEqual([{ taskId: chosen.id, moduleId: chosen.id }]);
        planned = { id: `content-${planningCalls}`, mode, status: "completed", input: body, planningContractVersion: "regular-design-v1", summary: "已分配", warnings: [], modules: [{ taskId: chosen.id, moduleId: chosen.id, taskTitle: chosen.label, reason: "展示商品外观和容量", suggestedCopy: "500ml 随行杯", moduleParameters: [{ key: "容量", value: "500ml" }], compositionBrief: "", informationQuestion: "", productPresence: "full", designGuideIds: [], resultCount: 1 }] };
        return data(planned);
      }
      if (path.includes("/module-plans/") && planned) return data(planned);
      if (path.endsWith("/compile")) {
        compileInput = body;
        const task = body.modules[0];
        const module = { id: "module-1", moduleKey: chosen.id, moduleId: chosen.id, moduleLabel: chosen.label, title: chosen.label, resultCount: 1, position: 1, revision: 1, compiledTaskPrompt: `Frozen ${task.regularTask.copy}`, copySummary: task.regularTask.copy, visualDirection: task.regularTask.goal, visibleFacts: [], unconfirmedItems: [], moduleParameters: task.moduleParameters, constraints: {} };
        compiled = { id: "compiled-1", creationMode: "regular", projectId: project.id, status: "awaiting_confirmation", revision: 1, modules: [module], constraints: {}, snapshot: { creationMode: "regular" }, references: [], generationBatchId: null, slots: [], progress: { total: 1, queued: 0, leased: 0, dispatching: 0, succeeded: 0, failed: 0, cancelled: 0, needsRetry: 0, completed: 0 } };
        return data(compiled);
      }
      if (path.endsWith("/confirm")) {
        confirmCalls++;
        expect(body.moduleTaskPrompts[chosen.id]).toBe("Frozen 500ml 随行杯");
        compiled = { ...compiled, status: mode === "suite" ? "confirmed" : "succeeded", generationBatchId: mode === "suite" ? "batch-1" : null };
        return data(compiled);
      }
      if (path.endsWith("/compiled-1")) return data(compiled);
      if (path.endsWith("/batch-1")) return data({ ...compiled, id: "batch-1", status: "succeeded" });
      if (path.endsWith("/by-request")) return data(compiled ?? null);
      return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/regular-demo?tab=${mode}`);
    await expect(page.getByRole("button", { name: "常规版", exact: true })).toHaveAttribute("aria-pressed", "true");
    const geometry = () => page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return { x: box.x, width: box.width };
      };
      return [".generation-config", ".generation-config-footer", ".generation-result", ".studio-result-topbar"].map(rect);
    });
    const regularGeometry = await geometry();
    const regularHeadings = await page.locator(".generation-section-title").allTextContents();
    await expect(page.locator(".generation-config").getByRole("button", { name: `添加${chosen.label}`, exact: true })).toHaveCount(0);
    const modulesPanel = page.getByRole("region", { name: mode === "hero" ? "主图模块" : "详情页模块", exact: true });
    await expect(page.locator(".generation-result").getByRole("button", { name: `添加${chosen.label}`, exact: true })).toBeVisible();
    await expect(modulesPanel).toBeVisible();
    const moduleBox = await modulesPanel.boundingBox();
    const previewBox = await page.locator(".studio-stage-viewport").first().boundingBox();
    expect(moduleBox!.y + moduleBox!.height).toBeLessThanOrEqual(previewBox!.y);
    await expect(page.locator(".generation-result").getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator(".generation-config-footer").getByRole("combobox")).toHaveCount(0);
    await expect(page.locator(".generation-result > .generation-result-shell")).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("aligned-regular-desktop.png") });
    await page.getByRole("button", { name: "专业版", exact: true }).click();
    expect(await geometry()).toEqual(regularGeometry);
    await expect(page.locator(".generation-result").getByRole("button", { name: `添加${chosen.label}`, exact: true })).toBeVisible();
    await expect(page.locator(".generation-config .module-selector")).toHaveCount(0);
    expect(await page.locator(".generation-section-title").allTextContents()).toEqual(regularHeadings);
    await expect(page.getByRole("button", { name: "打开规划大师", exact: true })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("aligned-professional-desktop.png") });
    await page.getByRole("button", { name: "常规版", exact: true }).click();
    await page.getByRole("button", { name: "选择产品素材", exact: true }).click();
    await page.getByRole("button", { name: /商品正面.jpg 可用/ }).click();
    await page.getByRole("button", { name: "收起素材选择", exact: true }).click();
    await editProductBrief(page, "商品名称：随行杯\n容量：500ml\n材质：不锈钢");
    await page.getByRole("button", { name: config.styleCategories[0].styles[0].label, exact: true }).click();
    await page.getByRole("button", { name: `添加${chosen.label}`, exact: true }).click();
    await expect(page.getByRole("button", { name: "打开规划大师", exact: true })).toHaveCount(1);
    await expect(page.getByLabel("本图要讲什么", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("建议文案", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "编译提示词", exact: true })).toBeEnabled();
    await editProductBrief(page, "商品名称：随行杯\n容量：500ml\n材质：不锈钢\n颜色：银色");
    await page.reload();
    await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
    await expect(page.getByLabel("商品信息与规划需求", { exact: true })).toHaveValue(/银色/);
    await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
    await expect(page.getByRole("button", { name: "编译提示词", exact: true })).toBeEnabled();
    expect(planningCalls).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("regular-desktop.png"), fullPage: true });
    await triggerInitialPlanning(page);
    await expect.poll(() => planningCalls).toBe(1);
    await expect(page.locator(".generation-config-footer").getByRole("button")).toBeDisabled();
    releasePlanning();
    await expect(page.getByRole("button", { name: "打开规划大师", exact: true })).toBeEnabled();
    const filled = await page.evaluate(({ mode }) => JSON.parse(localStorage.getItem("picagent-project-store")!).state.generationDrafts[`regular-demo:${mode}`].config, { mode });
    expect(filled.moduleParameters[chosen.id]).toContainEqual({ key: "容量", value: "500ml" });
    expect(compileInput).toBeUndefined();
    await page.getByRole("button", { name: "编译提示词", exact: true }).click();
    const confirmation = page.getByRole("button", { name: mode === "hero" ? "确认并开始批次生成" : "确认并生成 1 张", exact: true });
    await expect(confirmation).toBeEnabled();
    expect(planningCalls).toBe(1);
    expect(confirmCalls).toBe(0);
    await page.reload();
    await expect(confirmation).toBeEnabled();
    expect(confirmCalls).toBe(0);
    await confirmation.click();
    await expect.poll(() => confirmCalls).toBe(1);
    expect(compileInput.creationMode).toBe("regular");
    expect(compileInput.modules[0].regularTask).toEqual({ goal: "展示商品外观和容量", copy: "500ml 随行杯" });
    expect(compileInput.modules[0].taskDesign).toBeUndefined();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "关闭生成配置", exact: true }).first().click();
    await modulesPanel.scrollIntoViewIfNeeded();
    await expect(modulesPanel.getByRole("button", { name: `添加${chosen.label}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: `折叠${mode === "hero" ? "主图模块" : "详情页模块"}`, exact: true }).click();
    await expect(modulesPanel.getByRole("button", { name: `添加${chosen.label}`, exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("regular-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "专业版", exact: true }).click();
    await expect(page.getByRole("button", { name: "专业版", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "常规版", exact: true }).click();
    await page.getByRole("button", { name: "展开配置", exact: true }).click();
    await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
    await expect(page.getByLabel("商品信息与规划需求", { exact: true })).toHaveValue(/银色/);
    await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
  });
}

async function triggerInitialPlanning(page: Page) {
  await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
  await page.getByRole("button", { name: "初始规划", exact: true }).click();
  await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
}

async function editProductBrief(page: Page, value: string) {
  await page.getByRole("button", { name: "打开规划大师", exact: true }).click();
  await page.getByLabel("商品信息与规划需求", { exact: true }).fill(value);
  await page.getByRole("button", { name: "关闭规划大师", exact: true }).click();
}

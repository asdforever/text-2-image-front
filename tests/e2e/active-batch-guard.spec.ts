import { expect, test } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

for (const mode of ["hero", "suite"] as const) for (const creationMode of ["regular", "professional"] as const) {
  test(`${mode} ${creationMode} 排队生成和取消中不能重新编译，刷新保留批次`, async ({ page }) => {
    const config = createDefaultGenerationConfig();
    const moduleId = (mode === "hero" ? config.heroModules : config.suiteModules)[0].id;
    let status = "queued";
    let writes = 0;
    const module = { id: "m", moduleKey: moduleId, moduleId, title: "当前批次", moduleLabel: "当前批次", resultCount: 1, compiledTaskPrompt: "冻结提示词", confirmedTaskPrompt: "冻结提示词", moduleParameters: [], constraints: {}, visibleFacts: [], unconfirmedItems: [] };
    await page.addInitScript(({ mode, creationMode, moduleId, config }) => {
      if (sessionStorage.getItem("guard-seeded")) return;
      sessionStorage.setItem("guard-seeded", "1");
      localStorage.setItem("picagent-project-store", JSON.stringify({ version: 0, state: {
        generationDrafts: { [`guard:${mode}`]: { config: { creationMode, selectedAssetIds: ["source"], selectedModuleIds: [moduleId], planningBrief: "已填写的商品资料", styleId: config.styleCategories[0].styles[0].id, model: config.models[0].id }, updatedAt: "2026-09-29" } },
        heroGenerationSessions: { guard: { batchId: "active-batch", compileIdempotencyKey: "original-key", confirmIdempotencyKey: "original-confirm" } },
        suiteGenerationSessions: { guard: { planId: "active-plan", compileIdempotencyKey: "original-key" } },
      } }));
    }, { mode, creationMode, moduleId, config });
    await page.route(url => url.pathname.startsWith("/api/"), async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes++;
      const data = (value: unknown) => route.fulfill({ json: { data: value } });
      if (path === "/api/projects/guard") return data({ id: "guard", name: "批次保护", status: "active", assets: [], selections: {}, createdAt: "2026-09-29", updatedAt: "2026-09-29" });
      if (path.endsWith("/generation-config/resolve")) return data({ config, configVersion: 1, runtimeModules: { heroModules: config.heroModules, suiteModules: config.suiteModules } });
      if (path.endsWith("/active-batch")) return data({ id: "active-batch", projectId: "guard", creationMode, kind: mode, status, modules: [module], slots: [], progress: { total: 1, queued: status === "queued" ? 1 : 0, leased: 0, dispatching: 0, succeeded: status === "succeeded" ? 1 : 0, failed: 0, cancelled: 0, needsRetry: 0, completed: status === "succeeded" ? 1 : 0 } });
      if (path.endsWith("/active-plan")) return data({ id: "active-plan", projectId: "guard", status: "confirmed", snapshot: { creationMode }, generationBatchId: "active-batch", revision: 1, modules: [module], constraints: {}, references: [] });
      if (path.includes("reverse-bindings")) return data([]);
      return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/guard?tab=${mode}`);
    const footerButton = page.locator(".generation-config-footer").getByRole("button");
    for (const nextStatus of ["queued", "running", "cancel_requested"]) {
      status = nextStatus;
      await page.reload();
      const details = page.locator(".studio-task-details");
      await expect(details).toHaveCount(1);
      await expect(footerButton).toBeDisabled();
      // Bypass only the HTML disabled attribute to verify the submit handler also protects the session.
      await footerButton.evaluate(button => { (button as HTMLButtonElement).disabled = false; (button as HTMLButtonElement).click(); });
      await expect(details).toHaveCount(1);
      const session = await page.evaluate(mode => {
        const state = JSON.parse(localStorage.getItem("picagent-project-store")!).state;
        return (mode === "hero" ? state.heroGenerationSessions : state.suiteGenerationSessions).guard;
      }, mode);
      expect(session.compileIdempotencyKey).toBe("original-key");
      expect(writes).toBe(0);
    }
    status = "succeeded";
    await page.reload();
    await expect(footerButton).toBeEnabled();
    expect(writes).toBe(0);
  });
}

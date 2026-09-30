import { expect, test } from "playwright/test";
import { createDefaultGenerationConfig } from "../../src/lib/generation-config";

for (const mode of ["hero", "suite"] as const) {
  test(`${mode} 结果、批次和任务状态按创作版本隔离，切换及刷新不串图`, async ({ page }) => {
    const config = createDefaultGenerationConfig();
    const assets = ["regular", "professional"].map(creationMode => ({ id: `${creationMode}-image`, kind: "generated", filename: `${creationMode}.png`, state: "available", mimeType: "image/png", byteSize: 100, width: 1000, height: 1000, sha256: creationMode, generationSnapshotId: `${creationMode}-slot`, createdAt: "2026-09-29T00:00:00Z" }));
    const progress = { total: 1, queued: 0, leased: 0, dispatching: 0, succeeded: 1, failed: 0, cancelled: 0, needsRetry: 0, completed: 1 };
    const batch = { id: "professional-batch", projectId: "mode-results", creationMode: "professional", kind: mode, status: "succeeded", modules: [], slots: [{ id: "professional-slot", status: "succeeded", generatedAssetId: "professional-image", generatedAssetPreviewUrl: "/api/projects/mode-results/assets/professional-image/preview", moduleTaskId: "m", moduleKey: "m", ordinal: 1 }], progress };
    const plan = { id: "professional-plan", projectId: "mode-results", status: "confirmed", revision: 1, snapshot: { creationMode: "professional" }, generationBatchId: batch.id, modules: [], constraints: {}, references: [] };
    await page.addInitScript(mode => {
      if (sessionStorage.getItem("mode-results-seeded")) return;
      sessionStorage.setItem("mode-results-seeded", "yes");
      localStorage.setItem("picagent-project-store", JSON.stringify({ version: 0, state: {
        generationDrafts: { [`mode-results:${mode}`]: { config: { creationMode: "regular" }, updatedAt: "2026-09-29" } },
        heroGenerationSessions: { "mode-results": { batchId: "professional-batch", compileIdempotencyKey: "old", confirmIdempotencyKey: "old-confirm" } },
        suiteGenerationSessions: { "mode-results": { planId: "professional-plan", compileIdempotencyKey: "old" } },
      } }));
    }, mode);
    let writes = 0;
    await page.route(url => url.pathname.startsWith("/api/"), async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes++;
      const data = (value: unknown) => route.fulfill({ json: { data: value } });
      if (path.endsWith("/preview")) return route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" });
      if (path === "/api/projects/mode-results") return data({ id: "mode-results", name: "模式结果隔离", status: "active", selections: {}, assets, createdAt: "2026-09-29", updatedAt: "2026-09-29" });
      if (path.endsWith("/generation-config/resolve")) return data({ config, configVersion: 1, runtimeModules: { heroModules: config.heroModules, suiteModules: config.suiteModules } });
      if (path.endsWith("/workbench")) return data({ generationSteps: assets.map((asset, i) => ({ id: `step-${i}`, kind: mode, creationMode: i ? "professional" : "regular", title: i ? "专业版图片" : "常规版图片", sourceAssetIds: [], outputAssetIds: [asset.id], outputVersionIds: [], batchId: i ? "professional-batch" : "regular-batch", parameters: {}, finalPrompt: "", taskPrompt: "", constraints: {} })) });
      if (path.endsWith("/professional-batch")) return data(batch);
      if (path.endsWith("/professional-plan")) return data(plan);
      if (path.includes("reverse-bindings")) return data([]);
      return route.fulfill({ status: 404, json: { error: { message: "暂无记录" } } });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/mode-results?tab=${mode}`);
    const gallery = page.getByRole("region", { name: "生成结果", exact: true });
    const batchSelect = page.getByRole("combobox", { name: "查看生成批次" });
    await expect(gallery.getByRole("button", { name: "查看 regular.png", exact: true })).toBeVisible();
    await expect(batchSelect).not.toContainText("专业版");
    await expect(gallery.getByRole("button", { name: "查看 professional.png", exact: true })).toHaveCount(0);
    await expect(page.locator(".studio-task-details")).toHaveCount(0);
    await expect(page.getByText("本次任务已完成", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "导出整套详情图", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "专业版", exact: true }).click();
    await expect(gallery.getByRole("button", { name: "查看 professional.png", exact: true })).toBeVisible();
    await expect(batchSelect).not.toContainText("常规版");
    await expect(page.locator(".studio-task-details")).toHaveCount(1);
    await page.getByRole("button", { name: "常规版", exact: true }).click();
    await page.reload();
    await expect(gallery.getByRole("button", { name: "查看 regular.png", exact: true })).toBeVisible();
    await expect(batchSelect).not.toContainText("专业版");
    await expect(page.locator(".studio-task-details")).toHaveCount(0);
    expect(writes).toBe(0);
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { useProjectStore } from "../src/store/useProjectStore";

async function loadGenerationModule() {
  return import("../src/lib/generation-workspace").catch(() => ({}));
}

test("generation drafts stay isolated by project and mode and can be cleared independently", () => {
  const store = useProjectStore.getState() as any;
  store.resetDemoData();
  assert.equal(typeof store.updateGenerationDraft, "function");
  store.updateGenerationDraft("project-a", "hero", { designBrief: "主图草稿" });
  useProjectStore.getState().updateGenerationDraft("project-a", "suite", { creativePrompt: "详情图草稿" });
  useProjectStore.getState().updateGenerationDraft("project-b", "hero", { moduleParameters: { "hero-scene": [{ key: "场景地点", value: "办公桌" }] } });

  const drafts = useProjectStore.getState().generationDrafts;
  assert.equal(drafts["project-a:hero"].config.designBrief, "主图草稿");
  assert.equal(drafts["project-a:suite"].config.creativePrompt, "详情图草稿");
  assert.deepEqual(drafts["project-b:hero"].config.moduleParameters, { "hero-scene": [{ key: "场景地点", value: "办公桌" }] });

  useProjectStore.getState().clearGenerationDraft("project-a", "hero");
  assert.equal(useProjectStore.getState().generationDrafts["project-a:hero"], undefined);
  assert.equal(useProjectStore.getState().generationDrafts["project-a:suite"].config.creativePrompt, "详情图草稿");
});

test("generation status only moves through legal workflow transitions", async () => {
  const generation = await loadGenerationModule() as Record<string, any>;
  assert.equal(generation.canTransitionGenerationStatus?.("idle", "validating"), true);
  assert.equal(generation.canTransitionGenerationStatus?.("validating", "planning"), true);
  assert.equal(generation.canTransitionGenerationStatus?.("planning", "planned"), true);
  assert.equal(generation.canTransitionGenerationStatus?.("planned", "generating"), true);
  assert.equal(generation.canTransitionGenerationStatus?.("completed", "planning"), false);
});

test("module run preserves successes and returns only failed modules for retry", async () => {
  const generation = await loadGenerationModule() as Record<string, any>;
  const run = generation.createGenerationRun?.("hero", ["hero-kv", "hero-detail"]);
  const oneComplete = generation.updateGenerationModuleRun?.(run, "hero-kv", { status: "completed", progress: 100 });
  const partial = generation.updateGenerationModuleRun?.(oneComplete, "hero-detail", { status: "failed", progress: 40, error: "timeout" });

  assert.equal(partial.status, "partial");
  assert.equal(partial.modules["hero-kv"].status, "completed");
  assert.deepEqual(generation.failedGenerationModuleIds?.(partial), ["hero-detail"]);
});

test("generated assets are appended with their requested output type", () => {
  const store = useProjectStore.getState() as any;
  store.resetDemoData();
  const projectId = useProjectStore.getState().projects[0].id;
  assert.equal(typeof store.addGeneratedAsset, "function");
  const created = store.addGeneratedAsset(projectId, { type: "hero", name: "首屏 KV", url: "/mock-assets/suite-new.png", template: "冷调精密", category: "hero-kv" });
  assert.equal(created.type, "hero");
  assert.equal(useProjectStore.getState().projects[0].assets.at(-1)?.category, "hero-kv");
});

test("generated assets can be removed without changing unrelated project assets", () => {
  const store = useProjectStore.getState() as any;
  store.resetDemoData();
  const projectId = useProjectStore.getState().projects[0].id;
  const before = useProjectStore.getState().projects[0].assets.length;
  const created = store.addGeneratedAsset(projectId, { type: "suite", name: "核心卖点图", url: "/mock-assets/suite-new.png", template: "极简商业", category: "suite-benefit" });
  assert.equal(typeof useProjectStore.getState().removeAsset, "function");
  useProjectStore.getState().removeAsset(projectId, created.id);
  assert.equal(useProjectStore.getState().projects[0].assets.length, before);
});

test("suite plans persist by project and mode", () => {
  const store = useProjectStore.getState() as any;
  store.resetDemoData();
  assert.equal(typeof store.updateGenerationPlans, "function");
  store.updateGenerationPlans("project-a", "suite", [{ moduleId: "suite-hero", title: "首屏主视觉", copy: "初稿", visual: "棚拍", moduleParameters: [{ key: "首要信息", value: "快充" }] }]);
  assert.deepEqual(useProjectStore.getState().generationPlans["project-a:suite"], [{ moduleId: "suite-hero", title: "首屏主视觉", copy: "初稿", visual: "棚拍", moduleParameters: [{ key: "首要信息", value: "快充" }] }]);
  store.updateGenerationPlans("project-a", "suite", [{ moduleId: "suite-hero", title: "首屏主视觉", copy: "修改后", visual: "棚拍", moduleParameters: [{ key: "首要信息", value: "快充" }] }]);
  assert.equal(useProjectStore.getState().generationPlans["project-a:suite"][0].copy, "修改后");
});

test("suite config uses standard 1K resolution by default", async () => {
  const generation = await loadGenerationModule() as Record<string, any>;
  assert.equal(generation.normalizeSuiteConfig?.({}).resolution, "标准 1K");
});

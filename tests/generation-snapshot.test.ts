import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("project store records an immutable generation snapshot per project and mode", async () => {
  const projectStore = await import("../src/store/useProjectStore");
  const configModule = await import("../src/lib/generation-config");
  const store = projectStore.useProjectStore;
  const config = configModule.createDefaultGenerationConfig();
  const snapshot = configModule.createGenerationSnapshot(config, { marketId: "taobao", modelId: "gpt-image-2-5", styleId: "minimal", moduleIds: ["hero-kv"] });
  store.getState().resetDemoData();
  store.getState().saveGenerationSnapshot("proj-demo", "hero", snapshot);

  assert.deepEqual(store.getState().generationSnapshots["proj-demo:hero"][0], snapshot);
  config.markets[0].label = "被修改";
  assert.notEqual(store.getState().generationSnapshots["proj-demo:hero"][0].market.label, "被修改");
});

test("generation snapshot captures output parameters, module parameters, and prompt slot identity", async () => {
  const configModule = await import("../src/lib/generation-config");
  const config = configModule.createDefaultGenerationConfig();
  config.marketBindings.taobao = { promptTemplateId: "tpl-market", promptVersionId: "ver-market", templateName: "市场提示词", versionNo: 2, body: "market body", contentSha256: "hash-market" };
  config.heroBindings["hero-kv"] = { promptTemplateId: "tpl-hero", promptVersionId: "ver-hero", templateName: "主图提示词", versionNo: 1, body: "hero body" };
  const snapshot = configModule.createGenerationSnapshot(config, {
    marketId: "taobao",
    modelId: "gpt-image-2-5",
    styleId: "minimal",
    moduleIds: ["hero-kv"],
    outputLanguage: "英文",
    aspectRatio: "4:3",
    resolution: "高清 2K",
    customStyle: "",
    moduleParameters: { "hero-kv": [{ key: "核心卖点", value: "65W 快充" }] },
  });

  assert.equal(snapshot.outputLanguage, "英文");
  assert.equal(snapshot.aspectRatio, "4:3");
  assert.equal(snapshot.resolution, "高清 2K");
  assert.deepEqual(snapshot.moduleParameters["hero-kv"], [{ key: "核心卖点", value: "65W 快充" }]);
  assert.equal(snapshot.promptBindings[0].slot, "market");
  assert.equal(snapshot.promptBindings[0].targetId, "taobao");
  assert.equal(snapshot.promptBindings[0].body, "market body");
  assert.equal(snapshot.promptBindings[1].slot, "hero-module");
  assert.equal(snapshot.promptBindings[1].targetId, "hero-kv");
});

test("generated assets retain the immutable generation snapshot", async () => {
  const projectStore = await import("../src/store/useProjectStore");
  const configModule = await import("../src/lib/generation-config");
  const store = projectStore.useProjectStore;
  store.getState().resetDemoData();
  const snapshot = configModule.createGenerationSnapshot(configModule.createDefaultGenerationConfig(), { marketId: "taobao", modelId: "gpt-image-2-5", styleId: "minimal", moduleIds: ["hero-kv"] });
  const created = store.getState().addGeneratedAsset("proj-demo", { type: "hero", name: "快充主图", url: "/mock-assets/hero-new.png", template: "极简商业", category: "hero-kv", generationSnapshot: snapshot });
  assert.deepEqual(created.generationSnapshot, snapshot);
  snapshot.market!.label = "后来修改";
  assert.notEqual(created.generationSnapshot?.market?.label, "后来修改");
});

test("hero compile and suite image submissions record generation snapshots", () => {
  const hero = readFileSync(new URL("../src/pages/HeroImageWorkspace.tsx", import.meta.url), "utf8");
  const suite = readFileSync(new URL("../src/pages/SuiteWorkspace.tsx", import.meta.url), "utf8");

  assert.equal((hero.match(/saveGenerationSnapshot\(props\.project\.id, "hero"/g) ?? []).length, 1);
  assert.match(hero, /compileBatchHeroGenerationFlow\(batchGenerationApi/);
  assert.match(hero, /setBatch\(detail\)/);
  assert.equal((suite.match(/saveGenerationSnapshot\(props\.project\.id, "suite"/g) ?? []).length, 2);
});

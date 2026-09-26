import assert from "node:assert/strict";
import test from "node:test";

async function loadStoreModule() {
  return import("../src/store/useGenerationConfigStore").catch(() => ({}));
}

test("editing and locally validating generation config does not publish", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  assert.ok(store);
  store.getState().resetConfig();
  const initial = store.getState().published;
  const initialVersion = initial.version;
  store.getState().updateDraft((draft: any) => ({
    ...draft,
    markets: draft.markets.map((item: any) => item.id === "taobao" ? { ...item, label: "淘宝平台" } : item),
  }));

  assert.equal(store.getState().published.markets[0].label, "淘宝");
  assert.equal(store.getState().draft.markets[0].label, "淘宝平台");
  assert.equal(store.getState().isDirty, true);

  store.getState().saveDraft();
  assert.equal(store.getState().published.markets[0].label, "淘宝");
  assert.equal(store.getState().draft.markets[0].label, "淘宝平台");
  assert.equal(store.getState().published.version, initialVersion);
  assert.equal(store.getState().isDirty, false);
});

test("discarding a draft restores the published config", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  assert.ok(store);
  store.getState().resetConfig();
  const version = store.getState().published.version;
  store.getState().updateDraft((draft: any) => ({ ...draft, markets: [] }));
  store.getState().discardDraft();

  assert.equal(store.getState().draft.markets.length > 0, true);
  assert.equal(store.getState().published.version, version);
  assert.equal(store.getState().isDirty, false);
});

test("directory actions add and remove markets and models in the draft", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  store.getState().resetConfig();

  assert.equal(store.getState().addMarket({ id: "market-new", label: "抖音电商", platforms: "抖音", guidance: "短视频规范", defaultLanguage: "中文" }), true);
  assert.equal(store.getState().addMarket({ id: "market-duplicate", label: "抖音电商", platforms: "重复", guidance: "重复", defaultLanguage: "中文" }), false);
  assert.equal(store.getState().addModel({ id: "model-new", label: "新模型", provider: "厂商", constraints: "约束", resolutions: ["标准 1K"] }), true);
  assert.equal(store.getState().removeMarket("market-new"), true);
  assert.equal(store.getState().draft.markets.some((item: any) => item.id === "market-new"), false);
  assert.equal(store.getState().draft.models.some((item: any) => item.id === "model-new"), true);
});

test("module directory actions support independent hero and suite CRUD with binding migration", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  store.getState().resetConfig();
  assert.equal(store.getState().addModule("hero", { id: "hero-custom", label: "自定义主图", description: "突出新品卖点", mode: "suite" }), true);
  assert.equal(store.getState().addModule("suite", { id: "suite-custom", label: "自定义详情", description: "展示详细信息", mode: "hero" }), true);
  const heroModules = store.getState().draft.heroModules;
  const suiteModules = store.getState().draft.suiteModules;
  assert.equal(heroModules[heroModules.length - 1]?.mode, "hero");
  assert.equal(suiteModules[suiteModules.length - 1]?.mode, "suite");
  assert.equal(store.getState().setBinding("hero", "hero-custom", { promptTemplateId: "tpl-1", promptVersionId: "ver-1" }), true);
  assert.equal(store.getState().updateModule("hero", "hero-custom", { id: "hero-custom-v2", label: "新主图模块" }), true);
  assert.equal(store.getState().draft.heroBindings["hero-custom"], undefined);
  assert.equal(store.getState().draft.heroBindings["hero-custom-v2"].promptVersionId, "ver-1");
  assert.equal(store.getState().removeModule("suite", "suite-custom"), true);
  assert.equal(store.getState().draft.suiteBindings["suite-custom"], undefined);
});

test("renaming an id migrates its prompt binding without publishing locally", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  store.getState().resetConfig();
  const before = store.getState().published.version;
  store.getState().setPromptVersions([{ id: "ver-1", templateId: "tpl-1", versionNo: 1, status: "published" }]);
  assert.equal(store.getState().setBinding("market", "taobao", { promptTemplateId: "tpl-1", promptVersionId: "ver-1" }), true);
  assert.equal(store.getState().updateMarket("taobao", { id: "taobao-v2" }), true);
  assert.equal(store.getState().draft.marketBindings.taobao, undefined);
  assert.equal(store.getState().draft.marketBindings["taobao-v2"].promptVersionId, "ver-1");
  store.getState().saveDraft();
  assert.equal(store.getState().published.version, before);
  store.getState().saveDraft();
  assert.equal(store.getState().published.version, before);
});

test("saving rejects a binding whose concrete prompt version is unavailable", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  store.getState().resetConfig();
  store.getState().setPromptVersions([{ id: "ver-retired", templateId: "tpl-1", versionNo: 1, status: "retired", body: "old", contentSha256: "hash" }]);
  store.getState().setBinding("hero", "hero-kv", { promptTemplateId: "tpl-1", promptVersionId: "ver-retired" });
  assert.ok(store.getState().saveDraft().some((item: string) => item.includes("不可用")));
  assert.equal(store.getState().published.heroBindings["hero-kv"], null);
});

test("saving rejects prompt bindings when the referenced version cannot be resolved", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const store = module.useGenerationConfigStore;
  store.getState().resetConfig();
  store.getState().setBinding("market", "taobao", { promptTemplateId: "unknown-template", promptVersionId: "unknown-version" });

  const errors = store.getState().saveDraft();

  assert.ok(errors.some((item: string) => item.includes("不可用")));
  assert.equal(store.getState().published.marketBindings.taobao, null);
});

test("persisted configuration migration repairs partial payloads", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const migrated = module.normalizePersistedGenerationConfigState({ published: { version: 7, markets: [] }, draft: null });
  assert.equal(migrated.published.version, 7);
  assert.ok(Array.isArray(migrated.published.models));
  assert.ok(Array.isArray(migrated.draft.styleCategories));
  assert.equal(migrated.isDirty, false);
});

test("legacy planner bindings are discarded from published and draft configuration", async () => {
  const module = await loadStoreModule() as Record<string, any>;
  const hero = { promptTemplateId: "hero-master", promptVersionId: "hero-v1" };
  const suite = { promptTemplateId: "suite-master", promptVersionId: "suite-v1" };
  const normalized = module.normalizePersistedGenerationConfigState({ published: { plannerBindings: { hero, suite } }, draft: null });
  assert.equal(Object.hasOwn(normalized.published, "plannerBindings"), false);
  assert.equal(Object.hasOwn(normalized.draft, "plannerBindings"), false);
  const legacy = module.normalizePersistedGenerationConfigState({ published: {}, draft: {} });
  assert.equal(Object.hasOwn(legacy.published, "plannerBindings"), false);
});

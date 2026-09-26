import assert from "node:assert/strict";
import test from "node:test";

async function loadConfigModule() {
  return import("../src/lib/generation-config").catch(() => ({}));
}

test("default generation config includes editable markets, models, styles, and built-in module bindings", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const createDefaultGenerationConfig = config.createDefaultGenerationConfig as (() => any) | undefined;
  const value = createDefaultGenerationConfig?.();

  assert.ok(value);
  assert.equal(value.markets.some((item: any) => item.id === "taobao"), true);
  assert.equal(value.models.some((item: any) => item.id === "gpt-image-2-5"), true);
  assert.ok(value.styleCategories.length >= 3);
  assert.equal(Object.hasOwn(value.heroBindings, "hero-kv"), true);
  assert.equal(Object.hasOwn(value.suiteBindings, "suite-scene"), true);
  assert.equal(Object.hasOwn(value, "plannerBindings"), false);
});

test("generation config validation rejects duplicates and a fifth style", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const validateGenerationConfig = config.validateGenerationConfig as ((value: any) => string[]) | undefined;
  const createDefaultGenerationConfig = config.createDefaultGenerationConfig as (() => any) | undefined;
  const value = createDefaultGenerationConfig?.() ?? { markets: [], models: [], styleCategories: [] };
  value.markets.push({ ...value.markets[0], id: "market-2" });
  value.styleCategories[0].styles = [
    ...value.styleCategories[0].styles,
    { id: "style-4", label: "额外风格", description: "额外风格描述" },
    { id: "style-5", label: "额外风格 2", description: "额外风格描述 2" },
  ];

  const errors = validateGenerationConfig?.(value) ?? [];
  assert.ok(errors.some((item) => item.includes("市场名称不能重复")));
  assert.ok(errors.some((item) => item.includes("最多 4 个风格")));
});

test("generation config validation rejects incomplete prompt bindings", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const validateGenerationConfig = config.validateGenerationConfig as ((value: any) => string[]) | undefined;
  const createDefaultGenerationConfig = config.createDefaultGenerationConfig as (() => any) | undefined;
  const value = createDefaultGenerationConfig?.() as any;
  value.marketBindings.taobao = { promptTemplateId: "", promptVersionId: "" };

  const errors = validateGenerationConfig?.(value) ?? [];
  assert.ok(errors.some((item) => item.includes("提示词绑定")));
});

test("published config snapshots are immutable and validate deleted references", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const createGenerationSnapshot = config.createGenerationSnapshot as ((value: any, input: any) => any) | undefined;
  const validateGenerationSelection = config.validateGenerationSelection as ((value: any, selection: any) => string[]) | undefined;
  const createDefaultGenerationConfig = config.createDefaultGenerationConfig as (() => any) | undefined;
  const value = createDefaultGenerationConfig?.() ?? {};
  const snapshot = createGenerationSnapshot?.(value, { marketId: "taobao", modelId: "gpt-image-2-5", styleId: "minimal", moduleIds: ["hero-kv"] });

  assert.ok(snapshot);
  value.markets[0].label = "已修改市场";
  assert.notEqual(snapshot.market.label, "已修改市场");

  value.markets = value.markets.filter((item: any) => item.id !== "taobao");
  const errors = validateGenerationSelection?.(value, { marketId: "taobao", modelId: "gpt-image-2-5", styleId: "minimal", moduleIds: ["hero-kv"] }) ?? [];
  assert.ok(errors.some((item) => item.includes("电商市场")));
});

test("generation config validation rejects duplicate or empty identifiers", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const value = config.createDefaultGenerationConfig();
  value.markets.push({ ...value.markets[0], id: value.markets[0].id });
  value.models[0].id = "";
  const errors = config.validateGenerationConfig(value);
  assert.ok(errors.some((item: string) => item.includes("市场标识")));
  assert.ok(errors.some((item: string) => item.includes("模型标识")));
});

test("generation config validation resolves concrete prompt versions and rejects retired references", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const value = config.createDefaultGenerationConfig();
  value.marketBindings.taobao = { promptTemplateId: "tpl-market", promptVersionId: "ver-retired" };
  const errors = config.validateGenerationConfig(value, [{ id: "ver-retired", templateId: "tpl-market", versionNo: 1, status: "retired", body: "old", contentSha256: "hash" }]);
  assert.ok(errors.some((item: string) => item.includes("不可用")));
  value.marketBindings.taobao.promptVersionId = "ver-live";
  const validErrors = config.validateGenerationConfig(value, [{ id: "ver-live", templateId: "tpl-market", versionNo: 2, status: "published", body: "live", contentSha256: "hash2" }]);
  assert.equal(validErrors.some((item: string) => item.includes("不可用")), false);
});

test("generation modules can be customized while retaining their section mode", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const value = config.createDefaultGenerationConfig();
  value.heroModules[0] = { ...value.heroModules[0], label: "被改写", mode: "suite" };
  const errors = config.validateGenerationConfig(value);
  assert.equal(errors.some((item: string) => item.includes("内置主图模块")), false);
  assert.ok(errors.some((item: string) => item.includes("主图模块类型")));
});

test("custom style remains valid and keeps its text in the generation snapshot", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const value = config.createDefaultGenerationConfig();
  const selection = { marketId: "taobao", modelId: "gpt-image-2-5", styleId: "style-custom", customStyle: "蓝色棚拍，突出金属质感", moduleIds: ["hero-kv"] };

  const errors = config.validateGenerationSelection(value, selection);
  const snapshot = config.createGenerationSnapshot(value, selection);

  assert.deepEqual(errors, []);
  assert.equal(snapshot.style.label, "自定义");
  assert.equal(snapshot.style.customText, selection.customStyle);
});

test("generation config validation requires market, model, and style detail fields", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const value = config.createDefaultGenerationConfig();
  value.markets[0] = { ...value.markets[0], platforms: "", guidance: "", defaultLanguage: "" };
  value.models[0] = { ...value.models[0], constraints: "" };
  value.styleCategories[0].styles[0] = { ...value.styleCategories[0].styles[0], description: "" };

  const errors = config.validateGenerationConfig(value);

  assert.ok(errors.some((item: string) => item.includes("适用平台")));
  assert.ok(errors.some((item: string) => item.includes("平台规范")));
  assert.ok(errors.some((item: string) => item.includes("默认语言")));
  assert.ok(!errors.some((item: string) => item.includes("模型约束")), "模型说明为选填，不作为提示词约束");
  assert.ok(errors.some((item: string) => item.includes("风格描述")));
});

test("generation selection rejects a resolution unsupported by the selected model", async () => {
  const config = await loadConfigModule() as Record<string, any>;
  const value = config.createDefaultGenerationConfig();

  const errors = config.validateGenerationSelection(value, {
    marketId: "taobao",
    modelId: "flux-pro",
    resolution: "超清 4K",
    moduleIds: ["hero-kv"],
  });

  assert.ok(errors.some((item: string) => item.includes("分辨率")));
});

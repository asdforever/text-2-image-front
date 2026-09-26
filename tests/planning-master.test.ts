import assert from "node:assert/strict";
import test from "node:test";

import { applyModulePlan, canRecoverModulePlan, needsModulePlan, modulePlanRequestInput, modulePlanInputFingerprint, modulePlanMatchesInput } from "../src/lib/planning-master";
import { normalizeHeroConfig, normalizeSuiteConfig, validateSuiteConfig } from "../src/lib/generation-workspace";

const plan = {
  id: "plan-1", mode: "hero" as const, status: "completed" as const, summary: "先建立产品识别，再展示佩戴场景",
  modules: [
    { moduleId: "hero-kv", resultCount: 2, moduleParameters: [{ key: "核心卖点", value: "轻至 180g" }], compositionBrief: "产品居中，卖点置于右上安全区", reason: "先建立识别" },
    { moduleId: "hero-scene", resultCount: 1, moduleParameters: [{ key: "场景地点", value: "通勤地铁" }], compositionBrief: "人物侧身佩戴，保留环境动势", reason: "解释使用场景" },
  ], warnings: [], createdAt: "2026-09-22T00:00:00Z",
};

test("主图和详情旧草稿按一项一张读取，保留顺序参数且不修改原草稿", () => {
  for (const normalize of [normalizeHeroConfig, normalizeSuiteConfig]) {
    const previous = { selectedModuleIds: ["lid", "base"], moduleTypes: { lid: "suite-detail", base: "suite-detail" }, moduleCounts: { lid: 4, base: 2 }, moduleParameters: { lid: [{ key: "内容", value: "杯盖" }] } };
    const next = normalize(previous);
    assert.deepEqual(next.moduleCounts, { lid: 1, base: 1 });
    assert.deepEqual(next.selectedModuleIds, previous.selectedModuleIds);
    assert.deepEqual(next.moduleParameters, previous.moduleParameters);
    assert.deepEqual(previous.moduleCounts, { lid: 4, base: 2 });
  }
});

test("应用旧规划按服务端顺序回填参数，每个任务固定一张图", () => {
  const config = applyModulePlan(normalizeHeroConfig({ planningBrief: "轻量通勤耳机" }), plan);
  assert.deepEqual(config.selectedModuleIds, ["hero-kv", "hero-scene"]);
  assert.deepEqual(config.moduleCounts, { "hero-kv": 1, "hero-scene": 1 });
  assert.deepEqual(config.moduleParameters["hero-kv"], [{ key: "核心卖点", value: "轻至 180g" }, { key: "建议构图简案", value: "产品居中，卖点置于右上安全区" }]);
  assert.equal(config.modulePlanId, "plan-1");
  assert.equal(config.modulePlanFingerprint, modulePlanInputFingerprint(config));
});

test("合并重规划保留用户已编辑的参数，同时清除旧候选张数", () => {
  const edited = normalizeHeroConfig({ selectedModuleIds: ["hero-kv"], moduleCounts: { "hero-kv": 4 }, moduleParameters: { "hero-kv": [{ key: "核心卖点", value: "用户改成全天舒适" }] } });
  const config = applyModulePlan(edited, plan, { preserveEdits: true });
  assert.equal(config.moduleCounts["hero-kv"], 1);
  assert.equal(config.moduleParameters["hero-kv"].find((item) => item.key === "核心卖点")?.value, "用户改成全天舒适");
  assert.equal(config.moduleParameters["hero-kv"].find((item) => item.key === "建议构图简案")?.value, plan.modules[0].compositionBrief);
  assert.deepEqual(config.selectedModuleIds, ["hero-kv", "hero-scene"]);
});

test("输入变化后旧异步规划结果不再匹配当前请求", () => {
  const before = normalizeHeroConfig({ selectedAssetIds: ["asset-1"], market: "taobao", aspectRatio: "1:1", outputLanguage: "中文", planningBrief: "轻量耳机" });
  const requestFingerprint = modulePlanInputFingerprint(before);
  assert.equal(modulePlanMatchesInput(requestFingerprint, before), true);
  assert.equal(modulePlanMatchesInput(requestFingerprint, { ...before, planningBrief: "运动耳机" }), false);
  assert.equal(modulePlanMatchesInput(requestFingerprint, { ...before, selectedAssetIds: ["asset-2"] }), false);
});

test("详情页独立任务可以超过模块目录数量", () => {
  const selectedModuleIds = Array.from({ length: 18 }, (_, index) => `suite-${index}`);
  const config = normalizeSuiteConfig({ selectedAssetIds: ["asset-1"], selectedModuleIds });
  assert.doesNotMatch(validateSuiteConfig(config, 18).join("\n"), /最多选择 5/);
  assert.doesNotMatch(validateSuiteConfig(config, 17).join("\n"), /最多选择/);
});

test("同模块的独立任务各生成一张，参数互不覆盖", () => {
  const result = applyModulePlan(normalizeHeroConfig(), { ...plan, modules: [
    { ...plan.modules[0], taskId: "lid", moduleId: "hero-detail", resultCount: 1, compositionBrief: "杯盖特写" },
    { ...plan.modules[0], taskId: "base", moduleId: "hero-detail", resultCount: 3, compositionBrief: "杯底特写" },
  ] });
  assert.deepEqual(result.selectedModuleIds, ["lid", "base"]);
  assert.deepEqual(result.moduleTypes, { lid: "hero-detail", base: "hero-detail" });
  assert.deepEqual(result.moduleCounts, { lid: 1, base: 1 });
  assert.equal(result.moduleParameters.lid.at(-1)?.value, "杯盖特写");
  assert.equal(result.moduleParameters.base.at(-1)?.value, "杯底特写");
});

test("旧参考套图选择不再触发规划或进入新请求", () => {
  const config = normalizeSuiteConfig({ selectedAssetIds: ["product"], referenceAssetIds: ["ref-cover", "ref-detail"] });
  assert.equal(needsModulePlan(config), false);
  assert.equal(modulePlanRequestInput("suite", config).referenceAssetIds, undefined);
  const briefConfig = normalizeSuiteConfig({ ...config, planningBrief: "展示杯盖密封结构" });
  assert.equal(needsModulePlan(briefConfig), true);
  assert.equal(modulePlanRequestInput("suite", briefConfig).brief, "展示杯盖密封结构");
});

test("重新规划改变任务的模块类型时不移植旧任务编辑", () => {
  const previous = applyModulePlan(normalizeHeroConfig(), { ...plan, modules: [{ ...plan.modules[0], taskId: "one" }] });
  previous.moduleParameters.one = [{ key: "核心卖点", value: "旧模块手改" }];
  const next = applyModulePlan(previous, { ...plan, id: "plan-next", modules: [{ ...plan.modules[1], taskId: "one" }] }, { preserveEdits: true });
  assert.equal(next.moduleParameters.one.some((p) => p.value === "旧模块手改"), false);
});

test("服务端已追加的构图简案只回填一次，旧规划候选张数收敛为一张", () => {
  const config = applyModulePlan(normalizeHeroConfig({ selectedModuleIds: ["hero-kv"], moduleCounts: { "hero-kv": 1 } }), {
    ...plan, modules: [{ ...plan.modules[0], moduleParameters: [...plan.modules[0].moduleParameters, { key: "建议构图简案", value: plan.modules[0].compositionBrief }] }],
  }, { preserveEdits: true });
  assert.equal(config.moduleParameters["hero-kv"].filter((item) => item.key === "建议构图简案").length, 1);
  assert.equal(config.moduleCounts["hero-kv"], 1);
});

test("重新规划替换未编辑的自动内容，保留手改参数并清除旧候选张数", () => {
  const original = applyModulePlan(normalizeHeroConfig(), plan);
  const edited = { ...original, moduleCounts: { ...original.moduleCounts, "hero-scene": 4 }, moduleParameters: { ...original.moduleParameters, "hero-kv": original.moduleParameters["hero-kv"].map((item) => item.key === "核心卖点" ? { ...item, value: "用户指定卖点" } : item) } };
  const next = applyModulePlan(edited, { ...plan, id: "plan-2", modules: plan.modules.map((item) => ({ ...item, resultCount: 3, compositionBrief: "新的构图" })) }, { preserveEdits: true });
  assert.equal(next.moduleCounts["hero-kv"], 1);
  assert.equal(next.moduleCounts["hero-scene"], 1);
  assert.equal(next.moduleParameters["hero-kv"].find((item) => item.key === "核心卖点")?.value, "用户指定卖点");
  assert.equal(next.moduleParameters["hero-kv"].find((item) => item.key === "建议构图简案")?.value, "新的构图");
});

test("恢复逐项匹配服务端输入和模式，编译新资料时即使已有默认模块也需要规划", () => {
  const config = normalizeHeroConfig({ selectedAssetIds: ["asset-1"], selectedModuleIds: ["hero-kv"], planningBrief: "新资料" });
  const matching = { ...plan, input: modulePlanRequestInput("hero", config) };
  assert.equal(needsModulePlan(config), true);
  assert.equal(canRecoverModulePlan(matching, "hero", config), true);
  assert.equal(canRecoverModulePlan(matching, "suite", config), false);
  for (const patch of [{ planningBrief: "其他资料" }, { selectedAssetIds: ["asset-2"] }, { market: "amazon" }, { aspectRatio: "3:4" }, { outputLanguage: "English" }]) {
    assert.equal(canRecoverModulePlan(matching, "hero", { ...config, ...patch }), false);
  }
  const ready = applyModulePlan(config, matching);
  assert.equal(needsModulePlan(ready), false);
  assert.equal(needsModulePlan({ ...ready, planningBrief: "更新资料" }), true);
});

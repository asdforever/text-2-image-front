import assert from "node:assert/strict";
import test from "node:test";
import { applyModulePlan, canRecoverModulePlan, modulePlanRequestInput, needsModulePlan } from "../src/lib/planning-master";
import { normalizeHeroConfig } from "../src/lib/generation-workspace";

const plan = {
  id: "new", mode: "hero" as const, status: "completed" as const,
  planningContractVersion: "commerce-design-v1" as const, sharedVisualDirection: "大字与刻度统一层级",
  summary: "解释性能", warnings: [], createdAt: "2026-09-28",
  modules: [{ taskId: "rate", taskTitle: "解释回报率", moduleId: "hero-freeform", resultCount: 1,
    moduleParameters: [{ key: "主信息", value: "1000 Hz" }], compositionBrief: "大数字配概念刻度",
    reason: "理解报告频率", informationQuestion: "回报率是什么", productPresence: "none" as const,
    visualMechanism: "刻度对应报告间隔", designGuideIds: ["data-explanation"] }],
};

test("设计任务的建议独立保存，风格变更使规划失效", () => {
  const config = normalizeHeroConfig({ styleId: "minimal", planningBrief: "说明回报率", selectedAssetIds: ["source"] });
  const request = modulePlanRequestInput("hero", config);
  assert.equal(request.styleId, "minimal");
  assert.equal(request.customStyle, "");
  const next = applyModulePlan(config, { ...plan, input: request });
  assert.deepEqual(next.moduleParameters.rate, [{ key: "主信息", value: "1000 Hz" }]);
  assert.equal(next.moduleTaskDetails?.rate.title, "解释回报率");
  assert.equal(next.moduleTaskDetails?.rate.compositionAdvice, "大数字配概念刻度");
  assert.equal(needsModulePlan(next), false);
  assert.equal(needsModulePlan({ ...next, styleId: "future" }), true);
  assert.equal(needsModulePlan({ ...next, customStyle: "醒目标题" }), true);
  assert.equal(canRecoverModulePlan({ ...plan, input: request }, "hero", next), true);
  assert.equal(canRecoverModulePlan({ ...plan, input: request, planningContractVersion: undefined }, "hero", next), false);
});

test("重规划保留用户构图要求而更新自动建议", () => {
  const original = applyModulePlan(normalizeHeroConfig(), plan);
  original.moduleParameters.rate.push({ key: "构图要求", value: "标题左上" });
  const next = applyModulePlan(original, { ...plan, modules: [{ ...plan.modules[0], compositionBrief: "数字置中" }] }, { preserveEdits: true });
  assert.equal(next.moduleParameters.rate.find(p => p.key === "构图要求")?.value, "标题左上");
  assert.equal(next.moduleTaskDetails?.rate.compositionAdvice, "数字置中");
});

test("恢复保留同任务手动设计，重新规划和更换类型清掉旧覆盖", () => {
  const original = applyModulePlan(normalizeHeroConfig(), plan);
  original.moduleTaskOverrides = { rate: { productPresence: "context", visualMechanism: "手动场景" }, removed: { productPresence: "none" } };
  const restored = applyModulePlan(original, plan, { preserveEdits: true });
  assert.deepEqual(restored.moduleTaskOverrides, { rate: { productPresence: "context", visualMechanism: "手动场景" } });
  assert.deepEqual(applyModulePlan(original, plan).moduleTaskOverrides, {});
  assert.deepEqual(applyModulePlan(original, { ...plan, modules: [{ ...plan.modules[0], moduleId: "hero-scene" }] }, { preserveEdits: true }).moduleTaskOverrides, {});
});

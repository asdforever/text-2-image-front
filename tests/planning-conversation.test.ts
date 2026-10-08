import assert from "node:assert/strict";
import test from "node:test";
import type { ApiModulePlan } from "../src/api/client";
import { normalizeSuiteConfig } from "../src/lib/generation-workspace";
import { applyModulePlan, modulePlanRequestInput, modulePlanInputFingerprint } from "../src/lib/planning-master";
import { materializeEffectiveSnapshot, applyConversationSnapshot } from "../src/lib/planning-conversation";

function fixture() {
  const config = normalizeSuiteConfig({ creationMode: "regular", selectedAssetIds: ["product"],
    selectedModuleIds: ["detail"], moduleTypes: { detail: "suite-detail" }, planningBrief: "塑料鼠标",
    regularTasks: { detail: { goal: "展示按键", copy: "按键细节" } },
    regularTaskOverrides: { detail: { goal: "展示滚轮", copy: "滚轮细节" } },
    moduleParameters: { detail: [{ key: "自定义展示位置", value: "靠右" }, { key: "避免出现", value: "人物" }] },
  });
  const plan: ApiModulePlan & { snapshot: Record<string, unknown> } = {
    id: "plan", mode: "suite", planningContractVersion: "regular-design-v1", status: "completed",
    input: modulePlanRequestInput("suite", config), summary: "细节", warnings: [], createdAt: "2026-10-08",
    snapshot: { ruleIdentity: "preserve" }, modules: [{ taskId: "detail", moduleId: "suite-detail",
      taskTitle: "细节", reason: "展示按键", suggestedCopy: "按键细节", moduleParameters: [],
      resultCount: 1, compositionBrief: "", informationQuestion: "", productPresence: "full", designGuideIds: [] }],
  };
  return { config, plan };
}

test("effective snapshot carries latest manual text and arbitrary ordered parameters", () => {
  const { config, plan } = fixture();
  const snapshot = materializeEffectiveSnapshot(config, plan);
  assert.equal(snapshot.plan.modules[0].reason, "展示滚轮");
  assert.equal(snapshot.plan.modules[0].suggestedCopy, "滚轮细节");
  assert.deepEqual(snapshot.parameterOverrides.detail, [{ key: "自定义展示位置", value: "靠右" }, { key: "避免出现", value: "人物" }]);
  assert.deepEqual(snapshot.plan.snapshot, { ruleIdentity: "preserve" });
  snapshot.parameterOverrides.detail[0].value = "changed";
  assert.equal(config.moduleParameters.detail[0].value, "靠右");
});

test("applied candidate becomes baseline without obsolete manual override masking it", () => {
  const { config, plan } = fixture();
  const snapshot = materializeEffectiveSnapshot(config, plan);
  snapshot.plan.modules[0].suggestedCopy = "更短标题";
  snapshot.parameterOverrides.detail.push({ key: "任意补充", value: "新值" });
  const applied = applyConversationSnapshot(config, snapshot, "candidate", "version-2");
  assert.deepEqual(applied.regularTasks?.detail, { goal: "展示滚轮", copy: "更短标题" });
  assert.deepEqual(applied.regularTaskOverrides, {});
  assert.equal(applied.modulePlanId, "candidate");
  assert.equal(applied.planningAppliedVersionId, "version-2");
  assert.equal(applied.modulePlanFingerprint, modulePlanInputFingerprint(applied));
  assert.equal(applied.moduleParameters.detail.at(-1)?.key, "任意补充");
});

test("professional snapshot preserves task designs and manual composition parameter", () => {
  const { config, plan } = fixture();
  config.creationMode = "professional";
  plan.planningContractVersion = "commerce-design-v1";
  plan.input = modulePlanRequestInput("suite", config);
  config.moduleTaskOverrides = { detail: { taskTitle: "真实滚轮", productPresence: "detail", visualMechanism: "滚轮微距" } };
  config.moduleParameters.detail.push({ key: "构图要求", value: "留白在左" });
  const snapshot = materializeEffectiveSnapshot(config, plan);
  assert.equal(snapshot.plan.modules[0].taskTitle, "真实滚轮");
  assert.equal(snapshot.plan.modules[0].productPresence, "detail");
  assert.equal(snapshot.parameterOverrides.detail.at(-1)?.value, "留白在左");
  const applied = applyConversationSnapshot(config, snapshot, "pro", "v1");
  assert.equal(applied.moduleTaskDetails?.detail.title, "真实滚轮");
  assert.deepEqual(applied.moduleTaskOverrides, {});
});

test("candidate from another mode is rejected without changing draft", () => {
  const { config, plan } = fixture();
  const snapshot = materializeEffectiveSnapshot(config, plan);
  snapshot.plan.planningContractVersion = "commerce-design-v1";
  assert.throws(() => applyConversationSnapshot(config, snapshot, "other", "v"));
  assert.equal(config.regularTaskOverrides?.detail.copy, "滚轮细节");
});

test("manual deletion and reordering reflect actual visible tasks", () => {
  const { config, plan } = fixture();
  plan.modules.push({ ...plan.modules[0], taskId: "deleted", taskTitle: "删除的任务" });
  const snapshot = materializeEffectiveSnapshot(config, plan);
  assert.deepEqual(snapshot.plan.modules.map(m => m.taskId), ["detail"]);
});

test("ordinary replan cannot carry applied version identity from a different plan", () => {
  const { config, plan } = fixture();
  config.planningAppliedVersionId = "old-conversation-version";
  const next = applyModulePlan(config, { ...plan, id: "new-auto-plan" });
  assert.equal(next.planningAppliedVersionId, undefined);
});

test("professional auto presence is retained until a candidate explicitly changes it", () => {
  const { config, plan } = fixture();
  config.creationMode = "professional";
  plan.planningContractVersion = "commerce-design-v1";
  config.moduleTaskOverrides = { detail: { productPresence: "auto" } };
  const snapshot = materializeEffectiveSnapshot(config, plan);
  assert.deepEqual(snapshot.taskDesignOverrides?.detail, { productPresence: "auto" });
  const applied = applyConversationSnapshot(config, snapshot, "candidate", "v2");
  assert.equal(applied.moduleTaskOverrides?.detail.productPresence, "auto");
});

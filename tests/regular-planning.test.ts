import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../src/lib/generation-workspace";
import { applyModulePlan, canCompileRegular, canRecoverModulePlan, modulePlanInputFingerprint, modulePlanRequestInput, needsModulePlan, type ModulePlan } from "../src/lib/planning-master";

const regular = () => normalizeHeroConfig({ creationMode: "regular", selectedAssetIds: ["product"], planningBrief: "Capacity: 500ml; material: steel", selectedModuleIds: ["detail", "spec"], moduleTypes: { detail: "hero-detail", spec: "hero-overview" }, userNotes: "No people" });
const plan = (config = regular()): ModulePlan => ({
  id: "regular-plan", mode: "hero", planningContractVersion: "regular-design-v1", status: "completed", input: modulePlanRequestInput("hero", config), summary: "Product details", warnings: [], createdAt: "2026-09-28",
  modules: config.selectedModuleIds.map(taskId => ({ taskId, moduleId: config.moduleTypes![taskId], taskTitle: taskId, reason: "Show capacity", suggestedCopy: "500ml", moduleParameters: [{ key: "Capacity", value: "500ml" }], resultCount: 1, compositionBrief: "", informationQuestion: "", productPresence: "full", designGuideIds: [] })),
});

test("new drafts default to regular; existing drafts retain professional mode", () => {
  for (const normalize of [normalizeHeroConfig, normalizeSuiteConfig]) {
    assert.equal(normalize().creationMode, "regular");
    assert.equal(normalize({ planningBrief: "existing" }).creationMode, "professional");
  }
});

test("regular planning transports ordered task identities and notes", () => {
  const input = modulePlanRequestInput("hero", regular());
  assert.equal(input.creationMode, "regular");
  assert.equal(input.userNotes, "No people");
  assert.deepEqual(input.selectedModules, [{ taskId: "detail", moduleId: "hero-detail" }, { taskId: "spec", moduleId: "hero-overview" }]);
});

test("regular fingerprints invalidate on selection, notes, or mode changes", () => {
  const config = regular();
  const fingerprint = modulePlanInputFingerprint(config);
  for (const patch of [{ selectedModuleIds: ["spec"] }, { selectedModuleIds: ["spec", "detail"] }, { userNotes: "Different" }, { creationMode: "professional" as const }]) {
    assert.notEqual(modulePlanInputFingerprint({ ...config, ...patch }), fingerprint);
  }
});

test("regular plan allocates facts and short copy, preserving explicit edits on replan", () => {
  const first = applyModulePlan(regular(), plan());
  assert.equal(needsModulePlan(first), false);
  assert.deepEqual(first.regularTasks?.detail, { goal: "Show capacity", copy: "500ml" });
  assert.deepEqual(first.moduleParameters.spec, [{ key: "Capacity", value: "500ml" }]);
  const edited = { ...first, regularTaskOverrides: { detail: { goal: "Show material", copy: "Steel" } } };
  const next = applyModulePlan(edited, plan(), { preserveEdits: true });
  assert.deepEqual(next.regularTaskOverrides?.detail, { goal: "Show material", copy: "Steel" });
  assert.equal(canRecoverModulePlan(plan(), "hero", first), true);
  assert.equal(canRecoverModulePlan(plan(), "hero", { ...first, creationMode: "professional" }), false);
});

test("regular compilation does not require a planning brief", () => {
  const config = regular();
  assert.equal(canCompileRegular(config), true);
  assert.equal(needsModulePlan({ ...config, planningBrief: "" }), false);
  assert.equal(canCompileRegular({ ...config, selectedAssetIds: [] }), false);
  assert.equal(canCompileRegular({ ...config, selectedModuleIds: [] }), false);
});

test("recommended regular modules recover after selection is filled and reject later changes", () => {
  const input = regular(); input.selectedModuleIds = [];
  const recommendation = { ...plan(), input: modulePlanRequestInput("hero", input) };
  const applied = applyModulePlan(input, recommendation);
  assert.equal(canRecoverModulePlan(recommendation, "hero", applied), true);
  assert.equal(canRecoverModulePlan(recommendation, "hero", { ...applied, selectedModuleIds: ["detail"] }), false);
  assert.equal(needsModulePlan({ ...applied, planningBrief: "Updated facts" }), true);
  assert.equal(needsModulePlan({ ...applied, planningBrief: "" }), false);
});

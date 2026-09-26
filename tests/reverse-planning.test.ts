import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeHeroConfig } from "../src/lib/generation-workspace";
import { applyModulePlan, canRecoverModulePlan, hasPlanningInput, modulePlanInputFingerprint, modulePlanRequestInput } from "../src/lib/planning-master";
import { reverseBindingConfigPatch, moduleReverseReference } from "../src/features/reverse-projects/planning";
import type { ReverseBinding } from "../src/api/reverse-projects";

test("changing the fixed reference version invalidates an old master result", () => {
  const first = normalizeHeroConfig({ selectedAssetIds: ["product"], reverseVersionId: "v1" });
  const next = { ...first, reverseVersionId: "v2" };
  assert.equal(hasPlanningInput(first), true);
  assert.notEqual(modulePlanInputFingerprint(first), modulePlanInputFingerprint(next));
  assert.equal(modulePlanRequestInput("hero", first).reverseVersionId, "v1");
  const plan = { id: "plan", mode: "hero" as const, status: "completed" as const, input: modulePlanRequestInput("hero", first), summary: "", modules: [], warnings: [], createdAt: "" };
  assert.equal(canRecoverModulePlan(plan, "hero", next), false);
});

test("server bindings remain isolated by business project and target workbench", () => {
  const base = { id: "b", projectId: "p1", projectName: "one", target: "hero", scope: "overall", versionId: "v1", reverseProjectId: "r", reverseProjectName: "reference", versionNo: 1, targetModuleId: null, sourceModuleId: null, sourceModuleTitle: null, createdAt: "" } as ReverseBinding;
  const config = normalizeHeroConfig({ reverseVersionId: "old", modulePlanId: "old-plan", modulePlanFingerprint: "old", modulePlanReferences: { first: { versionId: "old", moduleId: "m-old" } } });
  const patch = reverseBindingConfigPatch(config, [base, { ...base, id: "other", projectId: "p2", versionId: "wrong" }, { ...base, id: "suite", target: "suite", versionId: "wrong-suite" }], "p1", "hero");
  assert.equal(patch.reverseVersionId, "v1");
  assert.equal(patch.modulePlanId, undefined);
  assert.deepEqual(patch.modulePlanReferences, {});
});

test("master assigns local module references and explicit overrides take priority", () => {
  const config = normalizeHeroConfig({ reverseVersionId: "v1", reverseModuleReferences: { lid: { versionId: "v-other", moduleId: "zoom" } } });
  const planned = applyModulePlan(config, { id: "plan", mode: "hero", status: "completed", summary: "", createdAt: "", warnings: [], modules: [
    { moduleId: "hero-detail", taskId: "lid", resultCount: 1, moduleParameters: [], compositionBrief: "杯盖", reason: "结构", referenceModuleId: "layout-one" },
    { moduleId: "hero-detail", taskId: "base", resultCount: 1, moduleParameters: [], compositionBrief: "杯底", reason: "结构", referenceModuleId: "layout-two" },
  ] });
  assert.deepEqual(moduleReverseReference(planned, "lid"), { versionId: "v-other", moduleId: "zoom" });
  assert.deepEqual(moduleReverseReference(planned, "base"), { versionId: "v1", moduleId: "layout-two" });
  assert.equal(moduleReverseReference({ ...planned, reverseVersionId: "v2" }, "base"), undefined);
});

test("unchanged server binding does not erase a valid planning result or local edits", () => {
  const config = normalizeHeroConfig({ planningBrief: "使用当前商品参数", modulePlanId: "valid", modulePlanFingerprint: "fingerprint" });
  const patch = reverseBindingConfigPatch(config, [], "p1", "suite");
  assert.equal("modulePlanId" in patch, false);
  assert.equal("planningBrief" in patch, false);
});

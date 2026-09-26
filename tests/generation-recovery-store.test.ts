import assert from "node:assert/strict";
import test from "node:test";
import { useProjectStore } from "../src/store/useProjectStore";

for (const action of ["resetDemoData", "clearAllData"] as const) {
  test(`${action} clears persisted recovery sessions for both modes`, () => {
    useProjectStore.getState().saveHeroGenerationSession("p1", { inputFingerprint: "x", compileIdempotencyKey: "h", confirmIdempotencyKey: "c", promptBatchId: "b", moduleTaskPrompts: { kv: "edited" } });
    useProjectStore.getState().saveSuiteGenerationSession("p1", { compileIdempotencyKey: "s", planId: "plan" });
    useProjectStore.getState()[action]();
    assert.deepEqual(useProjectStore.getState().heroGenerationSessions, {});
    assert.deepEqual(useProjectStore.getState().suiteGenerationSessions, {});
  });
}

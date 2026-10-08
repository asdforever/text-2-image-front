import test from "node:test";
import assert from "node:assert/strict";
import { useProjectStore } from "../src/store/useProjectStore";
for (const mode of ["hero", "suite"] as const) test(`${mode} creation scopes restore their plan IDs and unsynced arbitrary manual parameters`, () => {
  useProjectStore.setState({ generationDrafts: {} });
  const update = useProjectStore.getState().updateGenerationDraft;
  update("scope-test", mode, { creationMode: "regular", planningBrief: "商品事实", modulePlanId: "regular-plan", planningConversationId: "regular-session", moduleParameters: { task: [{ key: "任意常规参数", value: "手改未同步" }] } });
  update("scope-test", mode, { creationMode: "professional" });
  assert.equal(useProjectStore.getState().generationDrafts[`scope-test:${mode}`].config.modulePlanId, undefined);
  update("scope-test", mode, { modulePlanId: "pro-plan", planningConversationId: "pro-session", moduleParameters: { task: [{ key: "任意专业参数", value: "独立参数" }] } });
  update("scope-test", mode, { creationMode: "regular" });
  let current = useProjectStore.getState().generationDrafts[`scope-test:${mode}`].config;
  assert.equal(current.modulePlanId, "regular-plan"); assert.equal(current.planningConversationId, "regular-session"); assert.equal(current.moduleParameters.task[0].value, "手改未同步");
  update("scope-test", mode, { creationMode: "professional" });
  current = useProjectStore.getState().generationDrafts[`scope-test:${mode}`].config;
  assert.equal(current.modulePlanId, "pro-plan"); assert.equal(current.planningConversationId, "pro-session"); assert.equal(current.moduleParameters.task[0].key, "任意专业参数");
});

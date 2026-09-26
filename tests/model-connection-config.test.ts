import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultGenerationConfig, createGenerationSnapshot, validateGenerationConfig, validateGenerationSelection } from "../src/lib/generation-config";
import { normalizePersistedGenerationConfigState } from "../src/store/useGenerationConfigStore";

test("旧模型提示词不阻塞配置保存，也不进入新生成快照", () => {
  const config = createDefaultGenerationConfig();
  config.modelBindings[config.models[0].id] = { promptTemplateId: "old-model", promptVersionId: "retired", body: "旧模型提示词" };
  assert.deepEqual(validateGenerationConfig(config), []);
  const snapshot = createGenerationSnapshot(config, { marketId: "taobao", modelId: config.models[0].id, moduleIds: ["hero-kv"] });
  assert.equal(snapshot.promptBindings.some((binding) => binding.slot === "model"), false);
});

test("模型能力限制拒绝不支持的比例", () => {
  const config = createDefaultGenerationConfig();
  Object.assign(config.models[0], { aspectRatios: ["1:1", "4:3"] });
  assert.ok(validateGenerationSelection(config, { marketId: "taobao", modelId: config.models[0].id, aspectRatio: "9:16", moduleIds: ["hero-kv"] }).some((error) => error.includes("比例")));
});

test("配置恢复保留连接引用与比例但丢弃模型凭据", () => {
  const config = createDefaultGenerationConfig();
  Object.assign(config.models[0], { connectionId: "connection-a", aspectRatios: ["1:1"], apiKey: "test-secret-must-not-persist" });
  const state = normalizePersistedGenerationConfigState({ published: config, draft: config });
  assert.equal((state.draft.models[0] as any).connectionId, "connection-a");
  assert.deepEqual((state.draft.models[0] as any).aspectRatios, ["1:1"]);
  assert.equal(JSON.stringify(state).includes("test-secret-must-not-persist"), false);
});

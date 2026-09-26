import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultGenerationConfig, validateGenerationConfig } from "../src/lib/generation-config";
import { normalizePersistedGenerationConfigState, useGenerationConfigStore } from "../src/store/useGenerationConfigStore";

test("prompt model selection stays in draft until accepted publication and excludes credentials", () => {
  const initial = createDefaultGenerationConfig();
  const store = useGenerationConfigStore;
  store.getState().hydrateRemote(initial, initial, 1);
  store.getState().setPromptModel({ connectionId: "chat-connection" });
  assert.equal(store.getState().published.promptModel ?? null, null);
  assert.deepEqual(store.getState().draft.promptModel, { connectionId: "chat-connection" });
  assert.equal(store.getState().isDirty, true);
  const restored = normalizePersistedGenerationConfigState({ draft: {
    ...store.getState().draft, promptModel: { connectionId: "chat-connection", apiKey: "must-not-persist" },
  } });
  assert.deepEqual(restored.draft.promptModel, { connectionId: "chat-connection" });
  const published = { ...store.getState().draft, version: 2 };
  store.getState().acceptPublished(published);
  assert.deepEqual(store.getState().published.promptModel, { connectionId: "chat-connection" });
  store.getState().setPromptModel(null);
  assert.equal(store.getState().draft.promptModel, null);
  assert.deepEqual(store.getState().published.promptModel, { connectionId: "chat-connection" });
  store.getState().resetConfig();
});

test("empty prompt-model references cannot be saved, legacy configs remain valid", () => {
  const config = createDefaultGenerationConfig();
  assert.deepEqual(validateGenerationConfig(config), []);
  config.promptModel = { connectionId: " " };
  assert.ok(validateGenerationConfig(config).length > 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultGenerationConfig } from "../src/lib/generation-config";
import { useGenerationConfigStore } from "../src/store/useGenerationConfigStore";


test("远程配置状态只在发布成功后提升已发布版本", () => {
  useGenerationConfigStore.getState().resetConfig();
  const published = createDefaultGenerationConfig();
  const draft = { ...createDefaultGenerationConfig(), markets: createDefaultGenerationConfig().markets.map((market) => market.id === "taobao" ? { ...market, label: "服务端草稿" } : market) };

  useGenerationConfigStore.getState().hydrateRemote(published, draft, 1);
  useGenerationConfigStore.getState().updateDraft((value) => ({
    ...value,
    markets: value.markets.map((market) => market.id === "taobao" ? { ...market, label: "本次编辑" } : market),
  }));
  useGenerationConfigStore.getState().acceptSavedDraft(useGenerationConfigStore.getState().draft, 1);

  assert.equal(useGenerationConfigStore.getState().published.markets[0].label, "淘宝");
  assert.equal(useGenerationConfigStore.getState().draft.markets[0].label, "本次编辑");
  assert.equal(useGenerationConfigStore.getState().draftBaseVersion, 1);
  assert.equal(useGenerationConfigStore.getState().isDirty, false);

  const released = { ...useGenerationConfigStore.getState().draft, version: 2 };
  useGenerationConfigStore.getState().acceptPublished(released);
  assert.equal(useGenerationConfigStore.getState().published.version, 2);
  assert.equal(useGenerationConfigStore.getState().published.markets[0].label, "本次编辑");
  assert.equal(useGenerationConfigStore.getState().draftBaseVersion, 2);
});

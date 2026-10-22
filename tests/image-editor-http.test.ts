import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { initialDraft, operationFromDraft, draftFromOperation, freshId } from "../src/components/image-canvas/image-editor-model";

for (const [name, cryptoApi] of [
  ["HTTP browser without randomUUID", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }],
  ["browser without crypto", undefined],
] as const) {
  test(`image editing creates and restores operations in ${name}`, () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: cryptoApi });
    try {
      const draft = { ...initialDraft(1200, 800), tool: "prompt_edit" as const, prompt: "保留商品，替换背景" };
      assert.ok(draft.id.length > 0);
      const operation = operationFromDraft(draft, "generated-version");
      assert.equal(operation.operationId, draft.id);
      assert.equal(operation.sourceVersionId, "generated-version");
      assert.equal(operation.payload.prompt, "保留商品，替换背景");
      assert.equal(draftFromOperation(operation, 1200, 800).id, draft.id);
      const ids = Array.from({ length: 256 }, () => freshId());
      assert.equal(new Set(ids).size, ids.length);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
      else Reflect.deleteProperty(globalThis, "crypto");
    }
  });
}

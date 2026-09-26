import { strict as assert } from "node:assert";
import { test } from "node:test";
import { suiteApi } from "../src/api/client";

test("工作台任务编辑请求携带当前修订", async () => {
  const previousFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = (async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ data: { id: "task-1" }, requestId: "req-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await suiteApi.updateTask("task-1", { expectedRevision: 4, promptDraft: "新提示词" });
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.deepEqual(JSON.parse(requestBody), { expectedRevision: 4, promptDraft: "新提示词" });
});

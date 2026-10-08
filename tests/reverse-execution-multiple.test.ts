import assert from "node:assert/strict";
import test from "node:test";
import { reverseExecutionApi } from "../src/api/reverse-execution";

test("反推的保存和历史重试携带独立方案及批次ID", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ data: [] }), { headers: { "content-type": "application/json" } });
  };
  try {
    await reverseExecutionApi.list("project");
    await reverseExecutionApi.get("project", "plan-a");
    await reverseExecutionApi.save("project", 2, { versionId: "v", referenceCount: 0, tasks: [] }, "plan-a");
    await reverseExecutionApi.generateImages("project", 3, { planId: "plan-a", batchId: "batch-1", taskIds: ["task-a"] });
    assert.match(calls[0].url, /reverse-execution\/plans$/);
    assert.match(calls[1].url, /planId=plan-a/);
    assert.equal(calls[2].body.planId, "plan-a");
    assert.equal(calls[3].body.batchId, "batch-1");
  } finally { globalThis.fetch = original; }
});

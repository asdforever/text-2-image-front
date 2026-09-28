import assert from "node:assert/strict";
import test from "node:test";
import { getRetryableBatchSlotIds, retryBatchSlots } from "../src/lib/batch-retry";

test("批量重试只选择可重试槽位", () => {
  const ids = getRetryableBatchSlotIds([
    { id: "success", status: "succeeded" },
    { id: "failed", status: "failed" },
    { id: "cancelled", status: "cancelled" },
    { id: "needs-retry", status: "needs_retry" },
    { id: "queued", status: "queued" },
  ]);

  assert.deepEqual(ids, ["failed", "cancelled", "needs-retry"]);
});

test("批量重试会继续提交后续槽位并返回提交结果", async () => {
  const attempted: string[] = [];
  const result = await retryBatchSlots(["first", "second", "third"], async (id) => {
    attempted.push(id);
    if (id === "second") throw new Error("temporary failure");
  });

  assert.deepEqual(attempted, ["first", "second", "third"]);
  assert.deepEqual(result, { submitted: 2, failed: 1 });
});

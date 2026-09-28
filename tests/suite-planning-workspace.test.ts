import assert from "node:assert/strict";
import test from "node:test";
import { suiteConfirmationKey } from "../src/lib/suite-prompt-draft";
import { readSuitePlanForRecovery } from "../src/lib/suite-plan-recovery";

test("套图恢复在旧幂等键查不到时回退到最新方案", async () => {
  const latest = { id: "latest-plan" } as any;
  const recovered = await readSuitePlanForRecovery(
    { compileIdempotencyKey: "stale-key" },
    async () => null,
    async () => ({ id: "unexpected" } as any),
    async () => latest,
  );
  assert.equal(recovered, latest);
});

test("相同方案的确认重试复用幂等键，编辑提示词或切换方案生成新键", () => {
  const first = suiteConfirmationKey({ prompts: {} }, "plan-1", { a: "首屏", b: "卖点" });
  const retry = suiteConfirmationKey(first, "plan-1", { b: "卖点", a: " 首屏 " });
  assert.equal(retry.confirmKey, first.confirmKey);
  assert.notEqual(suiteConfirmationKey(first, "plan-1", { a: "新的首屏", b: "卖点" }).confirmKey, first.confirmKey);
  assert.notEqual(suiteConfirmationKey(first, "plan-2", { a: "首屏", b: "卖点" }).confirmKey, first.confirmKey);
});

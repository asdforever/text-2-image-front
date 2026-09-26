import assert from "node:assert/strict";
import test from "node:test";
import type { ApiImageEditTask } from "../src/api/client";
import { isImageEditTaskActive, pollImageEditTask } from "../src/lib/image-editing-task";

const task = (status: string): ApiImageEditTask => ({
  id: "task-1",
  sessionId: "session-1",
  revision: 1,
  status,
  operations: [],
  sourceSnapshot: {},
  promptSnapshot: {},
  configSnapshot: {},
  attempts: [],
  currentVersionId: null,
  finalVersionId: null,
});

test("白底图任务在排队和生成中都保持轮询", async () => {
  assert.equal(isImageEditTaskActive("queued"), true);
  assert.equal(isImageEditTaskActive("generating"), true);
  assert.equal(isImageEditTaskActive("succeeded"), false);

  const statuses = ["generating", "succeeded"];
  const polled = await pollImageEditTask(task("queued"), async () => task(statuses.shift()!), {
    intervalMs: 0,
    sleep: async () => undefined,
  });

  assert.equal(polled.status, "succeeded");
});

test("轮询达到上限时返回最新任务状态", async () => {
  let requests = 0;
  const polled = await pollImageEditTask(task("generating"), async () => {
    requests += 1;
    return task("generating");
  }, { maxAttempts: 2, intervalMs: 0, sleep: async () => undefined });

  assert.equal(requests, 2);
  assert.equal(polled.status, "generating");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/PromptMarketplacePage.tsx", "utf8");
const client = readFileSync("src/api/client.ts", "utf8");

test("request() throws ApiResultUnknownError when response data is missing", () => {
  assert.match(client, /class ApiResultUnknownError extends Error/);
  assert.match(client, /ApiResultUnknownError/);
  assert.match(client, /throw new ApiResultUnknownError/);
});

test("create dialog uses onMouseDown instead of onClick for backdrop close", () => {
  // The creating backdrop should use onMouseDown, not onClick
  assert.match(page, /prompt-detail-backdrop.*onMouseDown/);
  // Extract the creating dialog block (between 'creating &&' and the closing '</div>}')
  const creatingBlock = page.slice(page.indexOf("{creating &&"), page.indexOf("{selected &&"));
  assert.match(creatingBlock, /onMouseDown/);
  assert.doesNotMatch(creatingBlock, /onClick=\{[^}]*setCreating\(false\)/);
});

test("create dialog checks event.target === event.currentTarget for backdrop", () => {
  assert.match(page, /event\.target === event\.currentTarget/);
});

test("create dialog confirms before closing with dirty form", () => {
  assert.match(page, /confirm\(/);
  assert.match(page, /isDirty/);
  assert.match(page, /confirmClose/);
});

test("create error distinguishes ApiResultUnknownError from regular errors", () => {
  assert.match(page, /ApiResultUnknownError/);
  assert.match(page, /创建结果未确认/);
});

test("createPromptTemplate accepts and sends idempotency key", () => {
  assert.match(client, /createPromptTemplate\(body.*idempotencyKey/);
  assert.match(client, /idempotency-key.*idempotencyKey/);
});

test("createPromptVersion accepts and sends idempotency key", () => {
  assert.match(client, /createPromptVersion\(templateId.*idempotencyKey/);
});

test("marketplace page generates and uses idempotency key for create", () => {
  assert.match(page, /idempotencyKey/);
  assert.match(page, /createIdempotencyKey/);
});

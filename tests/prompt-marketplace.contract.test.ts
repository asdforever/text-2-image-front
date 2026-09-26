import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/PromptMarketplacePage.tsx", "utf8");
const client = readFileSync("src/api/client.ts", "utf8");
const promptDetail = readFileSync("src/components/PromptMarketplace/PromptDetailPanel.tsx", "utf8");
const promptTestTab = readFileSync("src/components/PromptMarketplace/tabs/PromptTestTab.tsx", "utf8");

test("prompt marketplace groups templates and exposes version editing", () => {
  assert.match(page, /versionCount/);
  assert.match(page, /基于此版本编辑/);
  assert.match(page, /保存为新版本/);
  assert.match(page, /fileSyncStatus/);
});

test("empty marketplace exposes a new prompt form", () => {
  assert.match(page, /新建提示词/);
  assert.match(page, /createPromptTemplate/);
  assert.match(page, /code/);
  assert.match(page, /executionTarget/);
});

test("prompt api client targets FastAPI version endpoints", () => {
  assert.match(client, /createPromptVersion/);
  assert.match(client, /prompt-versions/);
  assert.doesNotMatch(client, /prompt-templates\/\$\{encodeURIComponent\(versionId\)\}\/publish/);
});

test("new prompt form uses a dedicated responsive layout", () => {
  assert.match(page, /prompt-create-form/);
  assert.match(page, /prompt-create-meta/);
  assert.match(page, /prompt-create-actions/);
  assert.match(readFileSync("src/index.css", "utf8"), /\.prompt-create-form/);
});

test("marketplace keeps search separate from the create action", () => {
  assert.match(page, /marketplace-search-field/);
  assert.match(page, /marketplace-create-button/);
});

test("creating a prompt exposes loading and API errors in the dialog", () => {
  assert.match(page, /creatingPrompt/);
  assert.match(page, /createError/);
  assert.match(page, /role="alert"/);
  assert.match(page, /disabled=\{creatingPrompt\}/);
});

test("提示词测试成功后显示自动入测试库状态", () => {
  assert.match(promptTestTab, /已自动保存到测试库/);
  assert.match(promptTestTab, /打开测试库/);
  assert.doesNotMatch(promptTestTab, /保存到成品库/);
  assert.doesNotMatch(promptDetail, /saveTestResultToProductLibrary/);
});

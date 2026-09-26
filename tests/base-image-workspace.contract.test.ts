import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/BaseImageWorkspace.tsx", "utf8");
const client = readFileSync("src/api/client.ts", "utf8");

test("白底图工作区提供区分明确的上传入口而不是素材类型下拉框", () => {
  assert.doesNotMatch(page, /素材类型/);
  assert.match(page, /上传原图/);
  assert.match(page, /上传已有白底图/);
});

test("白底图提示词选择器读取提示词商城完整列表", () => {
  assert.match(page, /listPromptTemplates\(\)/);
  assert.doesNotMatch(page, /listPromptTemplates\("base_refine"\)/);
  assert.doesNotMatch(page, /仅展示 `base_refine` 阶段提示词/);
});

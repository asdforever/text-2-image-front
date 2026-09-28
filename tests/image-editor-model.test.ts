import { test } from "node:test";
import assert from "node:assert/strict";
import { initialDraft, operationFromDraft, draftFromOperation, validateDraft, cropForRatio } from "../src/components/image-canvas/image-editor-model";

test("新文字只保存内容、区域和效果要求，自动排版不附带默认字号", () => {
  const draft = { ...initialDraft(1000, 1000), tool: "add_text" as const, text: "新品上市", prompt: "暖色手写标题，与背景协调" };
  assert.equal(validateDraft(draft), "");
  const operation = operationFromDraft(draft, "source");
  assert.equal("textStyle" in operation.payload, false);
  assert.equal(operation.payload.prompt, draft.prompt);
  assert.deepEqual(operation.payload.region, draft.region);
  const restored = draftFromOperation(operation, 1000, 1000);
  assert.equal(restored.textStyle, undefined);
  assert.deepEqual(operationFromDraft(restored, "source"), operation);
});

test("文字样式与精确内容进入操作快照，重新打开可继续编辑", () => {
  const draft = { ...initialDraft(1000, 1000), tool: "add_text" as const, text: "限时新品", textStyle: { fontFamily: "SimSun", fontSize: 64, color: "#112233", align: "left" as const, strokeColor: "#ffffff", strokeWidth: 2 } };
  const operation = operationFromDraft(draft, "source");
  assert.equal(operation.payload.schemaVersion, 2);
  assert.equal(operation.payload.text, "限时新品");
  const restored = draftFromOperation(operation, 1000, 1000);
  assert.deepEqual(restored.textStyle, draft.textStyle);
  assert.equal(restored.id, draft.id);
});
test("旧会话省略描边宽度时仍可提交，保留原有手动样式", () => {
  const operation = { operationId: "legacy", type: "add_text", summary: "添加文本：旧标题", sourceVersionId: "source", payload: { text: "旧标题", region: { x: .2, y: .4, width: .6, height: .15, rotation: 0 }, textStyle: { fontSize: 64 } } };
  const restored = draftFromOperation(operation, 1000, 1000);
  assert.equal(validateDraft(restored), "");
  assert.deepEqual(operationFromDraft(restored, "source").payload.textStyle, { fontSize: 64 });
});
test("局部移除无需额外提示词，空选区不能提交", () => {
  const draft = { ...initialDraft(1000, 1000), tool: "inpaint" as const, action: "erase" as const };
  assert.ok(validateDraft(draft));
  draft.strokes = [{ mode: "draw", width: .1, points: [{ x: .5, y: .5 }] }];
  assert.equal(validateDraft(draft), "");
  assert.equal(operationFromDraft(draft, "source").type, "erase");
});
test("裁剪比例居中且保留输出尺寸校验", () => {
  assert.deepEqual(cropForRatio("1:1", 1000, 500), { x: .25, y: 0, width: .5, height: 1, rotation: 0 });
  assert.ok(validateDraft({ ...initialDraft(1000, 1000), tool: "crop_resize", width: 999999 }));
});

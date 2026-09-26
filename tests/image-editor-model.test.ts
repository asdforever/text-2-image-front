import { test } from "node:test";
import assert from "node:assert/strict";
import { initialDraft, operationFromDraft, draftFromOperation, validateDraft, cropForRatio } from "../src/components/image-canvas/image-editor-model";

test("文字样式与精确内容进入操作快照，重新打开可继续编辑", () => {
  const draft = { ...initialDraft(1000, 1000), tool: "add_text" as const, text: "限时新品", textStyle: { fontFamily: "SimSun", fontSize: 64, color: "#112233", align: "left" as const, strokeColor: "#ffffff", strokeWidth: 2 } };
  const operation = operationFromDraft(draft, "source");
  assert.equal(operation.payload.schemaVersion, 2);
  assert.equal(operation.payload.text, "限时新品");
  const restored = draftFromOperation(operation, 1000, 1000);
  assert.deepEqual(restored.textStyle, draft.textStyle);
  assert.equal(restored.id, draft.id);
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

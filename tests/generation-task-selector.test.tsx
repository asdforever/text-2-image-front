import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationTaskSelector } from "../src/components/generation-workspace/GenerationTaskSelector";
import { normalizeHeroConfig } from "../src/lib/generation-workspace";

test("任务卡显示信息目标和不出现产品的设计，构图要求单独可编辑", () => {
  const html = renderToStaticMarkup(<GenerationTaskSelector modules={[{ id: "hero-freeform", mode: "hero", label: "自由创意", description: "按目标表达" }]}
    config={normalizeHeroConfig({ selectedModuleIds: ["rate"], moduleTypes: { rate: "hero-freeform" },
      moduleTaskDetails: { rate: { title: "解释回报率", informationQuestion: "回报率是什么", productPresence: "none", visualMechanism: "数字与刻度对应", compositionAdvice: "大数字居中" } } })}
    onChange={() => {}} />);
  assert.match(html, /解释回报率/);
  assert.match(html, /回报率是什么/);
  assert.match(html, /不出现/);
  assert.match(html, /大数字居中/);
  assert.match(html, /构图要求/);
  assert.doesNotMatch(html, /data-explanation|commerce-design-v1/);
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationTaskSelector } from "../src/components/generation-workspace/GenerationTaskSelector";
import { TaskDesignEditor } from "../src/components/generation-workspace/TaskDesignEditor";
import { normalizeHeroConfig } from "../src/lib/generation-workspace";

test("手动新增任务无需规划大师即可编辑出场和表达", () => {
  const html = renderToStaticMarkup(<TaskDesignEditor onChange={() => {}} onReset={() => {}} />);
  assert.match(html, /<select[^>]*aria-label="商品出场"/);
  assert.match(html, /value="none"/);
  assert.match(html, /本图要讲什么/);
  assert.match(html, /表达方式/);
  assert.doesNotMatch(html, /任务标题/);
});

test("任务卡默认显示目标与表达摘要，不铺开表单或高级建议", () => {
  const html = renderToStaticMarkup(<GenerationTaskSelector modules={[{ id: "hero-freeform", mode: "hero", label: "自由创意", description: "按目标表达" }]}
    config={normalizeHeroConfig({ selectedModuleIds: ["rate"], moduleTypes: { rate: "hero-freeform" },
      moduleTaskDetails: { rate: { title: "解释回报率", informationQuestion: "回报率是什么", productPresence: "none", visualMechanism: "数字与刻度对应", compositionAdvice: "大数字居中" } } })}
    onChange={() => {}} />);
  assert.match(html, /解释回报率/);
  assert.match(html, /回报率是什么/);
  assert.match(html, /不出现/);
  assert.match(html, /数字与刻度对应/);
  assert.doesNotMatch(html, /<textarea|<input|<select|大数字居中/);
  assert.match(html, /编辑第 1 张任务/);
  assert.doesNotMatch(html, /data-explanation|commerce-design-v1/);
});

import React from "react";
import type { CommonGenerationConfig, GenerationTaskDesign } from "../../lib/generation-workspace";

export const presenceOptions = [
  ["auto", "由模型决定"], ["full", "完整展示"], ["partial", "局部展示"],
  ["detail", "细节特写"], ["context", "使用情境"], ["none", "不出现"],
] as const;

export function TaskDesignEditor({ detail, overrides, onChange, onReset }: {
  detail?: NonNullable<CommonGenerationConfig["moduleTaskDetails"]>[string];
  overrides?: GenerationTaskDesign;
  onChange: (patch: GenerationTaskDesign) => void;
  onReset: () => void;
}) {
  const fieldClass = "mt-1 w-full rounded border p-2";
  return <div className="module-task-design" aria-label="本图设计">
    <label className="block">本图要讲什么<textarea aria-label="本图要讲什么" className={fieldClass} maxLength={300} rows={2} placeholder="例如：解释参数含义，或展示使用场景；留空由模型决定" value={overrides?.informationQuestion ?? detail?.informationQuestion ?? ""} onChange={e => onChange({ informationQuestion: e.target.value })} /></label>
    <label className="block">表达方式<textarea aria-label="表达方式" className={fieldClass} maxLength={500} rows={2} placeholder="例如：大字海报、参数图解、真实使用场景；留空由模型决定" value={overrides?.visualMechanism ?? detail?.visualMechanism ?? ""} onChange={e => onChange({ visualMechanism: e.target.value })} /></label>
    <label className="block">商品出场<select className={fieldClass} aria-label="商品出场" value={overrides?.productPresence ?? detail?.productPresence ?? "auto"} onChange={e => onChange({ productPresence: e.target.value as GenerationTaskDesign["productPresence"] })}>{presenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {overrides && Object.keys(overrides).length > 0 && <button type="button" className="module-parameter-add" onClick={onReset}>{detail ? "恢复规划建议" : "清除设计选择"}</button>}
  </div>;
}

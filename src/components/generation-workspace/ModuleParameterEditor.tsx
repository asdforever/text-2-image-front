import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { GenerationModuleDefinition, GenerationModuleParameter } from "../../lib/generation-workspace";

const MAX_PARAMETER_ROWS = 20;

export function ModuleParameterEditor(props: {
  module: GenerationModuleDefinition;
  parameters: GenerationModuleParameter[];
  onChange: (parameters: GenerationModuleParameter[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<GenerationModuleParameter>) => {
    props.onChange(props.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const addRow = () => {
    if (props.parameters.length >= MAX_PARAMETER_ROWS) return;
    props.onChange([...props.parameters, { key: "", value: "" }]);
  };
  const removeRow = (index: number) => props.onChange(props.parameters.filter((_, itemIndex) => itemIndex !== index));

  return (
    <section className="module-parameter-editor" aria-label={`${props.module.label}参数`}>
      <div className="module-parameter-heading">
        <div><strong>{props.module.label}参数</strong><span>补充这个模块的事实、场景和创作约束</span></div>
        <small>{props.parameters.length}/{MAX_PARAMETER_ROWS}</small>
      </div>
      <div className="module-parameter-rows">
        {props.parameters.map((parameter, index) => (
          <div className="module-parameter-row" key={`${props.module.id}-${index}`}>
            <label>
              <span>参数名</span>
              <input value={parameter.key} maxLength={60} placeholder="例如：场景地点" onChange={(event) => updateRow(index, { key: event.target.value })} />
            </label>
            <label className="module-parameter-value">
              <span>参数值</span>
              <textarea value={parameter.value} maxLength={500} rows={2} placeholder="填写具体要求" onChange={(event) => updateRow(index, { value: event.target.value })} />
            </label>
            <button type="button" className="module-parameter-remove" title="删除参数" aria-label={`删除${parameter.key || "此参数"}`} onClick={() => removeRow(index)}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="module-parameter-add" disabled={props.parameters.length >= MAX_PARAMETER_ROWS} onClick={addRow}><Plus size={13} />添加参数</button>
    </section>
  );
}

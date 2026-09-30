import React, { useId, useRef, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import type { CommonGenerationConfig, GenerationModuleDefinition, GenerationTaskDesign } from "../../lib/generation-workspace";
import { getModuleParameterPresets } from "../../lib/generation-workspace";
import { ModuleParameterEditor } from "./ModuleParameterEditor";
import { presenceOptions, TaskDesignEditor } from "./TaskDesignEditor";

function EditableTaskTitle({ title, index, onChange }: { title: string; index: number; onChange: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  if (editing) return <input className="module-task-title-input" aria-label="任务标题" autoFocus maxLength={80} value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => { if (draft.trim() && draft.trim() !== title) onChange(draft.trim()); setEditing(false); }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); close(); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    }} />;
  return <button ref={button} type="button" className="module-task-title" aria-label={`修改第 ${index + 1} 张任务标题`}
    onClick={() => { setDraft(title); setEditing(true); }}><span>{title}</span><Pencil size={13} /></button>;
}

export function GenerationTaskCard({ taskId, moduleId, index, definition, config, expanded, onExpandedChange, onChange, onRemove, reference }: {
  taskId: string;
  moduleId: string;
  index: number;
  definition?: GenerationModuleDefinition;
  config: CommonGenerationConfig;
  expanded: boolean;
  onExpandedChange: () => void;
  onChange: (patch: Partial<CommonGenerationConfig>) => void;
  onRemove: () => void;
  reference?: React.ReactNode;
}) {
  const editorId = useId();
  const regular = config.creationMode === "regular";
  const detail = config.moduleTaskDetails?.[taskId];
  const overrides = config.moduleTaskOverrides?.[taskId];
  const parameters = config.moduleParameters[taskId] ?? getModuleParameterPresets(moduleId);
  const moduleLabel = definition?.label ?? "已失效模块";
  const title = regular ? moduleLabel : overrides?.taskTitle || detail?.title || moduleLabel;
  const information = overrides?.informationQuestion ?? detail?.informationQuestion;
  const visual = overrides?.visualMechanism ?? detail?.visualMechanism;
  const presence = overrides?.productPresence ?? detail?.productPresence ?? "auto";
  const presenceLabel = presenceOptions.find(([value]) => value === presence)?.[1] ?? "由模型决定";
  const filledParameters = parameters.filter(parameter => parameter.value.trim());
  const changeDesign = (patch: GenerationTaskDesign) => onChange({ moduleTaskOverrides: { ...config.moduleTaskOverrides, [taskId]: { ...overrides, ...patch } } });
  const parameterEditor = <ModuleParameterEditor module={definition ?? { id: moduleId, label: moduleLabel, description: "请重新规划或移除此图", mode: "suite" }} parameters={parameters}
    onChange={next => onChange({ moduleParameters: { ...config.moduleParameters, [taskId]: next } })} />;

  return <article className={`studio-module is-selected module-task-card${expanded ? " is-editing" : ""}`}>
    <header className="module-task-header">
      <span className="module-task-number">图 {index + 1}</span>
      {regular ? <strong className="module-task-title-text">{title}</strong> : <EditableTaskTitle title={title} index={index} onChange={taskTitle => changeDesign({ taskTitle })} />}
      {!regular && <span className="module-task-type">{moduleLabel}</span>}
      <div className="module-task-actions">
        <button type="button" className="module-task-edit-toggle" aria-label={`${expanded ? "完成编辑" : "编辑"}第 ${index + 1} 张任务`} aria-expanded={expanded} aria-controls={editorId} onClick={onExpandedChange}>
          {expanded ? <Check size={14} /> : <Pencil size={14} />}{expanded ? "完成" : "编辑"}
        </button>
        <button type="button" className="module-task-remove" aria-label={`删除第 ${index + 1} 张任务`} disabled={config.selectedModuleIds.length <= 1} onClick={onRemove}><Trash2 size={14} /></button>
      </div>
    </header>
    {!expanded && (regular ? <div className="module-task-parameter-summary">
      {filledParameters.length ? filledParameters.map((parameter, i) => <p key={i}><span>{parameter.key}：</span>{parameter.value}</p>) : <p>可按需补充本图参数</p>}
    </div> : <div className="module-task-overview">
      <dl className="module-task-summary">
        <div><dt>本图目标</dt><dd>{information?.trim() || "尚未填写，可点击编辑补充"}</dd></div>
        <div><dt>表达方式</dt><dd>{visual?.trim() || "由模型决定"}</dd></div>
      </dl>
      <p className="module-task-meta">商品出场：{presenceLabel}{filledParameters.length > 0 && <span>已填写 {filledParameters.length} 项参数</span>}</p>
    </div>)}
    {expanded && <div className="module-task-editor" id={editorId}>
      {regular ? parameterEditor : <>
        <TaskDesignEditor detail={detail} overrides={overrides} onChange={changeDesign}
          onReset={() => { const next = { ...config.moduleTaskOverrides }; delete next[taskId]; onChange({ moduleTaskOverrides: next }); }} />
        <details className="module-task-disclosure">
          <summary>构图建议与要求</summary>
          <div className="module-task-disclosure-body">
            {detail?.compositionAdvice && <p className="module-task-advice"><strong>构图建议</strong>{detail.compositionAdvice}</p>}
            <label>构图要求（选填）<textarea maxLength={500} rows={3}
              value={parameters.find(parameter => parameter.key === "构图要求")?.value ?? ""}
              placeholder="填写你希望固定的构图；未填写时可按建议优化"
              onChange={event => onChange({ moduleParameters: { ...config.moduleParameters, [taskId]: [...parameters.filter(parameter => parameter.key !== "构图要求"), { key: "构图要求", value: event.target.value }] } })} /></label>
          </div>
        </details>
        <details className="module-task-disclosure">
          <summary>补充参数<span>{filledParameters.length ? `已填写 ${filledParameters.length} 项` : "选填"}</span></summary>
          <div className="module-task-disclosure-body">{parameterEditor}</div>
        </details>
        {reference && <details className="module-task-disclosure"><summary>反推参考</summary>{reference}</details>}
      </>}
    </div>}
  </article>;
}

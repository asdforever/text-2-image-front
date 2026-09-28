import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { createIdempotencyKey } from "../../api/client";
import { getModuleParameterPresets, type CommonGenerationConfig, type GenerationModuleDefinition } from "../../lib/generation-workspace";
import { ModuleParameterEditor } from "./ModuleParameterEditor";
import { TaskDesignEditor } from "./TaskDesignEditor";

/** Edits image tasks, while keeping the published module catalog as the type source. */
export function GenerationTaskSelector(props: {
  modules: GenerationModuleDefinition[];
  config: CommonGenerationConfig;
  max?: number;
  error?: string;
  onChange: (patch: Partial<CommonGenerationConfig>) => void;
  renderTaskReference?: (taskId: string) => React.ReactNode;
}) {
  const { config } = props;
  const ids = config.selectedModuleIds;
  const max = props.max ?? Number.MAX_SAFE_INTEGER;
  const typeOf = (taskId: string) => config.moduleTypes?.[taskId] ?? taskId;
  const setTasks = (nextIds: string[], nextTypes = config.moduleTypes ?? {}, nextCounts = config.moduleCounts, nextParameters = config.moduleParameters) =>
    props.onChange({ selectedModuleIds: nextIds, moduleTypes: nextTypes, moduleCounts: nextCounts, moduleParameters: nextParameters,
      moduleTaskDetails: Object.fromEntries(Object.entries(config.moduleTaskDetails ?? {}).filter(([id]) => nextIds.includes(id))),
      moduleTaskOverrides: Object.fromEntries(Object.entries(config.moduleTaskOverrides ?? {}).filter(([id]) => nextIds.includes(id))),
    });
  const add = (moduleId: string) => {
    if (ids.length >= max) return;
    const taskId = ids.includes(moduleId) ? `task-${createIdempotencyKey()}` : moduleId;
    const nextIds = [...ids, taskId];
    setTasks(nextIds, { ...(config.moduleTypes ?? {}), [taskId]: moduleId }, { ...config.moduleCounts, [taskId]: 1 }, { ...config.moduleParameters, [taskId]: getModuleParameterPresets(moduleId).map((item) => ({ ...item })) });
  };
  const remove = (taskId: string) => {
    const nextIds = ids.filter((id) => id !== taskId);
    const nextTypes = { ...(config.moduleTypes ?? {}) }; delete nextTypes[taskId];
    const nextCounts = { ...config.moduleCounts }; delete nextCounts[taskId];
    const nextParameters = { ...config.moduleParameters }; delete nextParameters[taskId];
    setTasks(nextIds, nextTypes, nextCounts, nextParameters);
  };
  return <div className="module-selector" data-generation-invalid={props.error ? "true" : undefined}>
    <div className="module-selector-meta"><span>每项对应一张图，拼接顺序在画布中调整</span><strong>共 {ids.length} 张{max < Number.MAX_SAFE_INTEGER ? ` / 最多 ${max} 张` : ""}</strong></div>
    <div className="flex flex-wrap gap-2 py-2" aria-label="添加图片任务">
      {props.modules.map((module) => <button key={module.id} type="button" className="module-parameter-add" disabled={ids.length >= max} onClick={() => add(module.id)}><Plus size={13} />添加{module.label}</button>)}
    </div>
    <div className="studio-module-list">
      {ids.map((taskId, index) => {
        const moduleId = typeOf(taskId);
        const definition = props.modules.find((item) => item.id === moduleId);
        const parameters = config.moduleParameters[taskId] ?? getModuleParameterPresets(moduleId);
        const detail = config.moduleTaskDetails?.[taskId];
        const title = config.moduleTaskOverrides?.[taskId]?.taskTitle || detail?.title || definition?.label || "已失效模块";
        return <article className="studio-module is-selected" key={taskId}>
          <div className="studio-module-row">
            <div className="flex min-w-0 flex-1 items-center gap-2"><span className="shrink-0 text-xs">图 {index + 1}</span><span className="text-sm">{title}</span>{detail && <span className="text-xs text-slate-500">{definition?.label}</span>}</div>
            <button type="button" aria-label={`删除第 ${index + 1} 张任务`} disabled={ids.length <= 1} onClick={() => remove(taskId)}><Trash2 size={13} /></button>
          </div>
          <TaskDesignEditor detail={detail} overrides={config.moduleTaskOverrides?.[taskId]} defaultTitle={definition?.label ?? ""}
            onChange={patch => props.onChange({ moduleTaskOverrides: { ...config.moduleTaskOverrides, [taskId]: { ...config.moduleTaskOverrides?.[taskId], ...patch } } })}
            onReset={() => { const next = { ...config.moduleTaskOverrides }; delete next[taskId]; props.onChange({ moduleTaskOverrides: next }); }} />
          <div className="px-3 pb-2 text-sm">
            <label className="block">构图要求（选填）<textarea className="mt-1 w-full rounded border p-2" maxLength={500} rows={2}
              value={parameters.find(p => p.key === "构图要求")?.value ?? ""}
              placeholder="填写你希望固定的构图；未填写时可按建议优化"
              onChange={event => props.onChange({ moduleParameters: { ...config.moduleParameters, [taskId]: [
                ...parameters.filter(p => p.key !== "构图要求"), { key: "构图要求", value: event.target.value },
              ] } })} /></label>
          </div>
          <details className="studio-module-parameters" open={index === 0}><summary>{definition?.label ?? "已失效模块"}补充参数<span>{parameters.filter((item) => item.value.trim()).length ? "已填写" : "选填"}</span></summary><ModuleParameterEditor module={definition ?? { id: moduleId, label: "已失效模块", description: "请重新规划或移除此图", mode: "suite" }} parameters={parameters} onChange={(next) => props.onChange({ moduleParameters: { ...config.moduleParameters, [taskId]: next } })} /></details>
          {props.renderTaskReference?.(taskId)}
        </article>;
      })}
    </div>
    {props.error && <div className="generation-field-error" role="alert">{props.error}</div>}
  </div>;
}

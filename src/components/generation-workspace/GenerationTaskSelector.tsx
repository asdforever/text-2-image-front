import React, { useState } from "react";
import { Plus } from "lucide-react";
import { createIdempotencyKey } from "../../api/client";
import { getModuleParameterPresets, type CommonGenerationConfig, type GenerationModuleDefinition } from "../../lib/generation-workspace";
import { GenerationTaskCard } from "./GenerationTaskCard";

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
  const [editingTask, setEditingTask] = useState<string | null>(null);
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
    setEditingTask(null);
    const nextIds = ids.filter((id) => id !== taskId);
    const nextTypes = { ...(config.moduleTypes ?? {}) }; delete nextTypes[taskId];
    const nextCounts = { ...config.moduleCounts }; delete nextCounts[taskId];
    const nextParameters = { ...config.moduleParameters }; delete nextParameters[taskId];
    setTasks(nextIds, nextTypes, nextCounts, nextParameters);
  };
  return <div className="module-selector" data-generation-invalid={props.error ? "true" : undefined}>
    <div className="module-selector-meta"><span>每项对应一张图，拼接顺序在画布中调整</span><strong>共 {ids.length} 张{max < Number.MAX_SAFE_INTEGER ? ` / 最多 ${max} 张` : ""}</strong></div>
    <div className="module-task-catalog flex flex-wrap gap-2 py-2" aria-label="添加图片任务">
      {props.modules.map((module) => <button key={module.id} type="button" className="module-parameter-add" disabled={ids.length >= max} onClick={() => add(module.id)}><Plus size={13} />添加{module.label}</button>)}
    </div>
    <div className="studio-module-list">
      {ids.map((taskId, index) => {
        const moduleId = typeOf(taskId);
        const taskKey = `${config.creationMode ?? "professional"}:${taskId}`;
        return <GenerationTaskCard key={taskKey} taskId={taskId} moduleId={moduleId} index={index}
          definition={props.modules.find(item => item.id === moduleId)} config={config}
          expanded={editingTask === taskKey} onExpandedChange={() => setEditingTask(editingTask === taskKey ? null : taskKey)}
          onChange={props.onChange} onRemove={() => remove(taskId)} reference={props.renderTaskReference?.(taskId)} />;
      })}
    </div>
    {props.error && <div className="generation-field-error" role="alert">{props.error}</div>}
  </div>;
}

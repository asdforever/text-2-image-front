import React from "react";
import { ArrowDown, ArrowUp, Check, Copy } from "lucide-react";
import { getModuleParameterPresets, toggleBoundedSelection, type GenerationModuleDefinition, type GenerationModuleParameters } from "../../lib/generation-workspace";
import { ModuleParameterEditor } from "./ModuleParameterEditor";

export function ModuleSelector(props: {
  modules: GenerationModuleDefinition[];
  selectedIds: string[];
  max: number;
  min?: number;
  onChange: (ids: string[]) => void;
  error?: string;
  moduleParameters?: GenerationModuleParameters;
  onModuleParametersChange?: (moduleId: string, parameters: GenerationModuleParameters[string]) => void;
  moduleCounts?: Record<string, number>;
  onModuleCountChange?: (moduleId: string, count: number) => void;
  onDuplicate?: (moduleId: string) => void;
  onMove?: (moduleId: string, direction: -1 | 1) => void;
}) {
  const moduleParameters = props.moduleParameters ?? {};
  const moduleCounts = props.moduleCounts ?? {};
  return (
    <div className="module-selector" data-generation-invalid={props.error ? "true" : undefined}>
      <div className="module-selector-meta">
        <span>每个任务 1–4 张候选图</span>
        <strong>已选 {props.selectedIds.length}{props.max < Number.MAX_SAFE_INTEGER ? `/${props.max}` : " 个任务"}</strong>
      </div>
      <div className="studio-module-list">
        {props.modules.map((module) => {
          const selected = props.selectedIds.includes(module.id);
          const parameters = Object.prototype.hasOwnProperty.call(moduleParameters, module.id) ? moduleParameters[module.id] : getModuleParameterPresets(module.id);
          return <div key={module.id} className={`studio-module${selected ? " is-selected" : ""}`}>
          <div className="studio-module-row">
          <button
            type="button"
            aria-pressed={selected}
            aria-label={`${module.label} ${module.description}`}
            title={module.description}
            className="studio-module-toggle"
            onClick={() => props.onChange(toggleBoundedSelection(props.selectedIds, module.id, props.max, props.min ?? 1))}
          >
            <span className="studio-checkbox" aria-hidden="true">{selected && <Check size={11} />}</span><span>{module.label}</span>
          </button>
          {selected &&
                <select
                  aria-label={`${module.label}生成张数`}
                  value={moduleCounts[module.id] ?? 1}
                  onChange={(event) => props.onModuleCountChange?.(module.id, Number(event.target.value))}
                >
                  {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} 张</option>)}
                </select>
          }
          </div>
          {selected && props.onDuplicate && <div className="flex items-center gap-2 px-2 py-1 text-xs">
            <button type="button" disabled={props.selectedIds.length >= props.max} onClick={() => props.onDuplicate?.(module.id)} className="flex items-center gap-1"><Copy size={12} />添加同类任务</button>
            <button type="button" aria-label={`上移任务 ${props.selectedIds.indexOf(module.id) + 1}`} disabled={props.selectedIds.indexOf(module.id) === 0} onClick={() => props.onMove?.(module.id, -1)}><ArrowUp size={13} /></button>
            <button type="button" aria-label={`下移任务 ${props.selectedIds.indexOf(module.id) + 1}`} disabled={props.selectedIds.indexOf(module.id) === props.selectedIds.length - 1} onClick={() => props.onMove?.(module.id, 1)}><ArrowDown size={13} /></button>
          </div>}
          {selected && <details className="studio-module-parameters">
            <summary>{module.label}补充参数<span>{parameters.filter((item) => item.value.trim()).length ? "已填写" : "选填"}</span></summary>
            <ModuleParameterEditor
              module={module}
              parameters={parameters}
              onChange={(next) => props.onModuleParametersChange?.(module.id, next)}
            />
          </details>}
          </div>;
        })}
      </div>
      {props.error && <div className="generation-field-error" role="alert">{props.error}</div>}
    </div>
  );
}

import React from "react";
import type { ModulePlanningControls } from "../../hooks/useModulePlanning";
import type { CommonGenerationConfig, GenerationMode } from "../../lib/generation-workspace";
import { ReverseModuleReferencePicker } from "../../features/reverse-projects/ReverseReferencePanel";
import { useGenerationConfigStore } from "../../store/useGenerationConfigStore";
import { ConfigSectionCard } from "./ConfigSectionCard";
import { GenerationTaskSelector } from "./GenerationTaskSelector";
import "./generation-modules-panel.css";

export function GenerationModulesPanel({ projectId, mode, config, planner, errors, onChange }: {
  projectId: string;
  mode: GenerationMode;
  config: CommonGenerationConfig;
  planner: ModulePlanningControls;
  errors: string[];
  onChange: (patch: Partial<CommonGenerationConfig>) => void;
}) {
  const modules = useGenerationConfigStore(state => {
    const published = state.runtimePublished ?? state.published;
    return mode === "hero" ? published.heroModules : published.suiteModules;
  });
  const title = mode === "hero" ? "主图模块" : "详情页模块";
  const error = errors.find(message => message.includes("模块"));
  return (
    <section className="generation-modules-panel" aria-label={title}>
      <ConfigSectionCard title={title} description="按图片任务选择模块；同一模块可以复用" collapsible error={error}>
        <GenerationTaskSelector modules={modules} config={config} max={mode === "hero" ? 8 : undefined} onChange={onChange}
          renderTaskReference={planner.references ? taskId => <ReverseModuleReferencePicker projectId={projectId} target={mode} taskId={taskId} config={config} controls={planner.references} disabled={planner.planning} /> : undefined} />
      </ConfigSectionCard>
    </section>
  );
}

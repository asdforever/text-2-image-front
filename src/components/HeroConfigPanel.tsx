import React, { useState } from "react";
import type { Project } from "../api/contracts";
import { findGenerationMarket } from "../lib/generation-config";
import { hasPlanningInput } from "../lib/planning-master";
import { ReverseReferencePanel, ReverseModuleReferencePicker } from "../features/reverse-projects/ReverseReferencePanel";
import { selectableProductAssets, type HeroGenerationConfig } from "../lib/generation-workspace";
import { useGenerationConfigStore } from "../store/useGenerationConfigStore";
import type { ModulePlanningControls } from "../hooks/useModulePlanning";
import { Button } from "./ui/button";
import {
  ConfigSectionCard,
  GenerationTaskSelector,
  MarketSelector,
  OutputSettings,
  ProductAssetPicker,
  RecentConfigCard,
  StyleLibrary,
} from "./generation-workspace";

export function HeroConfigPanel(props: {
  project: Project;
  config: HeroGenerationConfig;
  updatedAt?: string;
  onChange: (patch: Partial<HeroGenerationConfig>) => void;
  onUpload: (files: File[]) => void;
  errors?: string[];
  planner?: ModulePlanningControls;
  onRefresh?: () => Promise<void> | void;
}) {
  const [showRecent, setShowRecent] = useState(true);
  const modules = useGenerationConfigStore((state) => state.published.heroModules);
  const markets = useGenerationConfigStore((state) => state.published.markets);
  const styleCategories = useGenerationConfigStore((state) => state.published.styleCategories);
  const assets = selectableProductAssets(props.project.assets);
  const planning = props.planner?.planning ?? false;
  const planError = props.planner?.error;
  const output = {
    outputLanguage: props.config.outputLanguage,
    model: props.config.model,
    aspectRatio: props.config.aspectRatio,
    resolution: props.config.resolution,
  };
  return (
    <div className="generation-config-stack">
      {showRecent && props.updatedAt && (
        <RecentConfigCard
          updatedAt={props.updatedAt}
          summary={props.config.aspectRatio + " · 已选 " + props.config.selectedModuleIds.length + " 个模块"}
          onRestore={() => props.onChange(props.config)}
          onDismiss={() => setShowRecent(false)}
        />
      )}
      <ConfigSectionCard title="产品素材" description="上传白底图，建议选择 1–4 个关键视角">
        <ProductAssetPicker assets={assets} selectedIds={props.config.selectedAssetIds} max={8} error={props.errors?.find((error) => error.includes("产品素材"))} onChange={(selectedAssetIds) => props.onChange({ selectedAssetIds })} onUpload={props.onUpload} />
      </ConfigSectionCard>
      <ConfigSectionCard title="规划大师" description="输入商品资料后，由规划大师自动选择模块并生成建议构图简案">
        <textarea className="ui-textarea" aria-label="主图商品资料" placeholder="例如：商品名称、核心卖点、目标人群、必须展示的事实" value={props.config.planningBrief ?? ""} onChange={(event) => props.onChange({ planningBrief: event.target.value, modulePlanId: undefined, modulePlanFingerprint: undefined })} />
        <ReverseReferencePanel projectId={props.project.id} target="hero" controls={props.planner?.references} disabled={planning} />
        <Button type="button" size="sm" disabled={planning || props.planner?.references?.loading || !hasPlanningInput(props.config) || props.config.selectedAssetIds.length === 0} onClick={() => void props.planner?.plan()}>{planning ? "规划中…" : "自动规划"}</Button>
        {planError && <p className="generation-field-error" role="alert">{planError}</p>}
        {props.planner?.summary && <p role="status">{props.planner.summary}</p>}
        {props.planner?.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
      </ConfigSectionCard>
      <ConfigSectionCard title="电商市场">
        <MarketSelector value={props.config.market} onChange={(market) => props.onChange({ market, outputLanguage: findGenerationMarket(markets, market)?.defaultLanguage ?? props.config.outputLanguage })} />
      </ConfigSectionCard>
      <ConfigSectionCard title="图片风格" description="按商品规划一次风格，供本次所有模块共用" collapsible error={props.errors?.find((error) => error.includes("风格"))}>
        <StyleLibrary categories={styleCategories} selectedId={props.config.styleId} customStyle={props.config.customStyle} onChange={(styleId) => props.onChange({ styleId })} onCustomStyleChange={(customStyle) => props.onChange({ customStyle })} />
      </ConfigSectionCard>
      <ConfigSectionCard title="主图模块" description="按图片任务选择模块；同一模块可以复用">
        <GenerationTaskSelector modules={modules} config={props.config} max={8} error={props.errors?.find((error) => error.includes("模块"))} onChange={props.onChange} renderTaskReference={taskId => <ReverseModuleReferencePicker projectId={props.project.id} target="hero" taskId={taskId} config={props.config} controls={props.planner?.references} disabled={planning} />} />
      </ConfigSectionCard>
      <ConfigSectionCard title="输出设置" collapsible>
        <OutputSettings value={output} onChange={(next) => props.onChange(next)} />
      </ConfigSectionCard>
    </div>
  );
}

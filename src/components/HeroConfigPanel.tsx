import React, { useState } from "react";
import type { Project } from "../api/contracts";
import { findGenerationMarket } from "../lib/generation-config";
import { selectableProductAssets, type HeroGenerationConfig } from "../lib/generation-workspace";
import { useGenerationConfigStore } from "../store/useGenerationConfigStore";
import type { ModulePlanningControls } from "../hooks/useModulePlanning";
import {
  ConfigSectionCard,
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
  const markets = useGenerationConfigStore((state) => state.published.markets);
  const styleCategories = useGenerationConfigStore((state) => state.published.styleCategories);
  const assets = selectableProductAssets(props.project.assets);
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
      <ConfigSectionCard title="电商市场">
        <MarketSelector value={props.config.market} onChange={(market) => props.onChange({ market, outputLanguage: findGenerationMarket(markets, market)?.defaultLanguage ?? props.config.outputLanguage })} />
      </ConfigSectionCard>
      <ConfigSectionCard title="图片风格" description="统一整套视觉方向，各张按内容调整构图与场景" collapsible error={props.errors?.find((error) => error.includes("风格"))}>
        <StyleLibrary categories={styleCategories} selectedId={props.config.styleId} customStyle={props.config.customStyle} onChange={(styleId) => props.onChange({ styleId, modulePlanId: undefined, modulePlanFingerprint: undefined, modulePlanningRequest: undefined })} onCustomStyleChange={(customStyle) => props.onChange({ customStyle, modulePlanId: undefined, modulePlanFingerprint: undefined, modulePlanningRequest: undefined })} />
      </ConfigSectionCard>
      <ConfigSectionCard title="输出设置" collapsible>
        <OutputSettings value={output} onChange={(next) => props.onChange(next)} />
      </ConfigSectionCard>
    </div>
  );
}

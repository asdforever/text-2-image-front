import { creationModeLabel } from "./creation-mode-label";
import type { Asset } from "../api/contracts";
import type { ApiBatchGenerationDetail, ApiCanvasGenerationStep } from "../api/client";

export interface ResultImage {
  id: string;
  name: string;
  url: string;
  subtitle?: string;
  asset?: Asset;
  moduleLabel?: string;
  groupId?: string;
  groupLabel?: string;
  batchId?: string;
  creationMode?: "regular" | "professional";
  /** The frozen prompt used for this image, when the backend recorded one. */
  prompt?: string;
}

function text(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value : undefined; }
function label(value: unknown): string | undefined { return value && typeof value === "object" ? text((value as { label?: unknown }).label) : undefined; }

export function generationResultImages(assets: Asset[], mode: "hero" | "suite", steps: ApiCanvasGenerationStep[], batch?: ApiBatchGenerationDetail | null, visibleMode?: "regular" | "professional"): ResultImage[] {
  const byAsset = new Map(steps.flatMap(step => step.outputAssetIds.map(id => [id, step] as const)));
  return assets.flatMap(asset => {
    const step = byAsset.get(asset.id);
    const slot = batch?.slots.find(item => item.generatedAssetId === asset.id);
    const knownMode = slot ? (batch?.kind ?? mode) : step?.kind;
    if (knownMode ? knownMode !== mode && !(mode === "suite" && knownMode === "detail") : asset.type !== mode) return [];
    const module = slot ? batch?.modules.find(item => item.id === slot.moduleTaskId) : undefined;
    const moduleLabel = module?.moduleLabel ?? step?.title ?? (mode === "hero" ? "主图" : "详情图");
    const batchId = slot ? batch?.id : step?.batchId;
    const creationMode = slot ? batch?.creationMode ?? step?.creationMode : step?.creationMode;
    if (visibleMode && creationMode !== visibleMode) return [];
    const created = slot ? batch?.createdAt : step?.batchCreatedAt;
    const date = created ? new Date(created) : null;
    const dateLabel = date && Number.isFinite(date.valueOf()) ? date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : undefined;
    const snapshot = step?.parameters;
    const prompt = module?.confirmedTaskPrompt ?? module?.compiledTaskPrompt ?? step?.finalPrompt ?? step?.taskPrompt;
    const style = label(snapshot?.style) ?? asset.generationSnapshot?.style?.label;
    const requestedRatio = text(snapshot?.aspectRatio) ?? asset.generationSnapshot?.aspectRatio;
    const settings = [requestedRatio && `生成比例 ${requestedRatio}`, text(snapshot?.resolution) ?? asset.generationSnapshot?.resolution, label(snapshot?.modelPreset) ?? asset.generationSnapshot?.model?.label, style];
    return [{ id: asset.id, name: asset.name, url: asset.url, asset, moduleLabel, batchId, creationMode,
      groupId: batchId ?? (step?.id.startsWith("hero-task:") ? step.id : "unassigned"),
      groupLabel: batchId ? `${creationModeLabel(creationMode)} · ${dateLabel ?? "生成批次"} · ${batchId.slice(0, 8)}` : step?.id.startsWith("hero-task:") ? `历史单图任务 · ${step.id.slice(10, 18)}` : "批次信息未记录",
      subtitle: [asset.dimensions && `实际尺寸 ${asset.dimensions}`, ...settings].filter(Boolean).join(" · "), prompt }];
  });
}

import { projectAssetPreviewUrl, type ApiCanvasGenerationStep, type ApiProjectAsset, type ApiTaskVersion, type ApiWorkbench } from "../../api/client";
import type { CanvasImage } from "./model";

export function versionSteps(workbench: ApiWorkbench): ApiCanvasGenerationStep[] {
  const tracks = workbench.generationTracks ?? [];
  const owned = new Set(tracks.flatMap((t) => t.revisions.flatMap((v) => v.outputs.map((o) => o.assetId))));
  return [
    ...(workbench.generationSteps ?? []).filter((s) => !tracks.some((t) => t.stepId === s.id)),
    ...tracks.flatMap((track) => track.revisions.filter((v) => v.outputs.length).map((version) => ({ ...version, id: version.id === "original" ? track.stepId : `${track.stepId}:revision:${version.id}`, outputAssetIds: [...version.outputs.map((o) => o.assetId), ...(version.id === "original" ? (workbench.generationSteps?.find((s) => s.id === track.stepId)?.outputAssetIds ?? []).filter((id) => !owned.has(id)) : [])], outputVersionIds: [], trackId: track.stepId, revisionId: version.id, revisionNumber: version.number }))),
  ];
}

export function projectVersionImages(images: CanvasImage[], workbench: ApiWorkbench, assets: ApiProjectAsset[]): CanvasImage[] {
  const tracks = workbench.generationTracks ?? [];
  if (!tracks.length) return images;
  const steps = versionSteps(workbench);
  const owned = new Set(tracks.flatMap((t) => t.revisions.flatMap((v) => v.outputs.map((o) => o.assetId))));
  const retained = images.filter((i) => !owned.has(i.assetId ?? ""));
  for (const track of tracks) {
    track.originalAssetIds.forEach((originalId, index) => {
      const original = images.find((i) => i.assetId === originalId);
      const originalAsset = assets.find((a) => a.id === originalId);
      const versions: ApiTaskVersion[] = track.revisions.flatMap((revision) => revision.outputs.filter((o) => o.index === index).flatMap((output): ApiTaskVersion[] => {
        const asset = assets.find((a) => a.id === output.assetId && a.state === "available");
        if (!asset) return [];
        return [{ id: asset.id, taskId: track.stepId, slotId: String(index), attemptId: revision.id, versionNumber: revision.number, objectKey: "", processObjectKeys: [], sha256: asset.sha256, width: asset.width, height: asset.height, mimeType: asset.mimeType, promptSnapshot: { finalPrompt: revision.finalPrompt }, contextSnapshot: revision.parameters, isCurrent: asset.id === track.currentAssetIds[index], isFinal: false, createdAt: revision.createdAt, previewUrl: projectAssetPreviewUrl(workbench.suite.id, asset.id) }];
      }));
      const version = versions.find((v) => v.isCurrent) ?? versions[versions.length - 1];
      if (!version) return;
      retained.push({ id: original?.id ?? `asset:${originalId}`, title: original?.title ?? originalAsset?.filename ?? `${track.title} ${index + 1}`, category: track.kind === "suite" ? "detail" : track.kind as CanvasImage["category"], url: version.previewUrl, width: version.width, height: version.height, assetId: version.id, versions, version, generation: steps.find((s) => s.outputAssetIds.includes(version.id)), canvasVersion: { stepId: track.stepId, outputIndex: index }, generationStatus: track.revisions[track.revisions.length - 1]?.status });
    });
  }
  // 下游曾使用的旧图必须有独立节点，不能悄悄连到该图片的新版本。
  const references = new Set(steps.flatMap((s) => s.sourceAssetIds));
  for (const id of references) {
    if (!owned.has(id) || retained.some((i) => i.assetId === id)) continue;
    const asset = assets.find((a) => a.id === id && a.state === "available");
    if (asset) retained.push({ id: `history:${id}`, title: `${asset.filename} · 历史输入`, category: asset.kind === "white_background" ? "white" : "generated", url: projectAssetPreviewUrl(workbench.suite.id, id), width: asset.width, height: asset.height, assetId: id, versions: [], generation: steps.find((s) => s.outputAssetIds.includes(id)) });
  }
  return retained;
}

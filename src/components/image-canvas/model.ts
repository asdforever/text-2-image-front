import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { projectAssetPreviewUrl, type ApiCanvasGenerationStep, type ApiCanvasLayout, type ApiProjectAsset, type ApiSuiteTask, type ApiTaskVersion, type ApiWorkbench } from "../../api/client";
import { projectVersionImages, versionSteps } from "./canvasVersions";
import { arrangeGraph } from "./graph-layout";
export { arrangeGraph } from "./graph-layout";

export type ImageCategory = "source" | "white" | "hero" | "detail" | "generated" | "edit";
export const categoryNames: Record<ImageCategory, string> = { source: "原始素材", white: "白底图", hero: "主图", detail: "详情套图", generated: "生成图", edit: "编辑结果" };
export type CanvasImage = {
  id: string; title: string; category: ImageCategory; url: string; width: number; height: number;
  assetId?: string; task?: ApiSuiteTask; editTask?: boolean; versions: ApiTaskVersion[]; version?: ApiTaskVersion;
  generation?: ApiCanvasGenerationStep;
  canvasVersion?: { stepId: string; outputIndex: number }; generationStatus?: string;
};
export type GenerationStep = ApiCanvasGenerationStep & { sourceNodeIds: string[]; outputNodeIds: string[]; missingSource: boolean };
export type CanvasGraph = { steps: GenerationStep[]; edges: Edge[] };
export type CanvasNode = Node<{ image?: CanvasImage; title?: string; step?: GenerationStep; openStep?: (step: GenerationStep) => void; regenerateStep?: (step: GenerationStep) => void; selectImageVersion?: (image: CanvasImage, versionId: string) => void; versionSaving?: boolean; generationStatus?: string; latestRevisionNumber?: number }, "image" | "imageGroup" | "generation">;
export type CanvasGroup = ApiCanvasLayout["groups"][number] & { title?: string };
export function imagePrompt(image: CanvasImage, version = image.version) {
  const prompt = version?.promptSnapshot.finalPrompt ?? version?.promptSnapshot.prompt ?? version?.promptSnapshot.summary;
  return typeof prompt === "string" ? prompt : image.generation?.finalPrompt ?? image.task?.promptDraft ?? "";
}

export function canvasImages(workbench: ApiWorkbench, assets: ApiProjectAsset[]): CanvasImage[] {
  const available = assets.filter((asset) => asset.state === "available");
  const images: CanvasImage[] = [];
  const used = new Set<string>();
  const referenced = new Set([...(workbench.generationSteps ?? []).flatMap((s) => s.sourceAssetIds), ...available.map((a) => a.sourceAssetId).filter((id): id is string => !!id)]);
  const assetFor = (version?: ApiTaskVersion) => version ? available.find((asset) => asset.id === version.id || asset.generationSnapshotId === version.id || projectAssetPreviewUrl(workbench.suite.id, asset.id) === version.previewUrl || workbench.generationSteps?.some((s) => s.outputVersionIds.includes(version.id) && s.outputAssetIds.includes(asset.id))) : undefined;
  for (const task of workbench.tasks.filter((task) => task.status !== "archived")) {
    const version = task.versions.find((v) => v.isCurrent) ?? task.versions[0];
    task.versions.forEach((v) => { const asset = assetFor(v); if (asset) used.add(asset.id); });
    const asset = assetFor(version);
    images.push({ id: `task:${task.id}`, title: task.title, category: task.imageType === "main" ? "hero" : "detail", url: version?.previewUrl ?? "", width: asset?.width ?? version?.width ?? 1, height: asset?.height ?? version?.height ?? 1, assetId: asset?.id, task, versions: task.versions, version });
  }
  for (const child of workbench.imageEditChildren ?? []) {
    const raw = child.task;
    if (raw.status === "archived") continue;
    const versions: ApiTaskVersion[] = child.versions.map((v) => ({ id: v.id, taskId: String(raw.id), slotId: "", attemptId: v.attemptId ?? "", versionNumber: v.versionNumber, objectKey: "", processObjectKeys: [], sha256: "", width: v.width ?? 1, height: v.height ?? 1, mimeType: v.mimeType ?? "image/png", promptSnapshot: v.promptSnapshot ?? (raw.promptSnapshot as Record<string, unknown>) ?? {}, contextSnapshot: {}, isCurrent: v.id === raw.currentVersionId, isFinal: v.id === raw.finalVersionId, createdAt: String(raw.createdAt ?? ""), previewUrl: v.previewUrl ?? "" }));
    const version = versions.find((v) => v.isCurrent) ?? versions[0];
    versions.forEach((v) => { const asset = assetFor(v); if (asset) used.add(asset.id); });
    const task: ApiSuiteTask = { id: String(raw.id), suiteId: workbench.suite.id, planSnapshotId: null, planItemId: null, ordinal: 0, imageType: "detail", title: String(raw.summary ?? "图片编辑"), purpose: "", promptDraft: String(raw.summary ?? ""), promptRevision: 0, sourceInputImageId: null, generationParams: {}, status: (raw.status === "succeeded" ? "generated" : raw.status === "queued" ? "pending" : raw.status) as ApiSuiteTask["status"], archivedAt: null, createdAt: String(raw.createdAt ?? ""), updatedAt: "", versions, attempts: [], slots: [] };
    const asset = assetFor(version);
    images.push({ id: `edit-child:${task.id}`, title: asset?.filename ?? task.title, category: asset?.kind === "white_background" ? "white" : "edit", url: asset ? projectAssetPreviewUrl(workbench.suite.id, asset.id) : version?.previewUrl ?? "", width: asset?.width ?? version?.width ?? 1, height: asset?.height ?? version?.height ?? 1, task, editTask: true, versions, version, assetId: asset?.id });
  }
  for (const asset of available) {
    if (used.has(asset.id) && (!referenced.has(asset.id) || images.some((i) => i.assetId === asset.id))) continue;
    const category: ImageCategory = asset.kind === "source" ? "source" : asset.kind === "white_background" ? "white" : "generated";
    images.push({ id: `asset:${asset.id}`, title: asset.filename, category, url: projectAssetPreviewUrl(workbench.suite.id, asset.id), width: asset.width, height: asset.height, assetId: asset.id, versions: [] });
  }
  for (const input of workbench.inputImages) {
    if (assets.some((asset) => asset.id === input.id)) continue;
    images.push({ id: `input:${input.id}`, title: input.originalFilename, category: "source", url: input.originalPreviewUrl || input.thumbnailPreviewUrl, width: input.width, height: input.height, versions: [] });
  }
  return projectVersionImages(images.map((image) => {
    const generation = workbench.generationSteps?.find((s) => s.outputAssetIds.includes(image.assetId ?? "") || s.outputVersionIds.includes(image.version?.id ?? ""));
    const category = generation && ["suite", "reverse"].includes(generation.kind) ? "detail" : generation && ["hero", "white", "edit"].includes(generation.kind) ? generation.kind as ImageCategory : image.category;
    return { ...image, category, generation };
  }), workbench, assets);
}

export function canvasGraph(images: CanvasImage[], workbench: ApiWorkbench, assets: ApiProjectAsset[], includeHistory = false): CanvasGraph {
  const steps: GenerationStep[] = [];
  const represented = new Set<string>();
  // 主输出的提示词卡片保持稳定身份；仍被下游引用的其他版本另保留历史卡片。
  const primaryRevisions = new Map<string, string>();
  for (const image of images) {
    if (image.canvasVersion && image.generation?.revisionId && !primaryRevisions.has(image.canvasVersion.stepId)) {
      primaryRevisions.set(image.canvasVersion.stepId, image.generation.revisionId);
    }
  }
  const resolveSource = (id: string) => images.find((image) => image.assetId === id || image.id === `input:${id}` || image.version?.id === id)?.id;
  for (const step of versionSteps(workbench)) {
    const outputs = images.filter((i) => step.outputAssetIds.includes(i.assetId ?? "") || step.outputVersionIds.includes(i.version?.id ?? "") || (includeHistory && i.versions.some((v) => step.outputVersionIds.includes(v.id) || (!!i.canvasVersion && step.outputAssetIds.includes(v.id)))));
    if (!outputs.length) continue;
    const sources = step.sourceAssetIds.map(resolveSource).filter((id): id is string => !!id);
    outputs.forEach((i) => represented.add(i.id));
    const id = step.trackId ? (primaryRevisions.get(step.trackId) === step.revisionId ? step.trackId : `${step.trackId}:revision:${step.revisionId}`) : step.id;
    steps.push({ ...step, id, sourceNodeIds: sources, outputNodeIds: outputs.map((i) => i.id), missingSource: sources.length !== step.sourceAssetIds.length || !sources.length });
  }
  for (const image of images) {
    if (represented.has(image.id) || image.category === "source") continue;
    const asset = assets.find((a) => a.id === image.assetId);
    // Uploaded/library white images are inputs, not evidence of a generation operation.
    if (image.category === "white" && asset?.sourceKind !== "generated" && !asset?.sourceAssetId) continue;
    const child = workbench.imageEditChildren?.find((c) => `edit-child:${c.task.id}` === image.id);
    const sourceId = asset?.sourceAssetId ?? (child?.snapshot?.sourceVersionId as string | undefined) ?? image.task?.sourceInputImageId;
    const source = sourceId ? resolveSource(sourceId) : undefined;
    const snapshot = image.version?.promptSnapshot ?? asset?.sourceSnapshot?.promptSnapshot as Record<string, unknown> | undefined;
    const prompt = snapshot?.finalPrompt ?? snapshot?.prompt ?? snapshot?.summary;
    steps.push({ id: `unknown:${image.id}`, kind: image.category, title: image.category === "white" ? "生成白底图" : image.category === "edit" ? "修改图片" : "生成记录待补全", sourceAssetIds: sourceId ? [sourceId] : [], sourceNodeIds: source && source !== image.id ? [source] : [], outputAssetIds: image.assetId ? [image.assetId] : [], outputVersionIds: [], outputNodeIds: [image.id], missingSource: !source || source === image.id, finalPrompt: typeof prompt === "string" ? prompt : "", taskPrompt: "", constraints: {}, parameters: image.version?.contextSnapshot ?? {} });
  }
  const edges: Edge[] = [];
  for (const step of steps) {
    const id = `generation:${step.id}`;
    for (const [source, target] of [...step.sourceNodeIds.map((source) => [source, id]), ...step.outputNodeIds.map((target) => [id, target])]) {
      if (source === target) continue;
      edges.push({ id: `${source}->${target}`, source, target, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#668878" }, style: { stroke: "#668878", strokeWidth: 2 }, selectable: false });
    }
  }
  return { steps, edges };
}

export function restoreCanvas(images: CanvasImage[], layout: Pick<ApiCanvasLayout, "nodes" | "groups"> | null, graph?: CanvasGraph): CanvasNode[] {
  const groups = (layout?.groups ?? []) as CanvasGroup[];
  const groupNodes: CanvasNode[] = groups.map((g) => ({ id: g.groupKey, type: "imageGroup", position: { x: g.x, y: g.y }, style: { width: g.width, height: g.height }, data: { title: g.title || "图片分组" }, zIndex: -1, dragHandle: ".ic-group-heading" }));
  const saved = new Map(layout?.nodes.map((n) => [n.nodeId, n]) ?? []);
  // New results go below the saved composition; polling never rearranges existing pictures.
  const bottom = Math.max(0, ...(layout?.nodes ?? []).filter((n) => !n.hidden).map((n) => n.y + 370));
  let added = 0;
  const result = [...groupNodes, ...images.map((image): CanvasNode => {
    const old = saved.get(image.id);
    const group = groups.find((g) => g.groupKey === old?.groupKey);
    const fallback = { x: 48 + added % 3 * 286, y: (layout?.nodes.length ? bottom + 50 : 70) + Math.floor(added / 3) * 370 };
    if (!old) added++;
    return { id: image.id, type: "image", data: { image }, position: { x: (old?.x ?? fallback.x) - (group?.x ?? 0), y: (old?.y ?? fallback.y) - (group?.y ?? 0) }, parentId: group?.groupKey, hidden: old?.hidden ?? false, style: { width: 248 }, selected: false };
  })];
  for (const step of graph?.steps ?? []) {
    const id = `generation:${step.id}`;
    // 旧风格候选曾被识别为未知生成；补全依据后保留用户摆放的位置。
    const old = saved.get(id) ?? (step.kind === "style-harmonization" && step.outputNodeIds.length === 1 ? saved.get(`generation:unknown:${step.outputNodeIds[0]}`) : undefined);
    result.push({ id, type: "generation", data: { step }, position: old ? { x: old.x, y: old.y } : { x: 48 + added % 3 * 340, y: bottom + 480 + Math.floor(added++ / 3) * 420 }, style: { width: 280 } });
  }
  return !layout?.nodes.length && graph?.edges.length ? arrangeGraph(result, graph.edges) : result;
}

export function serializeCanvas(nodes: CanvasNode[]): Pick<ApiCanvasLayout, "nodes" | "groups"> {
  const groups: CanvasGroup[] = nodes.filter((n) => n.type === "imageGroup").map((n) => ({ groupKey: n.id, title: n.data.title, x: n.position.x, y: n.position.y, width: Number(n.style?.width ?? 600), height: Number(n.style?.height ?? 400) }));
  return { groups, nodes: nodes.filter((n) => n.type !== "imageGroup").map((n) => { const group = groups.find((g) => g.groupKey === n.parentId); return { nodeId: n.id, x: n.position.x + (group?.x ?? 0), y: n.position.y + (group?.y ?? 0), hidden: n.hidden ?? false, ...(group ? { groupKey: group.groupKey } : {}) }; }) };
}

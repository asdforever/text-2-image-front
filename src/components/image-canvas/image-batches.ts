import { creationModeLabel } from "../../lib/creation-mode-label";
import { projectAssetPreviewUrl, type ApiProjectAsset, type ApiWorkbench } from "../../api/client";
import { versionSteps } from "./canvasVersions";
import type { CanvasGraph, CanvasImage, CanvasNode } from "./model";

export const ALL_BATCHES = "all";
export const UNASSIGNED_BATCH = "unassigned";
export const ALL_MODULES = "all";
export const UNASSIGNED_MODULE = "unassigned";
export interface ImageBatch { id: string; label: string; createdAt?: string }
export interface ImageModule { id: string; label: string }
export interface ImageBatchIndex { batches: ImageBatch[]; membership: Map<string, Set<string>>; modules: ImageModule[]; moduleMembership: Map<string, Set<string>> }

/** Batch ownership comes from recorded outputs; derived edits inherit their source's batches. */
export function imageBatchIndex(workbench: ApiWorkbench, assets: ApiProjectAsset[]): ImageBatchIndex {
  const membership = new Map<string, Set<string>>();
  const moduleMembership = new Map<string, Set<string>>();
  const modules = new Map<string, ImageModule>();
  const explicitModules = new Set<string>();
  const parents = new Map<string, Set<string>>();
  const explicit = new Set<string>();
  const batches = new Map<string, { id: string; kind: string; createdAt?: string; creationMode?: string }>();
  const link = (output: string, source: string) => {
    if (output === source) return;
    if (!parents.has(output)) parents.set(output, new Set());
    parents.get(output)!.add(source);
  };
  const record = (id: string, batch: string) => {
    if (!membership.has(id)) membership.set(id, new Set());
    membership.get(id)!.add(batch);
    explicit.add(id);
  };
  const original = new Map((workbench.generationSteps ?? []).map(step => [step.id, step]));
  for (const step of [...(workbench.generationSteps ?? []), ...versionSteps(workbench)]) {
    const track = workbench.generationTracks?.find(item => item.stepId === step.trackId);
    const base = original.get(step.trackId ?? step.id);
    const batchId = step.batchId ?? base?.batchId ?? track?.revisions.find(revision => revision.batchId)?.batchId;
    const outputs = [...step.outputAssetIds, ...step.outputVersionIds];
    const rawModule = step.parameters?.module ?? base?.parameters?.module;
    const module = rawModule && typeof rawModule === "object" ? rawModule as Record<string, unknown> : undefined;
    if (module && typeof module.id === "string" && module.id.trim()) {
      const name = typeof module.label === "string" && module.label.trim() ? module.label : module.id;
      const kind = module.mode ?? step.kind;
      modules.set(module.id, { id: module.id, label: `${kind === "hero" ? "主图 · " : kind === "suite" || kind === "detail" ? "详情套图 · " : ""}${name}` });
      for (const id of outputs) {
        if (!moduleMembership.has(id)) moduleMembership.set(id, new Set());
        moduleMembership.get(id)!.add(module.id);
        explicitModules.add(id);
      }
    } else if (batchId) {
      // A generation with missing module metadata must not inherit its input's type.
      outputs.forEach(id => explicitModules.add(id));
    }
    if (batchId) {
      const createdAt = step.batchCreatedAt ?? base?.batchCreatedAt ?? workbench.batches?.find(batch => batch.id === batchId)?.createdAt;
      const prior = batches.get(batchId);
      batches.set(batchId, { id: batchId, kind: prior?.kind ?? step.kind, creationMode: prior?.creationMode ?? step.creationMode ?? base?.creationMode, createdAt: prior?.createdAt ?? createdAt });
      outputs.forEach(id => record(id, batchId));
    }
    for (const output of outputs) for (const source of step.sourceAssetIds) link(output, source);
    // A version and its archived project asset are two identifiers for the same image.
    if (step.outputAssetIds.length === 1 && step.outputVersionIds.length === 1) {
      link(step.outputAssetIds[0], step.outputVersionIds[0]);
      link(step.outputVersionIds[0], step.outputAssetIds[0]);
    }
  }
  for (const asset of assets) {
    if (asset.sourceAssetId) link(asset.id, asset.sourceAssetId);
    if (asset.generationSnapshotId) {
      link(asset.id, asset.generationSnapshotId);
      link(asset.generationSnapshotId, asset.id);
    }
  }
  const versions = [...(workbench.tasks ?? []).flatMap(task => task.versions), ...(workbench.imageEditChildren ?? []).flatMap(child => child.versions)];
  for (const version of versions) {
    const asset = assets.find(item => item.id === version.id || item.generationSnapshotId === version.id || projectAssetPreviewUrl(workbench.suite.id, item.id) === version.previewUrl);
    if (asset) { link(version.id, asset.id); link(asset.id, version.id); }
  }
  for (const child of workbench.imageEditChildren ?? []) {
    const source = child.snapshot?.sourceVersionId ?? child.task.sourceVersionId;
    if (typeof source === "string") for (const version of child.versions) link(version.id, source);
  }
  // Iterate to handle chains of edits and aliases regardless of API response order.
  const inherit = (values: Map<string, Set<string>>, fixed: Set<string>) => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, sources] of parents) {
        if (fixed.has(id)) continue;
        for (const source of sources) for (const value of values.get(source) ?? []) {
          if (!values.has(id)) values.set(id, new Set());
          if (!values.get(id)!.has(value)) { values.get(id)!.add(value); changed = true; }
        }
      }
    }
  };
  inherit(membership, explicit);
  inherit(moduleMembership, explicitModules);
  const names: Record<string, string> = { hero: "主图", suite: "详情套图", detail: "详情套图", white: "白底图", edit: "编辑" };
  const sorted = [...batches.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.id.localeCompare(b.id));
  return { membership, moduleMembership, modules: [...modules.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-CN")), batches: sorted.map((batch, index) => {
    const date = batch.createdAt ? new Date(batch.createdAt) : null;
    const time = date && Number.isFinite(date.valueOf()) ? date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "时间未记录";
    return { id: batch.id, createdAt: batch.createdAt, label: `${creationModeLabel(batch.creationMode)} · ${names[batch.kind] ?? "生成"} · ${time} · ${batch.id.slice(0, 8)}${index === 0 && date && Number.isFinite(date.valueOf()) ? "（最新）" : ""}` };
  }) };
}

export function matchesImageBatch(index: ImageBatchIndex, batchId: string, ...ids: Array<string | undefined>): boolean {
  if (batchId === ALL_BATCHES) return true;
  const batches = new Set(ids.flatMap(id => [...(id ? index.membership.get(id) ?? [] : [])]));
  return batchId === UNASSIGNED_BATCH ? batches.size === 0 : batches.has(batchId);
}

export function matchesImageFilters(index: ImageBatchIndex, batchId: string, moduleId: string, ...ids: Array<string | undefined>): boolean {
  if (!matchesImageBatch(index, batchId, ...ids)) return false;
  if (moduleId === ALL_MODULES) return true;
  const modules = new Set(ids.flatMap(id => [...(id ? index.moduleMembership.get(id) ?? [] : [])]));
  return moduleId === UNASSIGNED_MODULE ? modules.size === 0 : modules.has(moduleId);
}

export function matchesCanvasImageBatch(index: ImageBatchIndex, batchId: string, image: CanvasImage, moduleId = ALL_MODULES): boolean {
  return matchesImageFilters(index, batchId, moduleId, image.assetId, image.version?.id);
}

/** Visibility is a projection; never write these hidden flags into the saved layout. */
export function filterCanvasByBatch(nodes: CanvasNode[], graph: CanvasGraph, index: ImageBatchIndex, batchId: string, moduleId = ALL_MODULES): CanvasNode[] {
  if (batchId === ALL_BATCHES && moduleId === ALL_MODULES) return nodes;
  const included = new Set(nodes.filter(node => node.data.image && matchesCanvasImageBatch(index, batchId, node.data.image, moduleId)).map(node => node.id));
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  const pending = [...included];
  while (pending.length) {
    for (const source of incoming.get(pending.pop()!) ?? []) if (!included.has(source)) { included.add(source); pending.push(source); }
  }
  for (const node of nodes) if (included.has(node.id) && node.parentId) included.add(node.parentId);
  return nodes.map(node => {
    const hidden = node.hidden || !included.has(node.id);
    const mixedGroup = node.type === "imageGroup" && nodes.some(child => child.parentId === node.id && !included.has(child.id));
    return { ...node, hidden, selected: !hidden && !mixedGroup && node.selected, ...(mixedGroup ? { draggable: false, selectable: false } : {}) };
  });
}

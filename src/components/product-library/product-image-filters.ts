import type { ApiProductionAsset, ApiProductionProduct, ApiProductionVersion } from "../../api/client";
import { ALL_BATCHES, ALL_MODULES, UNASSIGNED_BATCH, UNASSIGNED_MODULE, type ImageBatch, type ImageModule } from "../image-canvas/image-batches";

export { ALL_BATCHES, ALL_MODULES, UNASSIGNED_BATCH, UNASSIGNED_MODULE };

export interface ProductionImageFilterIndex {
  batches: ImageBatch[];
  modules: ImageModule[];
  membership: Map<string, Set<string>>;
  moduleMembership: Map<string, Set<string>>;
}

type Snapshot = Record<string, unknown>;

const moduleLabels: Record<string, string> = {
  source: "原图",
  white_background: "白底图",
  hero: "主图",
  detail: "详情图",
  scene: "场景图",
  edit: "编辑结果",
  long_image: "长图",
};

function record(value: unknown): Snapshot {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Snapshot : {};
}

function text(...values: unknown[]): string | undefined {
  return values.find(value => typeof value === "string" && value.trim()) as string | undefined;
}

function moduleFor(asset: ApiProductionAsset, version?: ApiProductionVersion): ImageModule {
  const snapshot = record(version?.sourceSnapshot);
  const assetSnapshot = record(asset.sourceSnapshot);
  const config = record(snapshot.configSnapshot);
  const selection = record(config.selection);
  const module = record(selection.module || snapshot.module || config.module || assetSnapshot.module);
  const id = text(selection.moduleId, snapshot.moduleId, config.moduleId, assetSnapshot.moduleId, module.id)
    || (asset.sourceKind === "long_image" ? "long_image" : version?.productType || asset.kind);
  const mode = text(module.mode);
  const label = text(module.label) || moduleLabels[id] || (mode === "hero" ? "主图" : mode === "suite" ? "详情套图" : id);
  return { id, label };
}

function batchFor(asset: ApiProductionAsset, version?: ApiProductionVersion): { id?: string; createdAt?: string; creationMode?: string } {
  const snapshot = record(version?.sourceSnapshot);
  const assetSnapshot = record(asset.sourceSnapshot);
  const config = record(snapshot.configSnapshot);
  return {
    id: text(snapshot.batchId, config.batchId, assetSnapshot.batchId),
    createdAt: text(snapshot.batchCreatedAt, config.batchCreatedAt, assetSnapshot.batchCreatedAt),
    creationMode: text(snapshot.creationMode, config.creationMode, assetSnapshot.creationMode),
  };
}

function link(map: Map<string, Set<string>>, id: string, value: string) {
  const values = map.get(id) ?? new Set<string>();
  values.add(value);
  map.set(id, values);
}

export function buildProductionImageFilterIndex(product: ApiProductionProduct): ProductionImageFilterIndex {
  const membership = new Map<string, Set<string>>();
  const moduleMembership = new Map<string, Set<string>>();
  const batches = new Map<string, { id: string; createdAt?: string; creationMode?: string }>();
  const modules = new Map<string, ImageModule>();

  for (const asset of product.assets) {
    const versions = asset.versions.length > 0 ? asset.versions : [undefined];
    for (const version of versions) {
      const module = moduleFor(asset, version);
      modules.set(module.id, module);
      link(moduleMembership, asset.id, module.id);
      if (version) link(moduleMembership, version.id, module.id);
      const batch = batchFor(asset, version);
      if (batch.id) {
        batches.set(batch.id, { id: batch.id, createdAt: batch.createdAt, creationMode: batch.creationMode });
        link(membership, asset.id, batch.id);
        if (version) link(membership, version.id, batch.id);
      }
    }
  }

  const batchOptions = [...batches.values()]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.id.localeCompare(b.id))
    .map(batch => ({
      id: batch.id,
      createdAt: batch.createdAt,
      label: `${batch.creationMode === "professional" ? "专业版" : batch.creationMode === "regular" ? "常规版" : "生成批次"} · ${batch.createdAt ? new Date(batch.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "时间未记录"} · ${batch.id.slice(0, 8)}`,
    }));
  return { batches: batchOptions, modules: [...modules.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-CN")), membership, moduleMembership };
}

export function matchesProductionImageFilters(index: ProductionImageFilterIndex, batchId: string, moduleId: string, ...ids: Array<string | undefined>): boolean {
  if (batchId !== ALL_BATCHES) {
    const batches = new Set(ids.flatMap(id => [...(id ? index.membership.get(id) ?? [] : [])]));
    if (batchId === UNASSIGNED_BATCH ? batches.size !== 0 : !batches.has(batchId)) return false;
  }
  if (moduleId !== ALL_MODULES) {
    const modules = new Set(ids.flatMap(id => [...(id ? index.moduleMembership.get(id) ?? [] : [])]));
    if (moduleId === UNASSIGNED_MODULE ? modules.size !== 0 : !modules.has(moduleId)) return false;
  }
  return true;
}

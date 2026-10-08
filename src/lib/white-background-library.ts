import { listAssetLibraries, listAssets } from "./api-asset";

export type WhiteBackgroundLibraryItem = {
  id: string;
  name: string;
  previewUrl: string;
  source: string;
  sourceKind: "asset_library";
  libraryId: string;
  resourceId: string;
  resourceVersionId?: string;
  snapshot?: Record<string, unknown>;
};

const isWhiteBackground = (metadata?: Record<string, unknown>) =>
  metadata?.assetType === "white_background" || metadata?.productType === "white_background";

export async function loadWhiteBackgroundLibrary(): Promise<{ items: WhiteBackgroundLibraryItem[]; errors: string[] }> {
  const errors: string[] = [];
  // A failed library must not discard images from the other asset libraries.
  async function available<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
    try { return await load(); }
    catch { errors.push(`${label}加载失败，请重试`); return []; }
  }
  const libraries = await available("素材库", listAssetLibraries);
  const items = (await Promise.all(libraries.filter(library => library.assetType === "image").map(async library => {
    const assets = await available(`素材库「${library.name}」`, () => listAssets(library.id));
    return assets.filter(asset => asset.assetType === "image" && asset.url && isWhiteBackground(asset.metadata)).map(asset => ({
      id: asset.id, name: asset.name, previewUrl: asset.url!, source: "素材库", sourceKind: "asset_library" as const,
      libraryId: library.id, resourceId: asset.id, snapshot: asset.metadata,
    }));
  }))).flat();
  return { items, errors: errors.sort() };
}

import { suiteApi } from "../api/client";
import { listAssetLibraries, listAssets } from "./api-asset";

export type WhiteBackgroundLibraryItem = {
  id: string;
  name: string;
  previewUrl: string;
  source: string;
  sourceKind: "production_library" | "asset_library" | "test_library";
  libraryId: string;
  resourceId: string;
  resourceVersionId?: string;
  snapshot?: Record<string, unknown>;
};

const isWhiteBackground = (metadata?: Record<string, unknown>) =>
  metadata?.assetType === "white_background" || metadata?.productType === "white_background";

export async function loadWhiteBackgroundLibrary(): Promise<{ items: WhiteBackgroundLibraryItem[]; errors: string[] }> {
  const errors: string[] = [];
  // Catch at each source/library/product boundary so a failed branch cannot discard siblings.
  async function available<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
    try { return await load(); }
    catch { errors.push(`${label}加载失败，请重试`); return []; }
  }
  const sources = await Promise.all([
    (async (): Promise<WhiteBackgroundLibraryItem[]> => {
      const libraries = await available("素材库", listAssetLibraries);
      return (await Promise.all(libraries.filter(library => library.assetType === "image").map(async library => {
        const assets = await available(`素材库「${library.name}」`, () => listAssets(library.id));
        return assets.filter(asset => asset.assetType === "image" && asset.url && isWhiteBackground(asset.metadata)).map(asset => ({
          id: asset.id, name: asset.name, previewUrl: asset.url!, source: "素材库", sourceKind: "asset_library" as const,
          libraryId: library.id, resourceId: asset.id, snapshot: asset.metadata,
        }));
      }))).flat();
    })(),
    (async (): Promise<WhiteBackgroundLibraryItem[]> => {
      const libraries = await available("正式成品库", () => suiteApi.listProductionLibraries());
      return (await Promise.all(libraries.map(async library => {
        const products = await available(`成品库「${library.name}」`, () => suiteApi.listProductionProducts(library.id));
        return (await Promise.all(products.map(async product => {
          const versions = await available(`成品「${product.name}」`, () => suiteApi.listProductionVersions(product.id, { productType: "white_background", status: "published" }));
          return versions.filter(version => version.previewUrl && version.productType === "white_background" && version.status === "published").map(version => ({
            id: version.id, name: product.name, previewUrl: version.previewUrl!, source: "正式成品库", sourceKind: "production_library" as const,
            libraryId: library.id, resourceId: product.id, resourceVersionId: version.id, snapshot: version.sourceSnapshot,
          }));
        }))).flat();
      }))).flat();
    })(),
    (async (): Promise<WhiteBackgroundLibraryItem[]> => {
      const libraries = await available("测试库", () => suiteApi.listProductLibraries());
      return (await Promise.all(libraries.map(async library => {
        const products = await available(`测试库「${library.name}」`, () => suiteApi.listProducts(library.id));
        return products.filter(product => product.url && (product.productType === "white_background" || isWhiteBackground(product.metadata))).map(product => ({
          id: product.id, name: product.name, previewUrl: product.url!, source: "测试库", sourceKind: "test_library" as const,
          libraryId: library.id, resourceId: product.id, snapshot: product.metadata,
        }));
      }))).flat();
    })(),
  ]);
  return { items: sources.flat(), errors: errors.sort() };
}

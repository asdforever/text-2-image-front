import type { LibraryProjectAssetInput } from "../api/contracts";
import { listAssetLibraries, listAssets } from "./api-asset";
import type { Asset, AssetLibrary } from "../types/asset";

type ListLibraries = () => Promise<AssetLibrary[]>;
type ListLibraryAssets = (libraryId: string) => Promise<Asset[]>;

export async function fetchImageLibraries(load: ListLibraries = listAssetLibraries): Promise<AssetLibrary[]> {
  return (await load()).filter((library) => library.assetType === "image");
}

export async function fetchUsableLibraryImages(libraryId: string, load: ListLibraryAssets = listAssets): Promise<Asset[]> {
  return (await load(libraryId)).filter((asset) => asset.assetType === "image" && Boolean(asset.url));
}

export function toggleLibraryAssetSelection(current: Asset[], asset: Asset): Asset[] {
  const selected = current.some((item) => item.libraryId === asset.libraryId && item.id === asset.id);
  return selected
    ? current.filter((item) => item.libraryId !== asset.libraryId || item.id !== asset.id)
    : [...current, asset];
}

export function toLibraryProjectAssetInputs(assets: Asset[]): LibraryProjectAssetInput[] {
  return assets.flatMap((asset) => asset.url ? [{
    libraryId: asset.libraryId,
    assetId: asset.id,
    name: asset.name,
    url: asset.url,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
  }] : []);
}

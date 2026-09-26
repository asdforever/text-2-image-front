import type { GenerationSnapshot } from "../lib/generation-config";

export type SuiteStatus = "draft" | "in_progress";

export interface SuiteCard {
  id: string;
  title: string;
  type: string;
  prompt: string;
  image: string;
  ratio: string;
  size: string;
  model: string;
  template: string;
  status?: "generated" | "generating";
}

export interface SuiteFixture {
  id: string;
  product: string;
  site: string;
  status: SuiteStatus;
  cards: SuiteCard[];
}

export type OutputTarget = "base" | "hero" | "suite" | "video";
export type AssetType = "source" | "base" | "hero" | "suite" | "video";
export type AssetStatus = "ready" | "generating" | "failed";

export interface Project {
  id: string;
  name: string;
  productName: string;
  outputTargets: OutputTarget[];
  sourceCount: number;
  updatedAt: string;
  assets: Asset[];
  suiteConfigDraft: SuiteConfigDraft;
}

export interface AssetVersion {
  id: string;
  version: number;
  url: string;
  createdAt: string;
  template: string;
  status: AssetStatus;
}

export type ProjectAssetSource =
  | { kind: "upload" }
  | { kind: "asset-library"; libraryId: string; assetId: string; resourceVersionId?: string }
  | { kind: "production-library"; libraryId: string; productId: string; versionId?: string }
  | { kind: "test-library"; libraryId: string; productId: string };

export interface LibraryProjectAssetInput {
  libraryId: string;
  assetId: string;
  name: string;
  url: string;
  width?: number;
  height?: number;
}

export interface Asset {
  id: string;
  projectId: string;
  type: AssetType;
  name: string;
  dimensions: string;
  url: string;
  status: AssetStatus;
  version: number;
  category?: string;
  sequence?: number;
  progress?: number;
  sourceAssetId?: string;
  generationSnapshotId?: string;
  source?: ProjectAssetSource;
  generationSnapshot?: GenerationSnapshot;
  versions: AssetVersion[];
}

export interface SuiteTask {
  id: string;
  projectId: string;
  title: string;
  category: string;
  status: AssetStatus;
  progress: number;
  sourceAssetId: string;
  resultAssetId?: string;
  position: { x: number; y: number };
}

export interface SuiteConfigDraft {
  platform: string;
  language: string;
  mainImageCount: number;
  detailImageCount: number;
  category: string;
  facts: string;
  selectedChunkIds: string[];
}

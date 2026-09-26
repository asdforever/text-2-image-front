// Asset Library Types
export interface AssetLibrary {
  id: string;
  name: string;
  description: string;
  assetType: 'image' | 'text';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetLibraryInput {
  name: string;
  description?: string;
  assetType: 'image' | 'text';
}

export interface UpdateAssetLibraryInput {
  name?: string;
  description?: string;
}

// Asset Types
export interface Asset {
  id: string;
  libraryId: string;
  name: string;
  assetType: 'image' | 'text';
  createdAt: string;
  updatedAt: string;

  // Image-specific fields
  minioBucket?: string;
  minioKey?: string;
  fileType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  url?: string;

  // Text-specific fields
  content?: string;

  // Optional metadata
  metadata?: Record<string, any>;
}

export interface CreateAssetInput {
  name: string;
  file?: File;  // For image assets
  content?: string;  // For text assets
  metadata?: Record<string, any>;
}

// Product Library Types
export interface ProductLibrary {
  id: string;
  name: string;
  description: string;
  libraryType: 'test_result' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductLibraryInput {
  name: string;
  description?: string;
  libraryType: 'test_result' | 'manual';
}

export interface UpdateProductLibraryInput {
  name?: string;
  description?: string;
}

// Product Types
export interface Product {
  id: string;
  libraryId: string;
  name: string;
  productType: 'image' | 'video' | 'audio' | 'document' | 'white_background' | 'hero' | 'detail' | 'scene';
  minioBucket: string;
  minioKey: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;

  // Optional fields
  testRunId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
  url?: string;
}

export interface CreateProductInput {
  name: string;
  productType: 'image' | 'video' | 'audio' | 'document' | 'white_background' | 'hero' | 'detail' | 'scene';
  file: File;
  testRunId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

// Test Run Types
export interface TestRun {
  id: string;
  promptVersionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;

  // Input
  inputAssetId?: string;
  inputText?: string;
  inputAsset?: {
    id: string;
    name: string;
    assetType: 'image' | 'text';
    url?: string;
    content?: string;
  };

  // Output
  outputProductId?: string;
  outputText?: string;
  outputProduct?: {
    id: string;
    name: string;
    productType: string;
    fileSize: number;
    minioKey?: string;
    url?: string;
  };

  // Metrics
  durationMs?: number;
  errorMessage?: string;
}

export interface CreateTestRunInput {
  promptVersionId: string;
  inputAssetId?: string;
  inputText?: string;
  generationParams?: {
    size?: string;
    quality?: string;
    style?: string;
    seed?: number;
  };
}

export interface UpdateTestRunInput {
  status?: 'pending' | 'running' | 'completed' | 'failed';
  outputProductId?: string;
  outputText?: string;
  durationMs?: number;
  errorMessage?: string;
}

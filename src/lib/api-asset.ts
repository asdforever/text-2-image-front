import type {
  AssetLibrary,
  CreateAssetLibraryInput,
  UpdateAssetLibraryInput,
  Asset,
  CreateAssetInput,
  ProductLibrary,
  CreateProductLibraryInput,
  UpdateProductLibraryInput,
  Product,
  CreateProductInput,
  TestRun,
  CreateTestRunInput,
  UpdateTestRunInput,
} from "../types/asset";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? "请求失败");
  return payload?.data as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

// Asset libraries -----------------------------------------------------------

export function listAssetLibraries() {
  return request<AssetLibrary[]>("/api/asset-libraries");
}

export function createAssetLibrary(input: CreateAssetLibraryInput) {
  return request<AssetLibrary>("/api/asset-libraries", json("POST", input));
}

export function getAssetLibrary(libraryId: string) {
  return request<AssetLibrary>(`/api/asset-libraries/${encodeURIComponent(libraryId)}`);
}

export function updateAssetLibrary(libraryId: string, input: UpdateAssetLibraryInput) {
  return request<AssetLibrary>(`/api/asset-libraries/${encodeURIComponent(libraryId)}`, json("PATCH", input));
}

export function deleteAssetLibrary(libraryId: string) {
  return request<{ id: string }>(`/api/asset-libraries/${encodeURIComponent(libraryId)}`, { method: "DELETE" });
}

// Assets --------------------------------------------------------------------

export function listAssets(libraryId: string) {
  return request<Asset[]>(`/api/asset-libraries/${encodeURIComponent(libraryId)}/assets`);
}

export function createAsset(libraryId: string, input: CreateAssetInput) {
  const form = new FormData();
  form.append("name", input.name);
  if (input.file) form.append("file", input.file, input.file.name);
  if (input.content) form.append("content", input.content);
  if (input.metadata) form.append("metadata", JSON.stringify(input.metadata));
  return request<Asset>(`/api/asset-libraries/${encodeURIComponent(libraryId)}/assets`, { method: "POST", body: form });
}

export function deleteAsset(libraryId: string, assetId: string) {
  return request<{ id: string }>(
    `/api/asset-libraries/${encodeURIComponent(libraryId)}/assets/${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
}

// Product libraries ---------------------------------------------------------

export function listProductLibraries() {
  return request<ProductLibrary[]>("/api/test-product-libraries");
}

export function createProductLibrary(input: CreateProductLibraryInput) {
  return request<ProductLibrary>("/api/test-product-libraries", json("POST", input));
}

export function getProductLibrary(libraryId: string) {
  return request<ProductLibrary>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}`);
}

export function updateProductLibrary(libraryId: string, input: UpdateProductLibraryInput) {
  return request<ProductLibrary>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}`, json("PATCH", input));
}

export function deleteProductLibrary(libraryId: string) {
  return request<{ id: string }>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}`, { method: "DELETE" });
}

// Products ------------------------------------------------------------------

export function listProducts(libraryId: string) {
  return request<Product[]>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}/products`);
}

export function createProduct(libraryId: string, input: CreateProductInput) {
  const form = new FormData();
  form.append("name", input.name);
  form.append("productType", input.productType);
  form.append("file", input.file, input.file.name);
  if (input.testRunId) form.append("testRunId", input.testRunId);
  if (input.projectId) form.append("projectId", input.projectId);
  if (input.metadata) form.append("metadata", JSON.stringify(input.metadata));
  return request<Product>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}/products`, { method: "POST", body: form });
}

export function deleteProduct(libraryId: string, productId: string) {
  return request<{ id: string }>(
    `/api/test-product-libraries/${encodeURIComponent(libraryId)}/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
}

// Test runs -----------------------------------------------------------------

export function listTestRuns(promptVersionId?: string) {
  const search = promptVersionId ? `?prompt_version_id=${encodeURIComponent(promptVersionId)}` : "";
  return request<TestRun[]>(`/api/test-runs${search}`);
}

export function createTestRun(input: CreateTestRunInput) {
  return request<TestRun>("/api/test-runs", json("POST", input));
}

export function getTestRun(testRunId: string) {
  return request<TestRun>(`/api/test-runs/${encodeURIComponent(testRunId)}`);
}

export function updateTestRun(testRunId: string, input: UpdateTestRunInput) {
  return request<TestRun>(`/api/test-runs/${encodeURIComponent(testRunId)}`, json("PATCH", input));
}

export function deleteTestRun(testRunId: string) {
  return request<{ id: string }>(`/api/test-runs/${encodeURIComponent(testRunId)}`, { method: "DELETE" });
}

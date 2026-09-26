export interface ProjectAssetInput {
  name: string;
  type: string;
  size: number;
  url?: string;
}

export interface AssetValidationResult {
  ok: boolean;
  reason?: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_SUBMIT = 50;

export function validateProjectAssetBatch(inputs: ProjectAssetInput[]): AssetValidationResult[] {
  return inputs.map((input, index) => {
    if (index >= MAX_FILES_PER_SUBMIT) return { ok: false, reason: `单次最多提交 ${MAX_FILES_PER_SUBMIT} 个文件` };
    return validateProjectAssetInput(input);
  });
}

export function validateProjectAssetInput(input: ProjectAssetInput): AssetValidationResult {
  if (!input.type.startsWith("image/")) return { ok: false, reason: "仅支持图片文件" };
  if (input.size <= 0 || input.size > MAX_IMAGE_BYTES) return { ok: false, reason: "图片大小需在 10MB 以内" };
  if (!input.name.trim()) return { ok: false, reason: "文件名不能为空" };
  return { ok: true };
}

export function toProjectAssetInput(input: ProjectAssetInput): ProjectAssetInput {
  return { name: input.name, type: input.type, size: input.size, ...(input.url ? { url: input.url } : {}) };
}

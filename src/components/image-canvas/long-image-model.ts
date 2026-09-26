import { projectAssetPreviewUrl, type ApiLongImageItem, type ApiLongImageRecipe, type ApiProjectAsset, type ApiWorkbench } from "../../api/client";

export function newLongImageItem(assetId: string): ApiLongImageItem {
  return { assetId, crop: { top: 0, right: 0, bottom: 0, left: 0 }, paddingTop: 0, paddingBottom: 0 };
}

export function longImageSources(workbench: ApiWorkbench, assets: ApiProjectAsset[]) {
  const titles = new Map<string, string>();
  for (const track of workbench.generationTracks ?? []) {
    for (const revision of track.revisions) {
      for (const output of revision.outputs) titles.set(output.assetId, `${track.title} · 图 ${output.index + 1} · V${revision.number}`);
    }
  }
  for (const step of workbench.generationSteps ?? []) {
    step.outputAssetIds.forEach((id, index) => { if (!titles.has(id)) titles.set(id, `${step.title} · 图 ${index + 1} · V${step.revisionNumber ?? 1}`); });
  }
  for (const task of workbench.tasks ?? []) {
    for (const version of task.versions ?? []) {
      const asset = assets.find((item) => item.id === version.id || item.generationSnapshotId === version.id || projectAssetPreviewUrl(workbench.suite.id, item.id) === version.previewUrl);
      if (asset && !titles.has(asset.id)) titles.set(asset.id, `${task.title} · V${version.versionNumber}`);
    }
  }
  return assets.filter((asset) => asset.state === "available" && asset.width > 0 && asset.height > 0 && (!asset.mimeType || asset.mimeType.startsWith("image/"))).map((asset) => ({
    asset, title: titles.get(asset.id) ?? asset.filename, url: projectAssetPreviewUrl(workbench.suite.id, asset.id),
  }));
}

export interface LongImageSegment { assetId: string; x: number; y: number; cropWidth: number; cropHeight: number; height: number; top: number }

/** Pixel boundaries and positive half-up rounding match the server renderer. */
export function longImageLayout(recipe: ApiLongImageRecipe, assets: ApiProjectAsset[]) {
  const errors: string[] = [], warnings: string[] = [], segments: LongImageSegment[] = [];
  const integer = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  if (!recipe.title.trim()) errors.push("请输入长图名称");
  if (recipe.title.length > 80) errors.push("长图名称不能超过 80 个字符");
  if (!integer(recipe.width, 320, 1600)) errors.push("输出宽度需为 320–1600 的整数像素");
  if (!integer(recipe.gap, 0, 200)) errors.push("图片间距需为 0–200 的整数像素");
  if (!/^#[0-9a-f]{6}$/i.test(recipe.background)) errors.push("请选择有效背景颜色");
  if (!recipe.items.length || recipe.items.length > 20) errors.push("请选择 1–20 张图片");
  let height = 0;
  recipe.items.forEach((item, index) => {
    const asset = assets.find((candidate) => candidate.id === item.assetId && candidate.state === "available");
    if (!asset || asset.width <= 0 || asset.height <= 0) { errors.push(`第 ${index + 1} 张来源图片不可用，请移除后重新选择`); return; }
    if (!Object.values(item.crop).every((value) => integer(value, 0, 45))) { errors.push(`第 ${index + 1} 张裁剪需为 0–45 的整数百分比`); return; }
    if (![item.paddingTop, item.paddingBottom].every((value) => integer(value, 0, 200))) { errors.push(`第 ${index + 1} 张留白需为 0–200 的整数像素`); return; }
    const x = Math.floor(asset.width * item.crop.left / 100 + 0.5), y = Math.floor(asset.height * item.crop.top / 100 + 0.5);
    const cropWidth = Math.max(1, asset.width - x - Math.floor(asset.width * item.crop.right / 100 + 0.5));
    const cropHeight = Math.max(1, asset.height - y - Math.floor(asset.height * item.crop.bottom / 100 + 0.5));
    const scaledHeight = Math.max(1, Math.floor(cropHeight * recipe.width / cropWidth + 0.5));
    if (index) height += recipe.gap;
    height += item.paddingTop;
    segments.push({ assetId: item.assetId, x, y, cropWidth, cropHeight, height: scaledHeight, top: height });
    height += scaledHeight + item.paddingBottom;
    if (cropWidth < recipe.width) warnings.push(`第 ${index + 1} 张需要放大，细节可能变模糊`);
  });
  if (height > 30000) errors.push("长图高度不能超过 30000 像素，请减少图片或输出宽度");
  if (height * recipe.width > 32_000_000) errors.push("长图不能超过 3200 万像素，请减少图片或输出宽度");
  return { segments, height, errors, warnings };
}

import { ALL_BATCHES, ALL_MODULES, UNASSIGNED_BATCH, UNASSIGNED_MODULE, type ImageBatchIndex } from "./image-batches";

/** Build both menus from the same available images, preserving the last changed filter. */
export function resolveImageFilters(index: ImageBatchIndex, imageIds: Iterable<string>, batchId: string, moduleId: string, preferred: "batch" | "module" = "batch") {
  const images = [...new Set(imageIds)].map(id => ({ batches: index.membership.get(id) ?? new Set<string>(), modules: index.moduleMembership.get(id) ?? new Set<string>() }));
  const matches = (values: Set<string>, value: string) => value === "all" || (value === "unassigned" ? values.size === 0 : values.has(value));
  const batchExists = batchId === ALL_BATCHES || images.some(image => matches(image.batches, batchId));
  const moduleExists = moduleId === ALL_MODULES || images.some(image => matches(image.modules, moduleId));
  if (!batchExists) batchId = ALL_BATCHES;
  if (!moduleExists) moduleId = ALL_MODULES;
  if (!images.some(image => matches(image.batches, batchId) && matches(image.modules, moduleId))) {
    if (preferred === "module") batchId = ALL_BATCHES;
    else moduleId = ALL_MODULES;
  }
  const batchImages = images.filter(image => matches(image.modules, moduleId));
  const moduleImages = images.filter(image => matches(image.batches, batchId));
  const batches = new Set(batchImages.flatMap(image => [...image.batches]));
  const modules = new Set(moduleImages.flatMap(image => [...image.modules]));
  return {
    batchId, moduleId,
    batches: index.batches.filter(batch => batches.has(batch.id)),
    modules: index.modules.filter(module => modules.has(module.id)),
    hasUnassignedBatch: batchImages.some(image => image.batches.size === 0),
    hasUnassignedModule: moduleImages.some(image => image.modules.size === 0),
  };
}

import type { ReverseBinding, ReverseModuleReference, ReverseTarget } from "../../api/reverse-projects";
import type { CommonGenerationConfig } from "../../lib/generation-workspace";
import { modulePlanInputFingerprint } from "../../lib/planning-master";

export function reverseBindingConfigPatch(config: CommonGenerationConfig, bindings: ReverseBinding[], projectId: string, target: ReverseTarget): Partial<CommonGenerationConfig> {
  const rows = bindings.filter(b => b.projectId === projectId && b.target === target);
  const reverseVersionId = rows.find(b => b.scope === "overall")?.versionId;
  const reverseModuleReferences = Object.fromEntries(rows.filter(b => b.scope === "module" && b.targetModuleId && b.sourceModuleId).map(b => [b.targetModuleId!, { versionId: b.versionId, moduleId: b.sourceModuleId! }]));
  const normalized = (refs: Record<string, ReverseModuleReference> = {}) => JSON.stringify(Object.entries(refs).sort(([a], [b]) => a.localeCompare(b)));
  const patch: Partial<CommonGenerationConfig> = {};
  if (config.reverseVersionId !== reverseVersionId) Object.assign(patch, { reverseVersionId, modulePlanId: undefined, modulePlanFingerprint: undefined, modulePlanningRequest: undefined, modulePlanReferences: {} });
  if (normalized(config.reverseModuleReferences) !== normalized(reverseModuleReferences)) patch.reverseModuleReferences = reverseModuleReferences;
  return patch;
}

export function moduleReverseReference(config: CommonGenerationConfig, taskId: string): ReverseModuleReference | undefined {
  const manual = config.reverseModuleReferences?.[taskId];
  if (manual) return manual;
  if (!config.modulePlanId || config.modulePlanFingerprint !== modulePlanInputFingerprint(config)) return undefined;
  return config.modulePlanReferences?.[taskId];
}

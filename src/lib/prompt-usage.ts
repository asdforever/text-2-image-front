const planningRoles = new Set(["style-seed", "style-planner", "planner", "hero-module-planner", "suite-module-planner"]);

export function canUsePromptForDirectImage(version: { applicability?: Record<string, unknown> } | null | undefined): boolean {
  return Boolean(version) && !planningRoles.has(String(version?.applicability?.runtimeRole));
}

/** Read the frozen generation mode, never the current workspace switch. */
export function creationModeLabel(value: unknown): string {
  return value === "regular" ? "常规版" : value === "professional" ? "专业版" : "版本未记录";
}


export function belongsToCreationMode(record: { creationMode?: unknown; snapshot?: Record<string, unknown> } | null | undefined, mode: string | undefined): boolean {
  if (!record) return false;
  // Older task APIs predate regular mode and follow the professional contract.
  const frozen = record.creationMode ?? record.snapshot?.creationMode ?? "professional";
  return frozen === (mode ?? "professional");
}

const RETRYABLE_STATUSES = new Set(["failed", "cancelled", "needs_retry"]);

export function getRetryableBatchSlotIds(slots: Array<{ id: string; status: string }>): string[] {
  return slots.filter((slot) => RETRYABLE_STATUSES.has(slot.status)).map((slot) => slot.id);
}

export async function retryBatchSlots(
  slotIds: string[],
  retrySlot: (slotId: string) => Promise<unknown>,
): Promise<{ submitted: number; failed: number }> {
  let submitted = 0;
  let failed = 0;
  for (const slotId of slotIds) {
    try {
      await retrySlot(slotId);
      submitted += 1;
    } catch {
      failed += 1;
    }
  }
  return { submitted, failed };
}

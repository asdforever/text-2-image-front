export interface SuiteRecoverySession {
  compileIdempotencyKey: string;
  planId?: string;
}

/**
 * Read a previously submitted suite plan without losing a plan when an old
 * persisted idempotency key is no longer recoverable.
 */
export async function readSuitePlanForRecovery<T>(
  session: SuiteRecoverySession | undefined,
  recoverByKey: (key: string) => Promise<T | null>,
  readByPlanId: (planId: string) => Promise<T>,
  readLatest: () => Promise<T>,
): Promise<T> {
  if (session?.planId) return readByPlanId(session.planId);
  if (session?.compileIdempotencyKey) {
    const recovered = await recoverByKey(session.compileIdempotencyKey);
    if (recovered) return recovered;
  }
  return readLatest();
}

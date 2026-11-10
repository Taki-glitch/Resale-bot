/** Nouvelle tentative avec attente exponentielle (appels réseau de la tâche planifiée). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs: number; sleep?: (ms: number) => Promise<void>; shouldRetry?: (e: unknown) => boolean },
): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= opts.retries || (opts.shouldRetry && !opts.shouldRetry(e))) throw e;
      await sleep(opts.baseMs * 2 ** attempt);
      attempt += 1;
    }
  }
}

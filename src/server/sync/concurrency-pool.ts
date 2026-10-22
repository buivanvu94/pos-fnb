/**
 * Executes an array of items using a bounded concurrency pool.
 * Returns standard PromiseSettledResult array corresponding to item indices.
 */
export async function dispatchWithConcurrency<T, R>(
  items: T[],
  limit: number,
  workerFn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let currentIndex = 0;

  async function poolWorker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        const val = await workerFn(items[idx]);
        results[idx] = { status: "fulfilled", value: val };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, () => poolWorker());
  await Promise.all(workers);
  return results;
}

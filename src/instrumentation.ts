/**
 * Next.js Instrumentation hook (NFR-04, DEC-10).
 * Runs background sync worker with light interval when SYNC_WORKER_ENABLED is true.
 * Defaults to disabled in testing and local dev to prevent side effects.
 * Multi-instance concurrency is safely managed via DB SKIP LOCKED claim.
 */
declare global {
  // eslint-disable-next-line no-var
  var __posSyncWorkerRegistered: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SYNC_WORKER_ENABLED === "true") {
      if (globalThis.__posSyncWorkerRegistered) {
        return;
      }
      globalThis.__posSyncWorkerRegistered = true;

      const { processSyncOutbox } = await import("@/server/sync");
      let isRunning = false;

      setInterval(async () => {
        if (isRunning) return;
        isRunning = true;
        try {
          await processSyncOutbox();
        } catch (err: unknown) {
          console.error("Background sync worker error:", err);
        } finally {
          isRunning = false;
        }
      }, 15000);
    }
  }
}

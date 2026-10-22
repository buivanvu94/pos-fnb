/**
 * Next.js Instrumentation hook (NFR-04, DEC-10).
 * Runs background sync worker with light interval when SYNC_WORKER_ENABLED is true.
 * Defaults to disabled in testing and local dev to prevent side effects.
 * Multi-instance concurrency is safely managed via DB SKIP LOCKED claim.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SYNC_WORKER_ENABLED === "true") {
      const { processSyncOutbox } = await import("@/server/sync");
      setInterval(() => {
        processSyncOutbox().catch((err) => {
          console.error("Background sync worker error:", err);
        });
      }, 15000);
    }
  }
}

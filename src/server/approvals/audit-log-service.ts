import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { DbOrTx } from "@/server/tables/table-service";

export interface LogAuditParams {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}

/**
 * Persists an audit log entry.
 * Can be executed within an existing transaction or with root db pool.
 */
export async function logAudit(
  params: LogAuditParams,
  tx?: DbOrTx,
): Promise<void> {
  const runner = tx ?? db;
  const entityIdStr =
    params.entityId !== undefined && params.entityId !== null
      ? String(params.entityId)
      : null;

  // Never allow PIN in metadata
  let metadataStr: string | null = null;
  if (params.metadata) {
    const cleanMetadata = { ...params.metadata };
    delete (cleanMetadata as any).pin;
    delete (cleanMetadata as any).pinCode;
    delete (cleanMetadata as any).newPin;
    delete (cleanMetadata as any).password;
    delete (cleanMetadata as any).currentPassword;
    metadataStr = JSON.stringify(cleanMetadata);
  }

  await runner.insert(auditLogs).values({
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: entityIdStr,
    reason: params.reason ? params.reason.slice(0, 255) : null,
    metadata: metadataStr,
    ipAddress: params.ipAddress ? params.ipAddress.slice(0, 50) : null,
  });
}

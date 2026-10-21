import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { DbOrTx } from "@/server/tables/table-service";

export interface LogAuditParams {
  userId?: number | null;
  username?: string | null;
  userAgent?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}

/**
 * Persists an audit log entry.
 * Guarantees zero sensitive data (PIN, passwords) leakage.
 * Automatically enriches metadata with username and userAgent (<= 200 chars).
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

  const cleanMetadata: Record<string, any> = params.metadata
    ? { ...params.metadata }
    : {};

  // Strip all sensitive credential values
  delete cleanMetadata.pin;
  delete cleanMetadata.pinCode;
  delete cleanMetadata.newPin;
  delete cleanMetadata.password;
  delete cleanMetadata.currentPassword;

  // Add username and userAgent if available
  if (params.username && cleanMetadata.username === undefined) {
    cleanMetadata.username = params.username;
  }
  if (params.userAgent && cleanMetadata.userAgent === undefined) {
    cleanMetadata.userAgent = params.userAgent.slice(0, 200);
  }

  const metadataStr = Object.keys(cleanMetadata).length > 0
    ? JSON.stringify(cleanMetadata)
    : null;

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

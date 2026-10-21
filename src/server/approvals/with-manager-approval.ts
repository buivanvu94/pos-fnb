import { can, type PermissionAction } from "@/lib/permissions";
import { isPinRequired } from "./approval-settings-service";
import { verifyManagerPin } from "./pin-service";
import type { ActingUser, ApprovalRequest, ApprovalResult } from "./approval-types";

/**
 * Common authorization and PIN approval gate for sensitive operations (FR-10, BR-03, BR-04, SRS 2.5).
 * Validates role permissions, reason length (>= 5 chars), and Manager PIN when required.
 */
export async function withManagerApproval(
  actingUser: ActingUser,
  action: PermissionAction,
  request: ApprovalRequest,
  clientIp?: string,
): Promise<ApprovalResult> {
  const reason = (request.lyDo ?? "").trim();
  if (reason.length < 5) {
    return {
      ok: false,
      status: 400,
      error: "Lý do phải có tối thiểu 5 ký tự",
    };
  }

  const userId = actingUser.userId ?? actingUser.id!;

  // 1. Role permission matrix check (SRS Section 2.5)
  // Even with valid PIN, roles with 'KHONG' (e.g. PHUC_VU for DISCOUNT) cannot execute the action
  const isPermittedWithPin = can(actingUser.role, action, { hasManagerPin: true });
  if (!isPermittedWithPin) {
    return {
      ok: false,
      status: 403,
      error: "Quyền truy cập bị từ chối: Không đủ thẩm quyền (403 Forbidden)",
    };
  }

  // 2. Managers performing their own sensitive actions do not require PIN
  if (actingUser.role === "QUAN_LY") {
    return {
      ok: true,
      approverId: userId,
      approverName: actingUser.fullName,
      reason,
    };
  }

  // 3. Check configuration flag: approval.pinRequired (SRS Section 10)
  const pinRequired = await isPinRequired();
  if (!pinRequired) {
    return {
      ok: true,
      approverId: userId,
      approverName: actingUser.fullName,
      reason,
    };
  }

  // 4. Validate Manager PIN for THU_NGAN / PHUC_VU
  if (!request.pinCode || typeof request.pinCode !== "string") {
    return {
      ok: false,
      status: 400,
      error: "Mã PIN phê duyệt là bắt buộc",
    };
  }

  const verifyResult = await verifyManagerPin(userId, request.pinCode, clientIp);
  if (!verifyResult.valid) {
    return {
      ok: false,
      status: verifyResult.status,
      error: verifyResult.error,
    };
  }

  return {
    ok: true,
    approverId: verifyResult.approver.id,
    approverName: verifyResult.approver.fullName,
    reason,
  };
}

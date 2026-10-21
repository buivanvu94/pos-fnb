export interface ActingUser {
  userId: number;
  id?: number;
  username: string;
  fullName: string;
  role: "QUAN_LY" | "THU_NGAN" | "PHUC_VU";
}

export interface ManagerInfo {
  id: number;
  username: string;
  fullName: string;
}

export interface PinVerifySuccess {
  valid: true;
  approver: ManagerInfo;
}

export interface PinVerifyFailure {
  valid: false;
  locked: boolean;
  status: 403 | 429;
  error: string;
}

export type PinVerifyResult = PinVerifySuccess | PinVerifyFailure;

export interface ApprovalRequest {
  pinCode?: string;
  lyDo: string;
}

export interface ApprovalResultSuccess {
  ok: true;
  approverId: number;
  approverName: string;
  reason: string;
}

export interface ApprovalResultFailure {
  ok: false;
  status: number;
  error: string;
}

export type ApprovalResult = ApprovalResultSuccess | ApprovalResultFailure;

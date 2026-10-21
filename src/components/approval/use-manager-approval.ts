"use client";

import { useState, useCallback, useRef } from "react";

export interface RequestApprovalOptions {
  title: string;
  actionDescription?: string;
  isPinRequired?: boolean;
}

export interface ApprovalResultData {
  pinCode?: string;
  lyDo: string;
}

export type ApprovalActionCallback = (approval: ApprovalResultData) => Promise<{
  ok: boolean;
  error?: string;
  status?: number;
}>;

export function useManagerApproval() {
  const [modalState, setModalState] = useState<{
    open: boolean;
    title: string;
    actionDescription?: string;
    isPinRequired: boolean;
    errorMessage: string | null;
    lockoutUntil: number | null;
    loading: boolean;
  }>({
    open: false,
    title: "",
    isPinRequired: true,
    errorMessage: null,
    lockoutUntil: null,
    loading: false,
  });

  const actionRef = useRef<ApprovalActionCallback | null>(null);

  const requestApproval = useCallback(
    (
      options: RequestApprovalOptions,
      onConfirmAction: ApprovalActionCallback,
    ) => {
      actionRef.current = onConfirmAction;
      setModalState((prev) => ({
        ...prev,
        open: true,
        title: options.title,
        actionDescription: options.actionDescription,
        isPinRequired: options.isPinRequired ?? true,
        errorMessage: null,
        loading: false,
      }));
    },
    [],
  );

  const handleConfirm = useCallback(async (result: ApprovalResultData) => {
    if (!actionRef.current) return;

    setModalState((prev) => ({ ...prev, loading: true, errorMessage: null }));

    try {
      const res = await actionRef.current(result);
      if (res.ok) {
        setModalState((prev) => ({
          ...prev,
          open: false,
          loading: false,
          errorMessage: null,
        }));
        actionRef.current = null;
      } else {
        const isLockout = res.status === 429;
        setModalState((prev) => ({
          ...prev,
          loading: false,
          errorMessage: res.error || "Thao tác không thành công",
          lockoutUntil: isLockout ? Date.now() + 5 * 60 * 1000 : prev.lockoutUntil,
        }));
      }
    } catch {
      setModalState((prev) => ({
        ...prev,
        loading: false,
        errorMessage: "Lỗi kết nối khi thực hiện phê duyệt",
      }));
    }
  }, []);

  const handleCancel = useCallback(() => {
    actionRef.current = null;
    setModalState((prev) => ({
      ...prev,
      open: false,
      loading: false,
      errorMessage: null,
    }));
  }, []);

  const setApprovalLockout = useCallback((lockoutUntil: number | null) => {
    setModalState((prev) => ({ ...prev, lockoutUntil }));
  }, []);

  return {
    modalState,
    requestApproval,
    handleConfirm,
    handleCancel,
    setApprovalLockout,
  };
}

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

  const resolverRef = useRef<((val: ApprovalResultData | null) => void) | null>(null);

  const requestApproval = useCallback(
    (options: RequestApprovalOptions): Promise<ApprovalResultData | null> => {
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setModalState({
          open: true,
          title: options.title,
          actionDescription: options.actionDescription,
          isPinRequired: options.isPinRequired ?? true,
          errorMessage: null,
          lockoutUntil: null,
          loading: false,
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback((result: ApprovalResultData) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setModalState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCancel = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }
    setModalState((prev) => ({ ...prev, open: false }));
  }, []);

  const setApprovalError = useCallback((error: string | null, lockoutUntil?: number | null) => {
    setModalState((prev) => ({
      ...prev,
      errorMessage: error,
      lockoutUntil: lockoutUntil ?? null,
      loading: false,
    }));
  }, []);

  const setApprovalLoading = useCallback((loading: boolean) => {
    setModalState((prev) => ({ ...prev, loading }));
  }, []);

  return {
    modalState,
    requestApproval,
    handleConfirm,
    handleCancel,
    setApprovalError,
    setApprovalLoading,
  };
}

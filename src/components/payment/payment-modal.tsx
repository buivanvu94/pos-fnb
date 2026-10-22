"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Modal } from "antd";
import { PaymentPanel } from "./payment-panel";

interface PaymentModalProps {
  orderId: number | null;
  open: boolean;
  /** Đóng modal khi chưa thanh toán: đơn giữ nguyên. */
  onClose: () => void;
  /** Đóng modal sau khi đơn đã thanh toán (bấm nút quay về hoặc nút X). */
  onFinished: () => void;
}

/** Thanh toán ngay trên màn hình đang bán, không chuyển trang. */
export function PaymentModal({ orderId, open, onClose, onFinished }: PaymentModalProps) {
  const paidRef = useRef(false);

  useEffect(() => {
    if (open) paidRef.current = false;
  }, [open]);

  const markPaid = useCallback(() => {
    paidRef.current = true;
  }, []);

  const close = () => (paidRef.current ? onFinished() : onClose());

  return (
    <Modal
      open={open}
      title="Thanh toán hóa đơn"
      onCancel={close}
      footer={null}
      width={980}
      centered
      destroyOnClose
      maskClosable={false}
    >
      {orderId && <PaymentPanel embedded orderId={orderId} onPaid={markPaid} onBack={close} />}
    </Modal>
  );
}

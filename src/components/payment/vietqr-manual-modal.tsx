"use client";

import React, { useState } from "react";
import { Modal, Input, App } from "antd";

interface VietQrManualModalProps {
  visible: boolean;
  orderId: number;
  expectedVersion: number;
  printPickupTicket: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export function VietQrManualModal({
  visible,
  orderId,
  expectedVersion,
  printPickupTicket,
  onClose,
  onSuccess,
}: VietQrManualModalProps) {
  const { message } = App.useApp();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!reason || reason.trim().length < 5) {
      message.warning("Vui lòng nhập lý do xác nhận thủ công tối thiểu 5 ký tự");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/v1/payments/vietqr/manual-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          expectedVersion,
          reason: reason.trim(),
          printPickupTicket,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        message.success("Đã xác nhận thanh toán thủ công thành công");
        onClose();
        onSuccess(data);
      } else {
        message.error(data.error || "Xác nhận thất bại");
      }
    } catch {
      message.error("Lỗi kết nối khi xác nhận thủ công");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      title="Xác nhận nhận tiền thủ công (Dự phòng)"
      open={visible}
      onOk={handleConfirm}
      confirmLoading={confirming}
      onCancel={onClose}
      okText="Xác nhận đã nhận tiền"
      cancelText="Đóng"
    >
      <p>
        Thao tác này chỉ dùng khi mất mạng Internet hoặc webhook SePay chậm trễ.
        Hành động sẽ được ghi nhận vào nhật ký kiểm toán (audit log).
      </p>
      <Input.TextArea
        rows={3}
        placeholder="Nhập lý do xác nhận thủ công (tối thiểu 5 ký tự)..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
}

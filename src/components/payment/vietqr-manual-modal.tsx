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
  const [pin, setPin] = useState("");
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
          pin: pin.trim(),
          reason: reason.trim(),
          printPickupTicket,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        message.success("Đã xác nhận thanh toán thủ công thành công");
        setPin("");
        setReason("");
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
      <p style={{ marginBottom: 12 }}>
        Thao tác này chỉ dùng khi mất mạng Internet hoặc webhook SePay chậm trễ.
        Yêu cầu mã PIN Quản lý và lý do tối thiểu 5 ký tự để ghi nhật ký kiểm toán.
      </p>
      <Input.Password
        placeholder="Mã PIN Quản lý phê duyệt (4-6 chữ số)"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <Input.TextArea
        rows={3}
        placeholder="Nhập lý do xác nhận thủ công (tối thiểu 5 ký tự)..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
}

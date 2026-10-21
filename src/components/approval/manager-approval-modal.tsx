"use client";

import React, { useState, useEffect } from "react";
import { Modal, Input, Typography, Alert, Statistic, Space, Button } from "antd";
import { NumericKeypad } from "./numeric-keypad";
import { PinDotsDisplay } from "./pin-dots-display";

const { Title, Text } = Typography;

export interface ManagerApprovalModalProps {
  open: boolean;
  title: string;
  actionDescription?: string;
  isPinRequired?: boolean;
  errorMessage?: string | null;
  lockoutUntil?: number | null;
  loading?: boolean;
  onConfirm: (result: { pinCode?: string; lyDo: string }) => void;
  onCancel: () => void;
}

/**
 * Shared Manager Approval Modal with custom touch keypad and reason input (SCR-05).
 * Enforces minimum 5 characters reason and masked PIN entry.
 */
export function ManagerApprovalModal({
  open,
  title,
  actionDescription,
  isPinRequired = true,
  errorMessage,
  lockoutUntil,
  loading = false,
  onConfirm,
  onCancel,
}: ManagerApprovalModalProps) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (lockoutUntil && lockoutUntil > Date.now()) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [lockoutUntil]);

  // Reset PIN and state on modal open/close
  useEffect(() => {
    if (!open) {
      setPin("");
      setReason("");
      setIsLocked(false);
    }
  }, [open]);

  const handleDigit = (digit: string) => {
    if (pin.length < 6 && !isLocked) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (!isLocked) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (!isLocked) {
      setPin("");
    }
  };

  const canSubmit =
    reason.trim().length >= 5 &&
    (!isPinRequired || (pin.length >= 4 && pin.length <= 6)) &&
    !isLocked &&
    !loading;

  const handleSubmit = () => {
    if (canSubmit) {
      onConfirm({
        pinCode: isPinRequired ? pin : undefined,
        lyDo: reason.trim(),
      });
      // Clear PIN immediately from state
      setPin("");
    }
  };

  return (
    <Modal
      open={open}
      title={
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
      }
      onCancel={() => {
        setPin("");
        onCancel();
      }}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger
          loading={loading}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Xác nhận phê duyệt
        </Button>,
      ]}
      width={420}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {actionDescription && (
          <Text type="secondary">{actionDescription}</Text>
        )}

        <div>
          <Text strong>Lý do thực hiện (tối thiểu 5 ký tự):</Text>
          <Input.TextArea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do chi tiết..."
            maxLength={255}
            showCount
            style={{ marginTop: 6 }}
          />
        </div>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ fontSize: 13 }}
          />
        )}

        {isLocked && lockoutUntil && (
          <div
            style={{
              padding: 12,
              backgroundColor: "#fff2f0",
              border: "1px solid #ffccc7",
              borderRadius: 6,
              textAlign: "center",
            }}
          >
            <Text type="danger" strong style={{ display: "block", marginBottom: 6 }}>
              Thời gian khóa xác thực còn lại:
            </Text>
            <Statistic.Countdown
              value={lockoutUntil}
              format="mm:ss"
              onFinish={() => setIsLocked(false)}
              valueStyle={{ color: "#cf1322", fontWeight: 700, fontSize: 24 }}
            />
          </div>
        )}

        {isPinRequired && (
          <div>
            <Text strong style={{ display: "block", textAlign: "center" }}>
              Mã PIN Quản lý (4-6 số):
            </Text>
            <PinDotsDisplay length={pin.length} maxLength={6} />
            <NumericKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onClear={handleClear}
              disabled={isLocked || loading}
            />
          </div>
        )}
      </Space>
    </Modal>
  );
}

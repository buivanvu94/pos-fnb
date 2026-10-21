"use client";

import React, { useState, useEffect } from "react";
import { Modal, Radio, InputNumber, Input, Typography, Alert, Statistic, Space, Button } from "antd";
import { NumericKeypad } from "./numeric-keypad";
import { PinDotsDisplay } from "./pin-dots-display";

const { Title, Text } = Typography;

export interface DiscountModalProps {
  open: boolean;
  totalAmount: number;
  isPinRequired?: boolean;
  errorMessage?: string | null;
  lockoutUntil?: number | null;
  loading?: boolean;
  onConfirm: (data: { amount?: number; percent?: number; pinCode?: string; lyDo: string }) => void;
  onCancel: () => void;
}

/**
 * Modal for applying fixed amount or percentage discount with Manager approval (SCR-05).
 */
export function DiscountModal({
  open,
  totalAmount,
  isPinRequired = true,
  errorMessage,
  lockoutUntil,
  loading = false,
  onConfirm,
  onCancel,
}: DiscountModalProps) {
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [percentValue, setPercentValue] = useState<number | null>(10);
  const [amountValue, setAmountValue] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (lockoutUntil && lockoutUntil > Date.now()) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [lockoutUntil]);

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

  const calculatedDiscount =
    discountType === "percent"
      ? Math.round(totalAmount * ((percentValue ?? 0) / 100))
      : amountValue ?? 0;

  const isValidDiscount =
    calculatedDiscount >= 0 &&
    calculatedDiscount <= totalAmount &&
    (discountType === "percent" ? (percentValue ?? 0) >= 0 && (percentValue ?? 0) <= 100 : (amountValue ?? 0) >= 0);

  const canSubmit =
    isValidDiscount &&
    reason.trim().length >= 5 &&
    (!isPinRequired || (pin.length >= 4 && pin.length <= 6)) &&
    !isLocked &&
    !loading;

  const handleSubmit = () => {
    if (canSubmit) {
      onConfirm({
        amount: discountType === "amount" ? amountValue ?? 0 : undefined,
        percent: discountType === "percent" ? percentValue ?? 0 : undefined,
        pinCode: isPinRequired ? pin : undefined,
        lyDo: reason.trim(),
      });
      setPin("");
    }
  };

  return (
    <Modal
      open={open}
      title={<Title level={4} style={{ margin: 0 }}>Giảm giá hóa đơn</Title>}
      onCancel={() => {
        setPin("");
        onCancel();
      }}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>,
        <Button key="submit" type="primary" loading={loading} disabled={!canSubmit} onClick={handleSubmit}>
          Áp dụng giảm giá
        </Button>,
      ]}
      width={420}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: "100%" }} size={14}>
        <div>
          <Text strong>Hình thức giảm giá:</Text>
          <div style={{ marginTop: 6 }}>
            <Radio.Group
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <Radio.Button value="percent">Theo phần trăm (%)</Radio.Button>
              <Radio.Button value="amount">Theo số tiền (VNĐ)</Radio.Button>
            </Radio.Group>
          </div>
        </div>

        <div>
          <Text strong>
            {discountType === "percent" ? "Phần trăm giảm (0 - 100%):" : "Số tiền giảm (VNĐ):"}
          </Text>
          <div style={{ marginTop: 6 }}>
            {discountType === "percent" ? (
              <InputNumber
                min={0}
                max={100}
                style={{ width: "100%" }}
                value={percentValue}
                onChange={(val) => setPercentValue(val)}
                placeholder="Ví dụ: 10, 20"
              />
            ) : (
              <InputNumber
                min={0}
                max={totalAmount}
                step={1000}
                style={{ width: "100%" }}
                value={amountValue}
                onChange={(val) => setAmountValue(val)}
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(val) => (val ? Number(val.replace(/\$\s?|(,*)/g, "")) : 0) as any}
                placeholder="Nhập số tiền VNĐ..."
              />
            )}
          </div>
        </div>

        <div>
          <Text strong>Lý do giảm giá (tối thiểu 5 ký tự):</Text>
          <Input.TextArea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Khách quen giảm giá..."
            maxLength={255}
            showCount
            style={{ marginTop: 6 }}
          />
        </div>

        {errorMessage && (
          <Alert type="error" message={errorMessage} showIcon style={{ fontSize: 13 }} />
        )}

        {isLocked && lockoutUntil && (
          <div style={{ padding: 10, backgroundColor: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 6, textAlign: "center" }}>
            <Text type="danger" strong>Khóa xác thực PIN còn lại:</Text>
            <Statistic.Countdown value={lockoutUntil} format="mm:ss" onFinish={() => setIsLocked(false)} />
          </div>
        )}

        {isPinRequired && (
          <div>
            <Text strong style={{ display: "block", textAlign: "center" }}>Mã PIN Quản lý (4-6 số):</Text>
            <PinDotsDisplay length={pin.length} maxLength={6} />
            <NumericKeypad
              onDigit={handleDigit}
              onBackspace={() => !isLocked && setPin((p) => p.slice(0, -1))}
              onClear={() => !isLocked && setPin("")}
              disabled={isLocked || loading}
            />
          </div>
        )}
      </Space>
    </Modal>
  );
}

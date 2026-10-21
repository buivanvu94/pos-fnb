"use client";

import React, { useState } from "react";
import { Modal, Form, Segmented, InputNumber, Input, App } from "antd";
import { formatVndNumber, parseVnd } from "@/lib/money";

interface CashTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (expectedCash: number) => void;
}

interface FormValues {
  loai: "THU" | "CHI";
  soTien: number;
  lyDo: string;
}

export function CashTransactionModal({
  open,
  onClose,
  onSuccess,
}: CashTransactionModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { message } = App.useApp();

  const handleFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/shifts/cash-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loai: values.loai,
          soTien: values.soTien,
          lyDo: values.lyDo.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Không thể tạo phiếu thu/chi");
      }

      const actionName = values.loai === "THU" ? "Thu tiền mặt" : "Chi tiền mặt";
      message.success(`Đã ghi nhận ${actionName} và gửi lệnh in phiếu`);
      form.resetFields();
      onSuccess(data.data.expectedCash);
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="SCR-07: Thu / Chi tiền mặt trong ca"
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Xác nhận tạo phiếu"
      cancelText="Hủy bỏ"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ loai: "CHI", soTien: undefined, lyDo: "" }}
        onFinish={handleFinish}
      >
        <Form.Item
          name="loai"
          label="Loại giao dịch"
          rules={[{ required: true, message: "Vui lòng chọn loại giao dịch" }]}
        >
          <Segmented
            block
            size="large"
            options={[
              { label: "🔴 Chi tiền mặt (Chi vặt)", value: "CHI" },
              { label: "🟢 Thu tiền mặt (Nạp lẻ)", value: "THU" },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="soTien"
          label="Số tiền giao dịch (VND)"
          rules={[
            { required: true, message: "Vui lòng nhập số tiền" },
            {
              validator: async (_, value) => {
                if (value === undefined || value === null) return;
                if (typeof value !== "number" || value <= 0) {
                  throw new Error("Số tiền phải lớn hơn 0 VNĐ");
                }
              },
            },
          ]}
        >
          <InputNumber<number>
            style={{ width: "100%" }}
            size="large"
            placeholder="Ví dụ: 50.000"
            formatter={(value) => (value ? formatVndNumber(Number(value)) : "")}
            parser={(displayValue) => (displayValue ? parseVnd(displayValue) : 0)}
          />
        </Form.Item>

        <Form.Item
          name="lyDo"
          label="Lý do thu / chi chi tiết"
          rules={[
            { required: true, message: "Vui lòng nhập lý do cụ thể" },
            {
              validator: async (_, value) => {
                if (!value || typeof value !== "string" || value.trim().length === 0) {
                  throw new Error("Lý do không được để trống");
                }
                if (value.trim().length > 255) {
                  throw new Error("Lý do không được vượt quá 255 ký tự");
                }
              },
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="Ví dụ: Mua đá uống gấp, nạp thêm tiền lẻ thối két..."
            maxLength={255}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
